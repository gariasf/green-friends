import { and, eq, isNull, max } from 'drizzle-orm';

import { careEvents, plants, species } from '../db/schema';
import type { Db } from '../db/types';
import { daysBetween, isCalendarDay, localDay, shiftDays, shiftMonths } from './dates';
import {
  CARE_TYPES,
  NO_SCHEDULE,
  SEASONAL,
  displayNameSql,
  type CareSchedule,
  type CareType,
} from './plants';
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
  if (!isCalendarDay(today)) throw new Error(`Not a calendar day: ${today}`);
  const season = seasonOn(today, getSettings(db));
  const lastDone = new Map<string, string>();
  const latest = db
    .select({ plantId: careEvents.plantId, type: careEvents.type, on: max(careEvents.occurredOn) })
    .from(careEvents)
    .where(isNull(careEvents.deletedAt))
    .groupBy(careEvents.plantId, careEvents.type)
    .all();
  for (const row of latest) if (row.on) lastDone.set(`${row.plantId}/${row.type}`, row.on);

  const rows = db
    .select({ plant: plants, species, displayName: displayNameSql })
    .from(plants)
    .leftJoin(species, eq(plants.speciesId, species.id))
    .where(and(isNull(plants.deletedAt), isNull(plants.archivedAt)))
    .all();

  return rows
    .map(({ plant, species, displayName }): PlantCare => {
      const schedule = effectiveSchedule(plant, species);
      // A care type never logged anchors to the local day of creation (ADR-0005).
      const anchor = localDay(new Date(plant.createdAt));
      const care = {} as Record<CareType, CareStatus>;
      for (const type of CARE_TYPES) {
        const last = lastDone.get(`${plant.id}/${type}`) ?? anchor;
        care[type] = statusOn(type, schedule, last, today, season);
      }
      return { id: plant.id, displayName, scientificName: species?.scientificName ?? null, care };
    })
    .sort(
      (a, b) => worstOverdue(b) - worstOverdue(a) || a.displayName.localeCompare(b.displayName),
    );
}

/** Plants that Need Attention (CONTEXT.md): at least one care type Due or Overdue on `today`. */
export function listNeedsAttention(db: Db, today: string = localDay(new Date())): PlantCare[] {
  return evaluateCare(db, today).filter(needsAttention);
}

function needsAttention(plant: PlantCare): boolean {
  return CARE_TYPES.some((type) => plant.care[type].state === 'due');
}

/** Days Overdue of the plant's most Overdue care type; -1 when nothing is Due. */
function worstOverdue(plant: PlantCare): number {
  return Math.max(
    -1,
    ...CARE_TYPES.map((type) => {
      const status = plant.care[type];
      return status.state === 'due' ? status.daysOverdue : -1;
    }),
  );
}

/**
 * Effective Care Schedule per care type (ADR-0003): the Override where its Growing (or repotting)
 * interval is set, else the Species default, else none.
 */
function effectiveSchedule(plant: CareSchedule, species: CareSchedule | null): CareSchedule {
  const fallback = species ?? NO_SCHEDULE;
  const source = (growing: keyof CareSchedule) => (plant[growing] !== null ? plant : fallback);
  const water = source('wateringGrowingDays');
  const fertilize = source('fertilizingGrowingDays');
  return {
    wateringGrowingDays: water.wateringGrowingDays,
    wateringDormantDays: water.wateringDormantDays,
    fertilizingGrowingDays: fertilize.fertilizingGrowingDays,
    fertilizingDormantDays: fertilize.fertilizingDormantDays,
    repottingMonths: source('repottingMonths').repottingMonths,
  };
}

/**
 * Due (CONTEXT.md): next due is the last matching Care Event (or the creation anchor) plus the
 * interval for today's Season, never earlier than the first day of that Season; repotting runs on
 * months with no seasonal variant and so is never clamped.
 */
function statusOn(
  type: CareType,
  schedule: CareSchedule,
  lastDone: string,
  today: string,
  season: SeasonOn,
): CareStatus {
  let dueOn: string;
  if (type === 'repot') {
    if (schedule.repottingMonths === null) return { state: 'unscheduled' };
    dueOn = shiftMonths(lastDone, schedule.repottingMonths);
  } else {
    const { growing, dormant } = SEASONAL[type];
    const growingDays = schedule[growing];
    if (growingDays === null) return { state: 'unscheduled' };
    if (season.season === 'dormant') {
      const dormantDays = schedule[dormant];
      if (dormantDays === null) return { state: 'paused', until: season.resumesOn };
      dueOn = shiftDays(lastDone, dormantDays);
    } else {
      dueOn = shiftDays(lastDone, growingDays);
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
