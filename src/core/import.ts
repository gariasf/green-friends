import { getTableName, sql } from 'drizzle-orm';
import type { SQLiteUpdateSetSource } from 'drizzle-orm/sqlite-core';
import { strFromU8, unzipSync, type Unzipped } from 'fflate';

import { getSchemaVersion, migrate } from '../db/migrate';
import { careEvents, photos, plants, settings } from '../db/schema';
import type { Db } from '../db/types';
import { listCareEventRows, validateCareEvent } from './careLog';
import {
  keepNewestPhotos,
  listPhotoRows,
  livePhotoFiles,
  removePhotoFiles,
  validatePhoto,
  type PhotoFiles,
} from './photos';
import { listPlantRows, validatePlant, type Plant } from './plants';
import { SETTINGS_ID, getSettings, validateSettings } from './settings';
import { getSpecies } from './species';

/** The user-data tables an Export carries (ADR-0002). */
const TABLES = [plants, careEvents, photos, settings];

type Table = (typeof TABLES)[number];

/**
 * Imports the Export in `zip` (CONTEXT.md, Import): a merge into the Garden in `db`, row by row by
 * UUID, where the newer edit wins and a tombstone is an edit like any other (ADR-0002). All or
 * nothing: the whole Export is checked before any of it is written, and a failure throws one error
 * with nothing changed, photo files included. `scratch` is a fresh, empty database, in which the
 * Export's rows come up to the current schema version.
 */
export function importExport(
  db: Db,
  files: PhotoFiles,
  scratch: Db,
  zip: Uint8Array,
  now: Date = new Date(),
): void {
  const { json, archive } = openExport(zip);
  if (json.schema_version > getSchemaVersion(db)) {
    throw new Error(
      'This export is from a newer version of Green Friends. Update the app to import it',
    );
  }
  const incoming = readRows(db, scratch, json, archive);
  const winners = {
    plants: newer(listPlantRows(db), incoming.plants),
    careEvents: newer(listCareEventRows(db), incoming.careEvents),
    photos: newer(listPhotoRows(db), incoming.photos),
    settings: newer([getSettings(db)], incoming.settings),
  };
  // As when a photo is set: files go in before their rows, and out after their tombstones.
  const liveBefore = livePhotoFiles(db);
  const written: string[] = [];
  try {
    for (const { filename, deletedAt } of winners.photos) {
      // A photo live here has its file already: a photo row names one picture for good.
      if (deletedAt !== null || liveBefore.has(filename)) continue;
      // Listed first, so that a write failing halfway leaves no part of a file behind.
      written.push(filename);
      files.write(filename, archive[`photos/${filename}`]);
    }
    db.transaction((tx) => {
      upsert(tx, plants, winners.plants);
      upsert(tx, careEvents, winners.careEvents);
      upsert(tx, photos, winners.photos);
      upsert(tx, settings, winners.settings);
      keepNewestPhotos(tx, now.toISOString());
    });
  } catch (error) {
    // All or nothing: the transaction rolled back, and the files it would have needed go.
    removePhotoFiles(files, written);
    throw new Error(reason(error));
  }
  const liveAfter = livePhotoFiles(db);
  removePhotoFiles(
    files,
    [...liveBefore, ...written].filter((filename) => !liveAfter.has(filename)),
  );
}

/** export.json, parsed, and the other files in the zip; throws for a file that is no Export. */
function openExport(zip: Uint8Array) {
  try {
    const archive = unzipSync(zip);
    const json = JSON.parse(strFromU8(archive['export.json']));
    if (Number.isInteger(json.schema_version) && json.schema_version > 0) return { json, archive };
  } catch {
    // No zip, no export.json in it, or no JSON in that.
  }
  throw new Error('This file is not a Green Friends export');
}

type ExportJson = { schema_version: number; [key: string]: unknown };

/**
 * The Export's rows as the core holds them, checked before any is written; whatever is wrong
 * with them is reported as one error, the Export being damaged.
 */
function readRows(db: Db, scratch: Db, json: ExportJson, archive: Unzipped): ExportRows {
  try {
    const rows = bringForward(scratch, json);
    const names = speciesNames(json.species_refs);
    nameDriftedPlants(db, rows.plants, names);
    validate(db, rows, names, archive);
    return rows;
  } catch (error) {
    throw new Error(`This export is damaged. ${reason(error)}`);
  }
}

function reason(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  // Drizzle wraps what SQLite refused, and why, in an error quoting the whole statement.
  return error.cause instanceof Error ? error.cause.message : error.message;
}

/**
 * The Export's rows as the current schema holds them: loaded into `scratch` at the Export's schema
 * version, then brought forward by the same migrations as the database (ADR-0002).
 */
