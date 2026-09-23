import { and, eq, isNull } from 'drizzle-orm';

import { photos } from '../db/schema';
import type { Db } from '../db/types';
import { getPlant } from './plants';

export type Photo = typeof photos.$inferSelect;

/**
 * The folder photo files live in, injected so the core stays plain TypeScript (ADR-0001): the app
 * hands in its documents directory, tests a fake. The core names the files and decides when they
 * come and go; the store only moves them.
 */
export type PhotoFiles = {
  /** Moves the prepared JPEG at `source` into the folder as `filename`. */
  store(source: string, filename: string): void;
  /** Removes `filename` from the folder; a missing file is no error. */
  remove(filename: string): void;
};

/**
 * Makes the prepared JPEG at `source` (resized and compressed by the caller) a live plant's one
 * photo, filed under the new row's UUID. The photo it replaces is Deleted, its row kept as a
 * tombstone so the deletion survives Export and Import (ADR-0002), and its file removed.
 */
export function setPlantPhoto(
  db: Db,
  files: PhotoFiles,
  plantId: string,
  source: string,
  now: Date = new Date(),
): Photo {
  getPlant(db, plantId);
  const stamp = now.toISOString();
  const id = crypto.randomUUID();
  const photo: Photo = {
    id,
    plantId,
    filename: `${id}.jpg`,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  const live = and(eq(photos.plantId, plantId), isNull(photos.deletedAt));
  const replaced = db.select({ filename: photos.filename }).from(photos).where(live).all();
  // The file goes in before its row and out after it, so no live row ever lacks its file.
  // ponytail: a failure in between leaves an orphan file; sweep the folder if orphans ever matter.
  files.store(source, photo.filename);
  db.transaction((tx) => {
    tx.update(photos).set({ updatedAt: stamp, deletedAt: stamp }).where(live).run();
    tx.insert(photos).values(photo).run();
  });
  for (const { filename } of replaced) {
    try {
      files.remove(filename);
    } catch {
      // The new photo is in; an old file left behind only takes space.
    }
  }
  return photo;
}

/** Every photo row, Deleted ones included as tombstones: the photos table an Export carries (ADR-0002). */
export function listPhotoRows(db: Db): Photo[] {
  return db.select().from(photos).orderBy(photos.createdAt).all();
}
