import { desc, eq, getTableName, isNull, sql } from 'drizzle-orm';
import type { SQLiteUpdateSetSource } from 'drizzle-orm/sqlite-core';
import { strFromU8, unzipSync, type Unzipped } from 'fflate';

import { getSchemaVersion, migrate } from '../db/migrate';
import { careEvents, photos, plants, settings } from '../db/schema';
import type { Db } from '../db/types';
import { checkCareEvent, listCareEventRows } from './careLog';
import { listPhotoRows, removePhotoFiles, type PhotoFiles } from './photos';
import { listPlantRows, validatePlant } from './plants';
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
  const incoming = checked(() => {
    const rows = bringForward(scratch, json);
    validate(db, rows, json.species_refs, archive);
    return rows;
  });
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
      files.write(filename, archive[`photos/${filename}`]);
      written.push(filename);
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

/** What `read` returns; its error, should it throw, is the one an Import reports for the Export. */
function checked<T>(read: () => T): T {
  try {
    return read();
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
function bringForward(scratch: Db, json: { schema_version: number; [table: string]: unknown }) {
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

type Rows = ReturnType<typeof bringForward>;

/**
 * What an Export must hold before any of it is written: rows the core could have written itself,
 * and what ADR-0002 checks, every Species a plant refers to named in species_refs, a file for
 * every live photo and at most one live photo per plant. On the way, a plant whose Species this
 * catalog lacks gets its nickname from the Export's snapshot where it has none (ADR-0002).
 */
function validate(db: Db, rows: Rows, speciesRefs: unknown, archive: Unzipped): void {
  for (const row of [...rows.plants, ...rows.careEvents, ...rows.photos, ...rows.settings]) {
    checkRow(row);
  }
  if (!Array.isArray(speciesRefs)) throw new Error('No species_refs');
  const snapshots = new Map(speciesRefs.map((ref) => [ref?.id, ref?.colloquial_name]));
  for (const plant of rows.plants) {
    const { speciesId } = plant;
    if (speciesId !== null) {
      if (!snapshots.has(speciesId)) {
        throw new Error(`Plant ${plant.id} refers to Species ${speciesId}, which it does not name`);
      }
      // The Display Name rule holds without the catalog; the reference stays for a later one.
      const snapshot = snapshots.get(speciesId);
      if (plant.nickname === null && typeof snapshot === 'string' && !getSpecies(db, speciesId)) {
        plant.nickname = snapshot;
      }
    }
    validatePlant(db, plant);
  }
  for (const event of rows.careEvents) checkCareEvent(event);
  const photographed = new Set<string>();
  for (const photo of rows.photos) {
    // The name is a path in the photo folder, where the row's UUID alone may place a file.
    if (photo.filename !== `${photo.id}.jpg`) {
      throw new Error(`A photo's file must be named <its id>.jpg, not ${photo.filename}`);
    }
    if (photo.deletedAt !== null) continue;
    if (photographed.has(photo.plantId)) throw new Error(`Plant ${photo.plantId} has two photos`);
    photographed.add(photo.plantId);
    if (!archive[`photos/${photo.filename}`]) {
      throw new Error(`No file for photo ${photo.filename}`);
    }
  }
  for (const row of rows.settings) {
    if (row.id !== SETTINGS_ID) throw new Error(`Not the settings row: ${row.id}`);
    validateSettings(row);
  }
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

/**
 * A plant keeps at most one live photo: when each device gave it a new one, the newest stays, as
 * if it were taken last, and the others are Deleted.
 */
function keepNewestPhotos(tx: Db, stamp: string): void {
  const live = tx
    .select()
    .from(photos)
    .where(isNull(photos.deletedAt))
    .orderBy(desc(photos.createdAt), desc(photos.id))
    .all();
  const kept = new Set<string>();
  for (const photo of live) {
    if (!kept.has(photo.plantId)) {
      kept.add(photo.plantId);
      continue;
    }
    tx.update(photos)
      .set({ updatedAt: stamp, deletedAt: stamp })
      .where(eq(photos.id, photo.id))
      .run();
  }
}

function livePhotoFiles(db: Db): Set<string> {
  const live = db
    .select({ filename: photos.filename })
    .from(photos)
    .where(isNull(photos.deletedAt));
  return new Set(live.all().map((photo) => photo.filename));
}
