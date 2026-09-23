import { and, eq, isNull, sql } from 'drizzle-orm';

import { CARE_TYPES, careEvents, photos, plants, species } from '../db/schema';
import type { Db } from '../db/types';
import type { CareEvent } from './careLog';
import { checkPastOrToday, localDay } from './dates';

export { CARE_TYPES };

export type Plant = typeof plants.$inferSelect;
export type CareType = (typeof CARE_TYPES)[number];

/**
 * One plant's own care schedule, as stored in its Override columns (ADR-0003): per care type a
 * Growing interval in days (repotting: in months) and, for watering and fertilizing, a Dormant
 * interval where null means Paused. A null Growing or repotting interval means no schedule for
 * that care type, which is then never Due (CONTEXT.md, Care Schedule).
 */
export type CareSchedule = Pick<
  Plant,
  | 'wateringGrowingDays'
  | 'wateringDormantDays'
  | 'fertilizingGrowingDays'
  | 'fertilizingDormantDays'
  | 'repottingMonths'
>;

export type NewPlant = {
  speciesId?: string | null;
  nickname?: string | null;
  /** Current Pot (CONTEXT.md), for a plant entered mid-life. */
  potSizeCm?: number | null;
  soil?: string | null;
  /**
   * A species-less plant's own schedule, at least one care type. A plant with a species inherits
   * the species defaults instead.
   */
  schedule?: CareSchedule;
  /**
   * "When did you last water / fertilize / repot it?", each answer a local calendar day
   * ('YYYY-MM-DD') that seeds a backdated Care Event so the first due date is right from day one.
   * Unanswered care types anchor their due-ness to the plant's creation (spec #8).
   */
  lastDone?: Partial<Record<CareType, string>>;
};

/** No schedule for any care type: what a plant starts from, and what one without a species falls back to. */
export const NO_SCHEDULE: CareSchedule = {
  wateringGrowingDays: null,
  wateringDormantDays: null,
  fertilizingGrowingDays: null,
  fertilizingDormantDays: null,
  repottingMonths: null,
};

/**
 * Creates a Plant and its seeded Care Events in one transaction. Timestamps come from the core
 * clock (UTC ISO-8601), ids are client UUIDs.
 */
export function createPlant(db: Db, input: NewPlant, now: Date = new Date()): Plant {
  const stamp = now.toISOString();
  const speciesId = trimToNull(input.speciesId);
  const plant: Plant = {
    id: crypto.randomUUID(),
    speciesId,
    nickname: trimToNull(input.nickname),
    potSizeCm: input.potSizeCm ?? null,
    soil: trimToNull(input.soil),
    ...NO_SCHEDULE,
    ...input.schedule,
    createdAt: stamp,
    updatedAt: stamp,
    archivedAt: null,
    deletedAt: null,
  };
  if (speciesId && input.schedule) {
    throw new Error('A plant with a species inherits its care schedule from the species');
  }
  if (speciesId && !speciesExists(db, speciesId)) {
    throw new Error(`Unknown species ${speciesId}`);
  }
  validatePlant(plant);
  const today = localDay(now);
  const seeded: CareEvent[] = CARE_TYPES.flatMap((type) => {
    const occurredOn = input.lastDone?.[type];
    if (!occurredOn) return [];
    checkPastOrToday(occurredOn, today);
    // A repot event records the pot it left the plant in (CONTEXT.md, Current Pot).
    const repot = type === 'repot';
    return {
      id: crypto.randomUUID(),
      plantId: plant.id,
      type,
      occurredOn,
      note: null,
      potSizeCm: repot ? plant.potSizeCm : null,
      soil: repot ? plant.soil : null,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };
  });
  db.transaction((tx) => {
    tx.insert(plants).values(plant).run();
    if (seeded.length > 0) tx.insert(careEvents).values(seeded).run();
  });
  return getPlant(db, plant.id);
}

/** A live Plant by id, Archived or not; throws for an unknown or Deleted one. */
export function getPlant(db: Db, id: string): Plant {
  const plant = db
    .select()
    .from(plants)
    .where(and(eq(plants.id, id), isNull(plants.deletedAt)))
    .get();
  if (!plant) throw new Error(`No plant ${id}`);
  return plant;
}

/** The columns updatePlant may change; anything else on a patch object is ignored. */
const PATCHABLE = [
  'nickname',
  'potSizeCm',
  'soil',
  'wateringGrowingDays',
  'wateringDormantDays',
  'fertilizingGrowingDays',
  'fertilizingDormantDays',
  'repottingMonths',
] as const satisfies readonly (keyof Plant)[];

export type PlantPatch = Partial<Pick<Plant, (typeof PATCHABLE)[number]>>;

/**
 * Edits a live Plant: nickname, Current Pot, and its Override columns (ADR-0003: set a care type's
 * Growing or repotting interval to shadow the Species default; null the Growing interval to clear
 * the Override, Dormant included; a null Dormant interval inside a set Override is Paused).
 * Due-ness re-derives from the Care Log on the next evaluation, so a schedule edit takes effect at
 * once. Undefined entries leave the field as it is; timestamps and tombstones are never patchable.
 */
