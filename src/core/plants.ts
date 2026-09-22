import { eq, isNull, sql } from 'drizzle-orm';

import { careEvents, plants, species } from '../db/schema';
import type { Db } from '../db/types';
import type { CareEvent, CareEventType } from './careLog';
import { isCalendarDay, localDay } from './dates';

export type Plant = typeof plants.$inferSelect;

/** The schedulable kinds of care (CONTEXT.md, Care Type); Notes are Care Events but not a care type. */
export type CareType = Exclude<CareEventType, 'note'>;
export const CARE_TYPES = ['water', 'fertilize', 'repot'] as const satisfies readonly CareType[];

/**
 * One plant's whole care schedule, as stored in its Override columns (ADR-0003): Growing and
 * Dormant intervals in days for watering and fertilizing (null Dormant = Paused), repotting in
 * months.
 */
export type CareSchedule = Pick<
  Plant,
  | 'wateringGrowingDays'
  | 'wateringDormantDays'
  | 'fertilizingGrowingDays'
  | 'fertilizingDormantDays'
  | 'repottingMonths'
> & { wateringGrowingDays: number; fertilizingGrowingDays: number; repottingMonths: number };

export type NewPlant = {
  speciesId?: string | null;
  nickname?: string | null;
  /** Current Pot (CONTEXT.md), for a plant entered mid-life. */
  potSizeCm?: number | null;
  soil?: string | null;
  /** Required without a species, whose defaults otherwise apply. */
  schedule?: CareSchedule;
  /**
   * "When did you last water / fertilize / repot it?", each answer a local calendar day
   * ('YYYY-MM-DD') that seeds a backdated Care Event so the first due date is right from day one.
   * Unanswered care types anchor their due-ness to the plant's creation (spec #8).
   */
  lastDone?: Partial<Record<CareType, string>>;
};

/** Creates a Plant. Timestamps come from the core clock (UTC ISO-8601), the id is a client UUID. */
export function createPlant(db: Db, input: NewPlant, now: Date = new Date()): Plant {
  const stamp = now.toISOString();
  const plant: Plant = {
    id: crypto.randomUUID(),
    speciesId: input.speciesId ?? null,
    nickname: trimToNull(input.nickname),
    potSizeCm: input.potSizeCm ?? null,
    soil: trimToNull(input.soil),
    wateringGrowingDays: null,
    wateringDormantDays: null,
    fertilizingGrowingDays: null,
    fertilizingDormantDays: null,
    repottingMonths: null,
    ...input.schedule,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  if (!plant.speciesId && !plant.nickname) {
    throw new Error('A plant without a species needs a nickname');
  }
  if (!plant.speciesId && !input.schedule) {
    throw new Error('A plant without a species needs its own care schedule');
  }
  if (plant.speciesId && !speciesExists(db, plant.speciesId)) {
    throw new Error(`Unknown species ${plant.speciesId}`);
  }
  if (plant.potSizeCm !== null && !(Number.isFinite(plant.potSizeCm) && plant.potSizeCm > 0)) {
    throw new Error(`Pot size must be positive, got ${plant.potSizeCm}`);
  }
  if (input.schedule) validateSchedule(input.schedule);
  const today = localDay(now);
  const seeded: CareEvent[] = CARE_TYPES.flatMap((type) => {
    const occurredOn = input.lastDone?.[type];
    if (!occurredOn) return [];
    if (!isCalendarDay(occurredOn)) throw new Error(`Not a calendar day: ${occurredOn}`);
    if (occurredOn > today) throw new Error(`Last ${type} day ${occurredOn} is in the future`);
    return {
      id: crypto.randomUUID(),
      plantId: plant.id,
      type,
      occurredOn,
      note: null,
      potSizeCm: null,
      soil: null,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };
  });
  db.transaction((tx) => {
    tx.insert(plants).values(plant).run();
    if (seeded.length > 0) tx.insert(careEvents).values(seeded).run();
  });
  return plant;
}

const INTERVALS: [key: keyof CareSchedule, label: string][] = [
  ['wateringGrowingDays', 'Growing-season watering interval'],
  ['wateringDormantDays', 'Dormant-season watering interval'],
  ['fertilizingGrowingDays', 'Growing-season fertilizing interval'],
  ['fertilizingDormantDays', 'Dormant-season fertilizing interval'],
  ['repottingMonths', 'Repotting interval'],
];

/** Every interval is a whole positive number of days or months; only a Dormant one may be null (Paused). */
function validateSchedule(schedule: CareSchedule): void {
  for (const [key, label] of INTERVALS) {
    const value = schedule[key];
    if (value === null && key.endsWith('DormantDays')) continue;
    if (value === null || !Number.isInteger(value) || value <= 0) {
      throw new Error(`${label} must be a whole positive number, got ${value}`);
    }
  }
}

function speciesExists(db: Db, id: string): boolean {
  return !!db.select({ id: species.id }).from(species).where(eq(species.id, id)).get();
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const displayName = sql<string>`coalesce(${plants.nickname}, ${species.colloquialName})`;

/**
 * Live plants by Display Name (CONTEXT.md), as a query so the UI can subscribe with
 * useLiveQuery; listPlants runs it.
 */
export function plantListQuery(db: Db) {
  return db
    .select({
      id: plants.id,
      displayName: displayName.as('display_name'),
      scientificName: species.scientificName,
    })
    .from(plants)
    .leftJoin(species, eq(plants.speciesId, species.id))
    .where(isNull(plants.deletedAt))
    .orderBy(sql`${displayName} COLLATE NOCASE`);
}

export type PlantListItem = ReturnType<typeof plantListQuery>['_']['result'][number];

export function listPlants(db: Db): PlantListItem[] {
  return plantListQuery(db).all();
}
