import { and, eq, isNull, max } from 'drizzle-orm';

import { careEvents, photos, plants, species } from '../db/schema';
import type { Db } from '../db/types';
import { daysBetween, isCalendarDay, localDay, shiftDays, shiftMonths } from './dates';
import {
  CARE_TYPES,
  NO_SCHEDULE,
  SEASONAL,
  displayNameSql,
  hasOverride,
  type CareSchedule,
  type CareType,
} from './plants';
import { livePhotoJoin } from './photos';
import { getSettings, type Settings } from './settings';

/**
 * The care engine (spec #8): what is Due, Overdue, Paused and which plants Need Attention, derived
 * on every call from the Care Log, the effective schedules and the Season settings. Nothing is
 * stored, so season flips, schedule edits and backdated events self-correct.
 */

export type CareStatus =
  /** No effective schedule for this care type: never Due (CONTEXT.md, Care Schedule). */
  | { state: 'unscheduled' }
  /** Dormant season with no Dormant interval (CONTEXT.md, Paused); `until` is the first Growing day. */
  | { state: 'paused'; until: string }
  | { state: 'upcoming'; dueOn: string }
  /** Due today when daysOverdue is 0, Overdue past that; persists until logged. */
  | { state: 'due'; dueOn: string; daysOverdue: number };

export type PlantCare = {
  id: string;
  displayName: string;
  scientificName: string | null;
  /** The Species' pet toxicity; null without a Species the catalog knows. */
  toxicToPets: boolean | null;
  /** The live photo's filename (src/core/photos.ts); null when the plant has none. */
  photo: string | null;
  care: Record<CareType, CareStatus>;
};

type SeasonMonths = Pick<Settings, 'growingStartMonth' | 'growingEndMonth'>;

type SeasonOn =
  /** startsOn is null when the Growing season runs all year and so never started. */
  | { season: 'growing'; startsOn: string | null }
  | { season: 'dormant'; startsOn: string; resumesOn: string };

/**
 * Every live, non-Archived plant with the status of each care type on `today` (a local calendar
 * day), plants with the most Overdue care first, then by Display Name.
 */
export function evaluateCare(db: Db, today: string = localDay(new Date())): PlantCare[] {
  return forecastCare(db)(today);
}

/**
 * evaluateCare for any day, from one read of the database: every plant in care as it will be on
 * that day if nothing is logged or changed before then. The Daily Digest planner asks it day after
 * day.
 */
export function forecastCare(db: Db): (day: string) => PlantCare[] {
  const settings = getSettings(db);
  const lastDone = new Map<string, string>();
  const latest = db
    .select({ plantId: careEvents.plantId, type: careEvents.type, on: max(careEvents.occurredOn) })
    .from(careEvents)
    .where(isNull(careEvents.deletedAt))
    .groupBy(careEvents.plantId, careEvents.type)
    .all();
  for (const row of latest) if (row.on) lastDone.set(`${row.plantId}/${row.type}`, row.on);

  const inCare = db
    .select({ plant: plants, species, displayName: displayNameSql, photo: photos.filename })
    .from(plants)
    .leftJoin(species, eq(plants.speciesId, species.id))
    .leftJoin(photos, livePhotoJoin)
    .where(and(isNull(plants.deletedAt), isNull(plants.archivedAt)))
    .all()
    .map(({ plant, species, displayName, photo }) => {
      const schedule = effectiveSchedule(plant, species);
      // A care type never logged anchors to the local day of creation (ADR-0005).
      const anchor = localDay(new Date(plant.createdAt));
      const dueDays = {} as Record<CareType, DueBySeason>;
      for (const type of CARE_TYPES) {
        dueDays[type] = dueBySeason(type, schedule, lastDone.get(`${plant.id}/${type}`) ?? anchor);
      }
      return {
        plant: {
          id: plant.id,
          displayName,
          scientificName: species?.scientificName ?? null,
          toxicToPets: species?.toxicToPets ?? null,
          photo,
        },
        dueDays,
      };
    })
    // By Display Name once, so that each day only ranks by Overdue.
    .sort((a, b) => a.plant.displayName.localeCompare(b.plant.displayName));

  return (day) => {
    if (!isCalendarDay(day)) throw new Error(`Not a calendar day: ${day}`);
    const season = seasonOn(day, settings);
    // Most Overdue first; the sort is stable, so equals keep their Display Name order.
    return inCare
      .map(({ plant, dueDays }) => {
        const care = {} as Record<CareType, CareStatus>;
        for (const type of CARE_TYPES) care[type] = statusOn(dueDays[type], day, season);
        const evaluated: PlantCare = { ...plant, care };
        return { evaluated, worst: worstOverdue(evaluated) };
      })
      .sort((a, b) => b.worst - a.worst)
      .map(({ evaluated }) => evaluated);
  };
}

/** Plants that Need Attention (CONTEXT.md): at least one care type Due or Overdue on `today`. */
export function listNeedsAttention(db: Db, today: string = localDay(new Date())): PlantCare[] {
  return evaluateCare(db, today).filter(needsAttention);
}

