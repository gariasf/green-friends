import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Every user-data table follows the sync disciplines from research #5 / spec #8:
 * client-generated TEXT UUID primary key, UTC ISO-8601 created_at/updated_at written only by
 * src/core mutations, and a deleted_at tombstone instead of physical deletes.
 */

/** App-level settings: a single row under a fixed id (SETTINGS_ID in src/core/settings.ts). */
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  /** Growing season runs from this month (1-12) ... */
  growingStartMonth: integer('growing_start_month').notNull(),
  /**
   * ... through this month (1-12) inclusive; may wrap past December (southern hemisphere).
   * Equal to growingStartMonth means Growing all year, never Dormant (CONTEXT.md, Season).
   */
  growingEndMonth: integer('growing_end_month').notNull(),
  /** Daily digest notification time, local, 'HH:MM'. */
  digestTime: text('digest_time').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});
