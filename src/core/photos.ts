import { and, eq, isNull } from 'drizzle-orm';

import { photos, plants } from '../db/schema';
import type { Db } from '../db/types';

export type Photo = typeof photos.$inferSelect;

/** Joins a plant to its live photo, of which it has at most one. */
export const livePhotoJoin = and(eq(photos.plantId, plants.id), isNull(photos.deletedAt));

/**
 * The folder photo files live in, injected so the core stays plain TypeScript (ADR-0001): the app
 * hands in its documents directory, tests a fake. The core names the files and decides when they
 * come and go; the store only moves and reads them.
 */
export type PhotoFiles = {
  /** Moves the prepared JPEG at `source` into the folder as `filename`. */
  store(source: string, filename: string): void;
  /** The contents of `filename` in the folder; throws for a missing file. */
  read(filename: string): Uint8Array;
  /** Removes `filename` from the folder; a missing file is no error. */
  remove(filename: string): void;
  /** Removes every file from the folder, whatever names it. */
  removeAll(): void;
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
  const plant = db
    .select({ id: plants.id })
    .from(plants)
    .where(and(eq(plants.id, plantId), isNull(plants.deletedAt)))
    .get();
  if (!plant) throw new Error(`No plant ${plantId}`);
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
  // The file goes in before its row and out after it, so no live row ever lacks its file.
  // ponytail: a failure in between leaves an orphan file; sweep the folder if orphans ever matter.
  files.store(source, photo.filename);
  const replaced = db.transaction((tx) => {
    const old = deletePhotos(tx, plantId, stamp);
    tx.insert(photos).values(photo).run();
    return old;
  });
  removePhotoFiles(files, replaced);
  return photo;
}

/**
 * Deletes a plant's live photo within the caller's transaction, its row kept as a tombstone.
 * Returns the filenames for removePhotoFiles once that transaction commits.
 */
export function deletePhotos(tx: Db, plantId: string, stamp: string): string[] {
  const live = and(eq(photos.plantId, plantId), isNull(photos.deletedAt));
  const filenames = tx.select({ filename: photos.filename }).from(photos).where(live).all();
  tx.update(photos).set({ updatedAt: stamp, deletedAt: stamp }).where(live).run();
  return filenames.map((row) => row.filename);
}

/** Removes the files of tombstoned photos; one the store cannot remove only takes space. */
export function removePhotoFiles(files: PhotoFiles, filenames: string[]): void {
  for (const filename of filenames) {
    try {
      files.remove(filename);
    } catch {
      // The rows are tombstones already; nothing refers to the file.
    }
  }
}

/** Every photo row, Deleted ones included as tombstones: the photos table an Export carries (ADR-0002). */
export function listPhotoRows(db: Db): Photo[] {
  return db.select().from(photos).orderBy(photos.createdAt).all();
}
