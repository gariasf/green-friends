import { eq, getTableColumns, isNotNull, type InferSelectModel } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { strToU8, zipSync, type Zippable } from 'fflate';

import { getSchemaVersion } from '../db/migrate';
import { careEvents, photos, plants, settings, species } from '../db/schema';
import type { Db } from '../db/types';
import { listCareEventRows } from './careLog';
import { localDay } from './dates';
import { listPhotoRows, type PhotoFiles } from './photos';
import { listPlantRows } from './plants';
import { getSettings } from './settings';

/**
 * Where an Export goes, injected so the core stays plain TypeScript (ADR-0001): the app hands in
 * the share sheet, tests a fake.
 */
export type ShareSheet = {
  /** Offers the zip `bytes`, as a file named `name`, to other apps; resolves once dismissed. */
  share(name: string, bytes: Uint8Array): Promise<void>;
};

/**
 * Exports the Garden (CONTEXT.md, Export) to the share sheet: a plain zip named for the local day,
 * green-friends-<YYYY-MM-DD>.zip, holding export.json and, under photos/, the file of every live
 * photo row (ADR-0002). export.json carries a header, the user-data tables verbatim under their
 * column names, tombstones included, and a name snapshot of every Species a plant refers to; never
 * the Species catalog, nor the pending notifications, a projection recomputed after an Import.
 * ponytail: the zip is built in memory, the size of the photos; stream it into a file through
 * fflate's Zip if Gardens outgrow that.
 */
export async function shareExport(
  db: Db,
  files: PhotoFiles,
  sheet: ShareSheet,
  appVersion: string,
  now: Date = new Date(),
): Promise<void> {
  const json = {
    // The migration version, so an Import can bring an older Export's rows forward.
    schema_version: getSchemaVersion(db),
    exported_at: now.toISOString(),
    app_version: appVersion,
    plants: verbatim(plants, listPlantRows(db)),
    care_events: verbatim(careEvents, listCareEventRows(db)),
    photos: verbatim(photos, listPhotoRows(db)),
    settings: verbatim(settings, [getSettings(db)]),
    // A Species the catalog doesn't know, as an Import can leave, goes without names: its plant
    // has a nickname, which that Import backfilled (ADR-0002).
    species_refs: db
      .selectDistinct({
        id: plants.speciesId,
        colloquial_name: species.colloquialName,
        scientific_name: species.scientificName,
      })
      .from(plants)
      .leftJoin(species, eq(plants.speciesId, species.id))
      .where(isNotNull(plants.speciesId))
      .orderBy(plants.speciesId)
      .all(),
  };
  // Indented for whoever opens the zip; the deflate squeezes the whitespace out again.
  const zip: Zippable = { 'export.json': strToU8(JSON.stringify(json, null, 2)) };
  for (const { filename, deleted_at } of json.photos) {
    // JPEGs are compressed already: stored as they are.
    if (deleted_at === null) zip[`photos/${filename}`] = [files.read(filename), { level: 0 }];
  }
  return sheet.share(`green-friends-${localDay(now)}.zip`, zipSync(zip));
}

/** A table's rows under their SQL column names, as the table holds them. */
type Rows<T extends SQLiteTable> = InferSelectModel<T, { dbColumnNames: true }>[];

function verbatim<T extends SQLiteTable>(table: T, rows: T['$inferSelect'][]): Rows<T> {
  const columns = Object.entries(getTableColumns(table));
  return rows.map((row) =>
    Object.fromEntries(columns.map(([key, column]) => [column.name, row[key]])),
  ) as Rows<T>;
}
