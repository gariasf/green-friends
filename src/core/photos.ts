import { and, desc, eq, isNull } from 'drizzle-orm';

import { photos, plants } from '../db/schema';
import type { Db } from '../db/types';

export type Photo = typeof photos.$inferSelect;

/**
 * A photo's Focal point (spec #67): where the plant is, x and y from its top-left, 0 to 1, with
 * the photo's width over its height, which framing it needs.
 */
export type Focus = { x: number; y: number; aspect: number };

/**
 * Where a photo sits in a frame of `frameAspect` (width over height) it covers, as CSS's
 * object-position fractions: the Focal point as near the frame's centre as the photo's edges
 * allow. Only one axis overflows a cover; the other, and a photo with no point, stays centred.
 */
export function framePosition(focus: Focus | null, frameAspect: number): { x: number; y: number } {
  if (!focus) return { x: 0.5, y: 0.5 };
  // The covering photo's length along the axis that overflows, in frame lengths.
  const wide = focus.aspect / frameAspect;
  const slide = (point: number, length: number) =>
    length <= 1 ? 0.5 : round(Math.min(1, Math.max(0, (point * length - 0.5) / (length - 1))));
  return { x: slide(focus.x, wide), y: slide(focus.y, 1 / wide) };
}

/** To a ten-thousandth, so framing a point comes out as the point's own worked example. */
function round(fraction: number): number {
  return Math.round(fraction * 10000) / 10000;
}

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
  /** Writes `bytes` into the folder as `filename`, over any file of that name: an imported photo. */
  write(filename: string, bytes: Uint8Array): void;
  /** The contents of `filename` in the folder; throws for a missing file. */
  read(filename: string): Uint8Array;
  /** Removes `filename` from the folder; a missing file is no error. */
  remove(filename: string): void;
  /** Removes every file from the folder, whatever names it. */
  removeAll(): void;
};

/**
 * A live photo's Focal point beside its filename, for a read joined through livePhotoJoin; null
 * for a photo without one (framed on its centre) or no photo at all.
 */
export const focusColumns = { x: photos.focusX, y: photos.focusY, aspect: photos.aspect };

/** A read's focusColumns as a Focus, or null where the photo has none. */
export function toFocus(
  columns: {
    x: number | null;
    y: number | null;
    aspect: number | null;
  } | null,
): Focus | null {
  if (!columns || columns.x === null || columns.y === null || columns.aspect === null) return null;
  return { x: columns.x, y: columns.y, aspect: columns.aspect };
}

/**
 * Makes the prepared JPEG at `source` (resized and compressed by the caller) a live plant's one
 * photo, filed under the new row's UUID, framed on `focus` (none is its centre). The photo it
 * replaces is Deleted, its row kept as a tombstone so the deletion survives Export and Import
 * (ADR-0002), and its file removed.
 */
export function setPlantPhoto(
  db: Db,
  files: PhotoFiles,
  plantId: string,
  source: string,
  focus: Focus | null = null,
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
    focusX: focus?.x ?? null,
    focusY: focus?.y ?? null,
    aspect: focus?.aspect ?? null,
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

/** The filenames of every live photo. */
export function livePhotoFiles(db: Db): Set<string> {
  const live = db
    .select({ filename: photos.filename })
    .from(photos)
    .where(isNull(photos.deletedAt));
  return new Set(live.all().map((photo) => photo.filename));
}

/**
 * What every stored photo row satisfies: its file is named `<its id>.jpg`, as setPlantPhoto names
 * it. With a UUID for an id, that name is a bare one, inside the photo folder. Its Focal point is
 * whole or absent, on the photo, with a width over a height for its aspect.
 */
export function validatePhoto(photo: Photo): void {
  if (photo.filename !== `${photo.id}.jpg`) {
    throw new Error(`A photo's file must be named <its id>.jpg, not ${photo.filename}`);
  }
  const { focusX: x, focusY: y, aspect } = photo;
  if (x === null && y === null && aspect === null) return;
  if (x === null || y === null || aspect === null) {
    throw new Error("A photo's Focal point needs its x, y and aspect together");
  }
  const onIt = (at: unknown) => typeof at === 'number' && at >= 0 && at <= 1;
  if (!onIt(x) || !onIt(y)) {
    throw new Error(`A photo's Focal point must be on it, from 0 to 1, not ${x}, ${y}`);
  }
  if (!(typeof aspect === 'number' && aspect > 0 && Number.isFinite(aspect))) {
    throw new Error(`A photo's aspect must be a width over a height, not ${aspect}`);
  }
}

/**
 * At most one live photo per plant, within the caller's transaction: where an Import left a plant
 * more than one, each device having given it a new photo, the newest stays, as if it were taken
 * last, and the others are Deleted, their rows kept as tombstones and their files for the caller
 * to remove once the transaction commits (ADR-0002).
 */
export function keepNewestPhotos(tx: Db, stamp: string): void {
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