/** A care type Due on the evaluated day; Overdue when daysOverdue is above 0. */
export type DueCare = { type: CareType; dueOn: string; daysOverdue: number };

/** An evaluated plant's Due care types, in care-type order. */
export function dueCare(plant: PlantCare): DueCare[] {
  return CARE_TYPES.flatMap((type) => {
    const status = plant.care[type];
    return status.state === 'due'
      ? [{ type, dueOn: status.dueOn, daysOverdue: status.daysOverdue }]
      : [];
  });
}

/** Whether an evaluated plant Needs Attention (CONTEXT.md): at least one care type Due or Overdue. */
export function needsAttention(plant: PlantCare): boolean {
  return dueCare(plant).length > 0;
}

/** Days Overdue of the plant's most Overdue care type; -1 when nothing is Due. */
function worstOverdue(plant: PlantCare): number {
  return Math.max(-1, ...dueCare(plant).map((due) => due.daysOverdue));
}

/**
 * Effective Care Schedule per care type (ADR-0003): the Override where its Growing (or repotting)
 * interval is set, else the Species default, else none.
 */
function effectiveSchedule(plant: CareSchedule, species: CareSchedule | null): CareSchedule {
  const fallback = species ?? NO_SCHEDULE;
  const source = (type: CareType) => (hasOverride(plant, type) ? plant : fallback);
  const water = source('water');
  const fertilize = source('fertilize');
  return {
    wateringGrowingDays: water.wateringGrowingDays,
    wateringDormantDays: water.wateringDormantDays,
    fertilizingGrowingDays: fertilize.fertilizingGrowingDays,
    fertilizingDormantDays: fertilize.fertilizingDormantDays,
    repottingMonths: source('repot').repottingMonths,
  };
}

/**
 * When a care type comes Due by Season, from its last Care Event (or the creation anchor) and its
 * effective schedule, before the clamp to the Season's first day: repotting on one day, watering
 * and fertilizing on one day per Season, a null Dormant day meaning Paused; null for no schedule.
 * All of due-ness that does not depend on the day evaluated, so a forecast works it out once.
 */
type DueBySeason =
  | { seasonal: false; on: string }
  | { seasonal: true; growing: string; dormant: string | null }
  | null;

function dueBySeason(type: CareType, schedule: CareSchedule, lastDone: string): DueBySeason {
  if (type === 'repot') {
    const months = schedule.repottingMonths;
    return months === null ? null : { seasonal: false, on: shiftMonths(lastDone, months) };
  }
  const { growing, dormant } = SEASONAL[type];
  const growingDays = schedule[growing];
  const dormantDays = schedule[dormant];
  if (growingDays === null) return null;
  return {
    seasonal: true,
    growing: shiftDays(lastDone, growingDays),
    dormant: dormantDays === null ? null : shiftDays(lastDone, dormantDays),
  };
}

/**
 * Due (CONTEXT.md): next due is the last matching Care Event (or the creation anchor) plus the
 * interval for today's Season, never earlier than the first day of that Season; repotting runs on
 * months with no seasonal variant and so is never clamped.
 */
function statusOn(due: DueBySeason, today: string, season: SeasonOn): CareStatus {
  if (due === null) return { state: 'unscheduled' };
  let dueOn: string;
  if (!due.seasonal) {
    dueOn = due.on;
  } else {
    if (season.season === 'dormant') {
      if (due.dormant === null) return { state: 'paused', until: season.resumesOn };
      dueOn = due.dormant;
    } else {
      dueOn = due.growing;
    }
    if (season.startsOn !== null && dueOn < season.startsOn) dueOn = season.startsOn;
  }
  if (today < dueOn) return { state: 'upcoming', dueOn };
  return { state: 'due', dueOn, daysOverdue: daysBetween(dueOn, today) };
}

/** The Season (CONTEXT.md) `day` falls in and when it started, from the growing-month range. */
function seasonOn(day: string, months: SeasonMonths): SeasonOn {
  const { growingStartMonth: start, growingEndMonth: end } = months;
  const [year, month] = day.split('-').map(Number);
  const dormantStart = (end % 12) + 1;
  if (isGrowingMonth(dormantStart, months)) return { season: 'growing', startsOn: null };
  if (isGrowingMonth(month, months)) {
    return { season: 'growing', startsOn: firstOf(month >= start ? year : year - 1, start) };
  }
  return {
    season: 'dormant',
    startsOn: firstOf(month >= dormantStart ? year : year - 1, dormantStart),
    resumesOn: firstOf(month < start ? year : year + 1, start),
  };
}

/** Growing runs from the start month through the end month inclusive, wrapping past December; equal months mean all year. */
function isGrowingMonth(
  month: number,
  { growingStartMonth: start, growingEndMonth: end }: SeasonMonths,
) {
  if (start === end) return true;
  return start < end ? month >= start && month <= end : month >= start || month <= end;
}

function firstOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}
