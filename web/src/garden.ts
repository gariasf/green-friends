import { drizzle } from 'drizzle-orm/sql-js';
import type { SqlJsStatic } from 'sql.js';

import species from '../../assets/species.json';
import { importExport } from '../../src/core/import';
import type { PhotoFiles } from '../../src/core/photos';
import { seedSpecies, type SpeciesDataset } from '../../src/core/species';
import { migrate } from '../../src/db/migrate';
import * as schema from '../../src/db/schema';
import type { Db } from '../../src/db/types';

/** A Snapshot's Garden, opened in the browser: the database the core reads, and the photos' bytes. */
export type Garden = { db: Db; photo(filename: string): Uint8Array | undefined };

/**
 * Opens the Export in `zip` as the phone would import it (spec #35): into an in-memory SQLite,
 * migrated and seeded with the bundled catalog (an Export never carries it, ADR-0002), its photos
 * held in memory. Throws importExport's errors, NewerExportError for a newer phone's.
 */
export function openGarden(SQL: SqlJsStatic, zip: Uint8Array): Garden {
  const db = drizzle(new SQL.Database(), { schema });
  migrate(db);
  seedSpecies(db, species as SpeciesDataset);
  const photos = new Map<string, Uint8Array>();
  const files: PhotoFiles = {
    store: () => {
      throw new Error('The Web view takes no new photos');
    },
    write: (filename, bytes) => void photos.set(filename, bytes),
    read: (filename) => {
      const bytes = photos.get(filename);
      if (!bytes) throw new Error(`No file ${filename}`);
      return bytes;
    },
    remove: (filename) => void photos.delete(filename),
    removeAll: () => photos.clear(),
  };
  const scratch = new SQL.Database();
  try {
    importExport(db, files, drizzle(scratch, { schema }), zip);
  } finally {
    scratch.close();
  }
  return { db, photo: (filename) => photos.get(filename) };
}
