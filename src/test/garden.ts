import { seedSpecies, type Species } from '../core/species';
import type { Db } from '../db/types';
import { openTestDb } from './db';

/**
 * A pinned two-species catalog for the core seam tests. Every due date the tests expect follows
 * these intervals, not the bundled dataset, which the catalog build (#20) regenerates.
 */
export const catalog = {
  /** Watered every 7 days (14 in the Dormant season), fed monthly and never in winter, repotted every 24 months. */
  monstera: {
    id: 'Q161077',
    scientificName: 'Monstera deliciosa',
    colloquialName: 'Monstera',
    wateringGrowingDays: 7,
    wateringDormantDays: 14,
    fertilizingGrowingDays: 30,
    fertilizingDormantDays: null,
    repottingMonths: 24,
  },
  pothos: {
    id: 'Q161809',
    scientificName: 'Epipremnum aureum',
    colloquialName: 'Pothos',
    wateringGrowingDays: 7,
    wateringDormantDays: 14,
    fertilizingGrowingDays: 30,
    fertilizingDormantDays: null,
    repottingMonths: 24,
  },
} satisfies Record<string, Species>;

export const MONSTERA = catalog.monstera.id;
export const POTHOS = catalog.pothos.id;

/** Local noon, so the calendar day is the same in every timezone the tests run in. */
export const noon = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day, 12);
export const NOON_SEP_22 = noon(2026, 9, 22);

/** A migrated database with the pinned catalog seeded, as after first launch. */
export function gardenDb(): Db {
  const db = openTestDb();
  seedSpecies(db, { version: 1, species: Object.values(catalog) });
  return db;
}