export function updatePlant(db: Db, id: string, patch: PlantPatch, now: Date = new Date()): Plant {
  const next: Plant = { ...getPlant(db, id), updatedAt: now.toISOString() };
  for (const key of PATCHABLE) {
    if (patch[key] !== undefined) Object.assign(next, { [key]: patch[key] });
  }
  for (const { growing, dormant } of Object.values(SEASONAL)) {
    // Clearing an Override clears every value for that care type (ADR-0003).
    if (patch[growing] === null && patch[dormant] === undefined) next[dormant] = null;
  }
  next.nickname = trimToNull(next.nickname);
  next.soil = trimToNull(next.soil);
  validatePlant(next);
  db.update(plants).set(next).where(eq(plants.id, id)).run();
  return getPlant(db, id);
}

/**
 * Archives a live Plant (CONTEXT.md): it leaves Needs Attention, its Care Log and Current Pot are
 * kept, and getPlant still finds it.
 */
export function archivePlant(db: Db, id: string, now: Date = new Date()): Plant {
  getPlant(db, id);
  const stamp = now.toISOString();
  db.update(plants).set({ archivedAt: stamp, updatedAt: stamp }).where(eq(plants.id, id)).run();
  return getPlant(db, id);
}

/** The Display Name rule (CONTEXT.md) in SQL, for queries joining plants to species. */
export const displayNameSql = sql<string>`coalesce(${plants.nickname}, ${species.colloquialName})`;

/** Joins a plant to its live photo, of which it has at most one (src/core/photos.ts). */
export const livePhotoJoin = and(eq(photos.plantId, plants.id), isNull(photos.deletedAt));

/** A live plant's Display Name, Archived or not; throws for an unknown or Deleted one. */
export function getDisplayName(db: Db, id: string): string {
  const row = db
    .select({ displayName: displayNameSql })
    .from(plants)
    .leftJoin(species, eq(plants.speciesId, species.id))
    .where(and(eq(plants.id, id), isNull(plants.deletedAt)))
    .get();
  if (!row) throw new Error(`No plant ${id}`);
  return row.displayName;
}

/**
 * Live, non-Archived plants by Display Name (CONTEXT.md: the default Garden view), as a query so
 * the UI can subscribe with useLiveQuery; listPlants runs it.
 */
export function plantListQuery(db: Db) {
  return db
    .select({
      id: plants.id,
      displayName: displayNameSql.as('display_name'),
      scientificName: species.scientificName,
      photo: photos.filename,
    })
    .from(plants)
    .leftJoin(species, eq(plants.speciesId, species.id))
    .leftJoin(photos, livePhotoJoin)
    .where(and(isNull(plants.deletedAt), isNull(plants.archivedAt)))
    .orderBy(sql`${displayNameSql} COLLATE NOCASE`);
}

export type PlantListItem = Awaited<ReturnType<typeof plantListQuery>>[number];

export function listPlants(db: Db): PlantListItem[] {
  return plantListQuery(db).all();
}

/** The schedule columns of the two seasonal care types (CONTEXT.md, Season). */
export const SEASONAL = {
  water: { care: 'watering', growing: 'wateringGrowingDays', dormant: 'wateringDormantDays' },
  fertilize: {
    care: 'fertilizing',
    growing: 'fertilizingGrowingDays',
    dormant: 'fertilizingDormantDays',
  },
} as const satisfies Record<
  Exclude<CareType, 'repot'>,
  { care: string; growing: keyof CareSchedule; dormant: keyof CareSchedule }
>;

/**
 * What every stored Plant row satisfies: the Display Name rule (a nickname when there is no
 * species), a positive pot size, and valid Override columns, which for a species-less plant are
 * its whole schedule and must cover at least one care type.
 */
function validatePlant(plant: Plant): void {
  if (!plant.speciesId && !plant.nickname) {
    throw new Error('A plant without a species needs a nickname');
  }
  checkPotSize(plant.potSizeCm);
  validateSchedule(plant, plant.speciesId === null);
}

/**
 * Whole positive intervals, and a Dormant interval only under a Growing one (ADR-0003: clearing
 * an Override clears the whole care type).
 */
function validateSchedule(schedule: CareSchedule, requireOne: boolean): void {
  for (const { care, growing, dormant } of Object.values(SEASONAL)) {
    checkInterval(`Growing-season ${care} interval`, schedule[growing]);
    checkInterval(`Dormant-season ${care} interval`, schedule[dormant]);
    if (schedule[dormant] !== null && schedule[growing] === null) {
      throw new Error(`A Dormant-season ${care} interval needs a Growing-season one`);
    }
  }
  checkInterval('Repotting interval', schedule.repottingMonths);
  if (
    requireOne &&
    schedule.wateringGrowingDays === null &&
    schedule.fertilizingGrowingDays === null &&
    schedule.repottingMonths === null
  ) {
    throw new Error('A plant without a species needs its own care schedule');
  }
}

/** Null is unset; anything else is a whole positive number of days or months. */
function checkInterval(label: string, value: number | null): void {
  if (value !== null && !(Number.isInteger(value) && value > 0)) {
    throw new Error(`${label} must be a whole positive number, got ${value}`);
  }
}

/** Null is unset; anything else is a positive size in cm. */
export function checkPotSize(value: number | null): void {
  if (value !== null && !(Number.isFinite(value) && value > 0)) {
    throw new Error(`Pot size must be positive, got ${value}`);
  }
}

function speciesExists(db: Db, id: string): boolean {
  return !!db.select({ id: species.id }).from(species).where(eq(species.id, id)).get();
}

/** Free text as stored: trimmed, and null when blank or missing. */
export function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