function bringForward(scratch: Db, json: ExportJson) {
  migrate(scratch, json.schema_version);
  for (const table of TABLES) {
    const name = getTableName(table);
    // A table later than the Export's version starts empty, as the migrations make it.
    const tables = sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${name}`;
    if (scratch.all(tables).length === 0) continue;
    const rows = json[name];
    if (!Array.isArray(rows)) throw new Error(`No ${name}`);
    // The settings row a migration seeds gives way to the Export's.
    scratch.delete(table).run();
    for (const row of rows) {
      const entries = Object.entries(row);
      const columns = sql.join(
        entries.map(([column]) => sql.identifier(column)),
        sql`, `,
      );
      const values = sql.join(
        entries.map(([, value]) => sql`${value}`),
        sql`, `,
      );
      scratch.run(sql`INSERT INTO ${table} (${columns}) VALUES (${values})`);
    }
  }
  migrate(scratch);
  return {
    plants: scratch.select().from(plants).all(),
    careEvents: scratch.select().from(careEvents).all(),
    photos: scratch.select().from(photos).all(),
    settings: scratch.select().from(settings).all(),
  };
}

type ExportRows = ReturnType<typeof bringForward>;

/**
 * The colloquial name species_refs snapshots for each Species the Export names: null where the
 * exporting catalog lacked the Species too (ADR-0002).
 */
function speciesNames(speciesRefs: unknown): Map<string, string | null> {
  if (!Array.isArray(speciesRefs)) throw new Error('No species_refs');
  return new Map(
    speciesRefs.map((ref) => {
      const name = ref?.colloquial_name;
      return [ref?.id, typeof name === 'string' ? name : null];
    }),
  );
}

/**
 * Species drift (ADR-0002): a plant whose Species this catalog lacks keeps the reference, for a
 * later catalog to resolve, and takes the snapshot's name as its nickname where it has none, so
 * the Display Name rule holds without the catalog.
 */
function nameDriftedPlants(db: Db, rows: Plant[], names: Map<string, string | null>): void {
  for (const plant of rows) {
    const { speciesId } = plant;
    if (speciesId === null || plant.nickname !== null || getSpecies(db, speciesId)) continue;
    plant.nickname = names.get(speciesId) ?? null;
  }
}

/**
 * What an Export must hold before any of it is written: rows the core could have written itself,
 * and what ADR-0002 checks, every Species a plant refers to named in species_refs, a file for
 * every live photo and at most one live photo per plant.
 */
function validate(
  db: Db,
  rows: ExportRows,
  names: Map<string, string | null>,
  archive: Unzipped,
): void {
  for (const row of [...rows.plants, ...rows.careEvents, ...rows.photos, ...rows.settings]) {
    checkRow(row);
  }
  for (const plant of rows.plants) {
    if (plant.speciesId !== null && !names.has(plant.speciesId)) {
      throw new Error(
        `Plant ${plant.id} refers to Species ${plant.speciesId}, which it does not name`,
      );
    }
    validatePlant(db, plant);
  }
  for (const event of rows.careEvents) validateCareEvent(event);
  const photographed = new Set<string>();
  for (const photo of rows.photos) {
    // With its UUID id, the file name keeps the file inside the photo folder.
    validatePhoto(photo);
    if (photo.deletedAt !== null) continue;
    if (photographed.has(photo.plantId)) throw new Error(`Plant ${photo.plantId} has two photos`);
    photographed.add(photo.plantId);
    if (!archive[`photos/${photo.filename}`]) {
      throw new Error(`No file for photo ${photo.filename}`);
    }
  }
  const [row, ...others] = rows.settings;
  if (row?.id !== SETTINGS_ID || others.length > 0) {
    throw new Error(`Settings must be one row, ${SETTINGS_ID}`);
  }
  validateSettings(row);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A client UUID for an id, and times as the core writes them (research #5): UTC ISO-8601 to the
 * millisecond, the one form whose text order is time order, which last-write-wins compares.
 */
function checkRow(row: { id: string }): void {
  if (!UUID.test(row.id)) throw new Error(`Not a row id: ${row.id}`);
  for (const [key, value] of Object.entries(row)) {
    // createdAt, updatedAt, deletedAt, archivedAt.
    if (key.endsWith('At') && value !== null && !isUtcTime(value)) {
      throw new Error(`Not a UTC time: ${value}`);
    }
  }
}

function isUtcTime(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

/** The incoming rows that win over the local ones: new here, or edited later (last write wins). */
function newer<Row extends { id: string; updatedAt: string }>(local: Row[], rows: Row[]): Row[] {
  const updatedAt = new Map(local.map((row) => [row.id, row.updatedAt]));
  return rows.filter((row) => {
    const localAt = updatedAt.get(row.id);
    return localAt === undefined || row.updatedAt > localAt;
  });
}

/** Writes each row whole, over any local row with its id. */
function upsert<T extends Table>(tx: Db, table: T, rows: T['$inferSelect'][]): void {
  for (const row of rows) {
    const set = row as SQLiteUpdateSetSource<T>;
    tx.insert(table).values(row).onConflictDoUpdate({ target: table.id, set }).run();
  }
}
