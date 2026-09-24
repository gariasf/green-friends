import { eq } from 'drizzle-orm';

import { careEvents, photos, plants, settings } from '../db/schema';
import type { Db } from '../db/types';
import type { PhotoFiles } from './photos';

/**
 * Settings are a single row. The fixed id makes two devices' settings the same row, so an
 * Import merges them by last-write-wins instead of duplicating them (ADR-0002).
 */
export const SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

export type Settings = typeof settings.$inferSelect;
export type SettingsPatch = Partial<
  Pick<Settings, 'growingStartMonth' | 'growingEndMonth' | 'digestTime'>
>;

export function getSettings(db: Db): Settings {
  const row = db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).get();
  if (!row) throw new Error('Settings row missing: the database has not been migrated');
  return row;
}

/** Applies a validated patch, stamping updated_at from the core clock (UTC ISO-8601). */
export function updateSettings(db: Db, patch: SettingsPatch, now: Date = new Date()): Settings {
  validate(patch);
  db.update(settings)
    .set({ ...patch, updatedAt: now.toISOString() })
    .where(eq(settings.id, SETTINGS_ID))
    .run();
  return getSettings(db);
}

/** The settings of a first launch, as migration 0000 seeds them. */
const FIRST_LAUNCH = {
  growingStartMonth: 3,
  growingEndMonth: 10,
  digestTime: '09:00',
  // The epoch, so that any settings row an Import brings wins the merge (ADR-0002).
  createdAt: '1970-01-01T00:00:00.000Z',
  updatedAt: '1970-01-01T00:00:00.000Z',
  deletedAt: null,
} satisfies Omit<Settings, 'id'>;

/**
 * Erase all data: every plant, Care Event and photo row goes, tombstones too, and the settings are
 * those of a first launch, so an Import afterwards restores its Export as it was (the hard reset of
 * ADR-0002). The Species catalog is not user data and stays. Every photo file goes once the rows
 * have; should that fail, it throws with the rows already gone, and erasing again finishes.
 */
export function eraseAllData(db: Db, files: PhotoFiles): void {
  db.transaction((tx) => {
    tx.delete(careEvents).run();
    tx.delete(photos).run();
    tx.delete(plants).run();
    // SQLite reports no row of a DELETE without WHERE to change listeners (the truncate
    // optimization): this update is what the screens and the digest projection hear.
    tx.update(settings).set(FIRST_LAUNCH).where(eq(settings.id, SETTINGS_ID)).run();
  });
  files.removeAll();
}

function validate(patch: SettingsPatch): void {
  for (const month of [patch.growingStartMonth, patch.growingEndMonth]) {
    if (month !== undefined && !(Number.isInteger(month) && month >= 1 && month <= 12)) {
      throw new Error(`Month must be an integer from 1 to 12, got ${month}`);
    }
  }
  if (patch.digestTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(patch.digestTime)) {
    throw new Error(`Digest time must be HH:MM from 00:00 to 23:59, got ${patch.digestTime}`);
  }
}
