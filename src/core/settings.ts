import { eq } from 'drizzle-orm';

import { settings } from '../db/schema';
import type { Db } from '../db/types';

/**
 * Settings are a single row. The fixed id makes two devices' settings the same row, so an
 * Import merges them by last-write-wins instead of duplicating them (ADR-0002).
 */
export const SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

export type Settings = typeof settings.$inferSelect;
export type SettingsPatch = Partial<Pick<Settings, 'growingStartMonth' | 'growingEndMonth'>>;

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

function validate(patch: SettingsPatch): void {
  for (const month of [patch.growingStartMonth, patch.growingEndMonth]) {
    if (month !== undefined && !(Number.isInteger(month) && month >= 1 && month <= 12)) {
      throw new Error(`Month must be an integer from 1 to 12, got ${month}`);
    }
  }
}
