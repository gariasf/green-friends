import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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

/** A Plant (CONTEXT.md): one individual plant the user owns and cares for. */
export const plants = sqliteTable('plants', {
  id: text('id').primaryKey(),
  /** Species ID (ADR-0004); an app-layer reference kept verbatim even when unknown (ADR-0002). */
  speciesId: text('species_id'),
  /** Display Name = nickname, else the species colloquial name; required without a species. */
  nickname: text('nickname'),
  /** Current Pot (CONTEXT.md): directly editable, also set by the newest repot event. */
  potSizeCm: real('pot_size_cm'),
  soil: text('soil'),
  /**
   * Overrides (ADR-0003): a set Growing (or repotting) interval shadows the Species default for
   * that whole care type, null Dormant inside it meaning Paused; an unset interval means the
   * default applies. A species-less plant's schedule is Overrides only.
   */
  wateringGrowingDays: integer('watering_growing_days'),
  wateringDormantDays: integer('watering_dormant_days'),
  fertilizingGrowingDays: integer('fertilizing_growing_days'),
  fertilizingDormantDays: integer('fertilizing_dormant_days'),
  repottingMonths: integer('repotting_months'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  /** Archived (CONTEXT.md): no longer cared for, out of Needs Attention, Care Log kept; reversible. */
  archivedAt: text('archived_at'),
  deletedAt: text('deleted_at'),
});

/** The schedulable kinds of care (CONTEXT.md, Care Type) ... */
export const CARE_TYPES = ['water', 'fertilize', 'repot'] as const;
/** ... plus Notes, which are Care Events but not a care type. */
export const CARE_EVENT_TYPES = [...CARE_TYPES, 'note'] as const;

/** A Care Event (CONTEXT.md) in a plant's Care Log; all derived state comes from these rows. */
export const careEvents = sqliteTable('care_events', {
  id: text('id').primaryKey(),
  /** App-layer reference to plants.id (no FK, spec #8). */
  plantId: text('plant_id').notNull(),
  type: text('type', { enum: CARE_EVENT_TYPES }).notNull(),
  /** The local calendar day it happened, 'YYYY-MM-DD' (ADR-0005). */
  occurredOn: text('occurred_on').notNull(),
  /** Free text; the whole content of a Note. */
  note: text('note'),
  /** Repot payload: the new pot size and soil. */
  potSizeCm: real('pot_size_cm'),
  soil: text('soil'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});

/**
 * A plant's photo: at most one live row per plant; replacing it tombstones the old row. The image
 * itself is a file, never a blob (ADR-0001).
 */
export const photos = sqliteTable('photos', {
  id: text('id').primaryKey(),
  /** App-layer reference to plants.id (no FK, spec #8). */
  plantId: text('plant_id').notNull(),
  /**
   * The JPEG's name in the app's photo folder, `<id>.jpg`: relative, since the app container's
   * absolute path moves between installs, and unchanged by Export and Import (spec #8).
   */
  filename: text('filename').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
});
