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

/**
 * The read-only Species catalog, seeded from the bundled dataset (assets/species.json) by
 * src/core/species.ts. Not user data: no timestamps or tombstones, never exported (ADR-0002),
 * replaced wholesale on reseed. Plants reference it by id; the reference is app-layer (no FK).
 */
export const species = sqliteTable('species', {
  /** Wikidata item ID of the taxon, e.g. Q161077 (ADR-0004). Stable, append-only, never reused. */
  id: text('id').primaryKey(),
  colloquialName: text('colloquial_name').notNull(),
  scientificName: text('scientific_name').notNull(),
  /** Care defaults: null means no schedule for that care type (CONTEXT.md, Care Schedule) ... */
  wateringGrowingDays: integer('watering_growing_days'),
  /** ... except a null Dormant interval under a set Growing interval, which means Paused. */
  wateringDormantDays: integer('watering_dormant_days'),
  fertilizingGrowingDays: integer('fertilizing_growing_days'),
  fertilizingDormantDays: integer('fertilizing_dormant_days'),
  repottingMonths: integer('repotting_months'),
});

/** Single row (id 1): the version of the bundled dataset the species table was last seeded from. */
export const speciesDataset = sqliteTable('species_dataset', {
  id: integer('id').primaryKey(),
  version: integer('version').notNull(),
});
