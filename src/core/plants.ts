import { and, eq, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';

import { CARE_TYPES, careEvents, photos, plants, species } from '../db/schema';
import type { Db } from '../db/types';
import type { CareEvent } from './careLog';
import { checkPastOrToday, localDay } from './dates';
import { deletePhotos, livePhotoJoin, removePhotoFiles, type PhotoFiles } from './photos';
import { getSpecies } from './species';

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
  if (speciesId && !getSpecies(db, speciesId)) {
    throw new Error(`Unknown species ${speciesId}`);
  }
  validatePlant(db, plant);
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
  'speciesId',
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
 * Edits a live Plant: its Species (one the catalog knows; Overrides stay, shadowing the new
 * Species' defaults), nickname, Current Pot, and its Override columns (ADR-0003: set a care type's
 * Growing or repotting interval to shadow the Species default; null the Growing interval to clear
 * the Override, Dormant included; a null Dormant interval inside a set Override is Paused).
 * Due-ness re-derives from the Care Log on the next evaluation, so a schedule edit takes effect at
 * once. Undefined entries leave the field as it is; timestamps and tombstones are never patchable.
 */
export function updatePlant(db: Db, id: string, patch: PlantPatch, now: Date = new Date()): Plant {
  const current = getPlant(db, id);
  const next: Plant = { ...current, updatedAt: now.toISOString() };
  for (const key of PATCHABLE) {
    if (patch[key] !== undefined) Object.assign(next, { [key]: patch[key] });
  }
  // An imported plant may keep a Species the catalog doesn't know (ADR-0002), but never take one.
  if (next.speciesId && next.speciesId !== current.speciesId && !getSpecies(db, next.speciesId)) {
    throw new Error(`Unknown species ${next.speciesId}`);
  }
  for (const { growing, dormant } of Object.values(SEASONAL)) {
    // Clearing an Override clears every value for that care type (ADR-0003).
    if (patch[growing] === null && patch[dormant] === undefined) next[dormant] = null;
  }
  next.nickname = trimToNull(next.nickname);
  next.soil = trimToNull(next.soil);
  validatePlant(db, next);
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

/** Brings an Archived plant back into care; due-ness picks up from its Care Log as it stands. */
export function unarchivePlant(db: Db, id: string, now: Date = new Date()): Plant {
  getPlant(db, id);
  const stamp = now.toISOString();
  db.update(plants).set({ archivedAt: null, updatedAt: stamp }).where(eq(plants.id, id)).run();
  return getPlant(db, id);
}

/**
 * Deletes a live plant, Archived or not (CONTEXT.md, Deleted): the plant, its Care Log and its
 * photo stay as tombstones, so the deletion survives Export and Import (ADR-0002), and the photo's
 * file is removed once they are in. Care Events Deleted earlier keep their own tombstones.
 */
export function deletePlant(db: Db, files: PhotoFiles, id: string, now: Date = new Date()): Plant {
  getPlant(db, id);
  const stamp = now.toISOString();
  const tombstone = { updatedAt: stamp, deletedAt: stamp };
  const { plant, filenames } = db.transaction((tx) => {
    tx.update(careEvents)
      .set(tombstone)
      .where(and(eq(careEvents.plantId, id), isNull(careEvents.deletedAt)))
      .run();
    const filenames = deletePhotos(tx, id, stamp);
    const plant = tx.update(plants).set(tombstone).where(eq(plants.id, id)).returning().get();
    return { plant, filenames };
  });
  removePhotoFiles(files, filenames);
  return plant;
}

/** Every plant row, Deleted ones included as tombstones: the plants table an Export carries (ADR-0002). */
export function listPlantRows(db: Db): Plant[] {
  return db.select().from(plants).orderBy(plants.createdAt).all();
}

/** Whether the Garden has no plants, Archived or not: a new install, or one after Erase all data. */
export function isGardenEmpty(db: Db): boolean {
  return !listPlantRows(db).some((plant) => plant.deletedAt === null);
}

/** Whether a plant's Override for `type` is set (ADR-0003): its Growing interval, or repotting's months, is. */
export function hasOverride(plant: CareSchedule, type: CareType): boolean {
  return (type === 'repot' ? plant.repottingMonths : plant[SEASONAL[type].growing]) !== null;
}

/** The Display Name rule (CONTEXT.md) in SQL, for queries joining plants to species. */
export const displayNameSql = sql<string>`coalesce(${plants.nickname}, ${species.colloquialName})`;

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

/** Live, non-Archived plants by Display Name, with their photo (CONTEXT.md: the default Garden view). */
export function listPlants(db: Db): PlantListItem[] {
  return plantList(db, isNull(plants.archivedAt));
}

/** Archived plants by Display Name, with their photo and when they were Archived: the archived view. */
export function listArchivedPlants(db: Db): PlantListItem[] {
  return plantList(db, isNotNull(plants.archivedAt));
}

export type PlantListItem = ReturnType<typeof plantList>[number];

function plantList(db: Db, scope: SQL) {
  return db
    .select({
      id: plants.id,
      displayName: displayNameSql.as('display_name'),
      scientificName: species.scientificName,
      photo: photos.filename,
      archivedAt: plants.archivedAt,
    })
    .from(plants)
    .leftJoin(species, eq(plants.speciesId, species.id))
    .leftJoin(photos, livePhotoJoin)
    .where(and(isNull(plants.deletedAt), scope))
    .orderBy(sql`${displayNameSql} COLLATE NOCASE`)
    .all();
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
 * What every stored Plant row satisfies: trimmed text, the Display Name rule (a nickname unless
 * the catalog knows the plant's species; an Import can leave one it doesn't, ADR-0002), a positive
 * pot size, and valid Override columns, which for a species-less plant are its whole schedule and must
 * cover at least one care type.
 */
export function validatePlant(db: Db, plant: Plant): void {
  checkTrimmed('Nickname', plant.nickname);
  checkTrimmed('Soil', plant.soil);
  if (!plant.nickname && !(plant.speciesId && getSpecies(db, plant.speciesId))) {
    throw new Error('A plant without a known species needs a nickname');
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

/** Free text as stored: trimmed, and null when blank or missing. */
export function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Throws unless `value` is free text as stored (trimToNull's), for a row the core did not write. */
export function checkTrimmed(label: string, value: string | null): void {
  if (value !== trimToNull(value)) {
    throw new Error(`${label} must not be blank or have spaces around it: "${value}"`);
  }
}
