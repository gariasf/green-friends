// The app's words for care, with nothing from React Native, so the Web view (web/) says the same.
// Relative imports, as in src/core: the Web view's build has no `@/`.
import type { CareStatus, DueCare, NextCare } from '../core/care';
import type { CareEventType } from '../core/careLog';
import { daysBetween, localNoon } from '../core/dates';
import { CARE_TYPES, hasOverride, type Plant } from '../core/plants';

/** How each kind of Care Event reads, as a checklist row or a choice (label), and once logged (done). */
export const CARE_WORDS: Record<CareEventType, { label: string; done: string }> = {
  water: { label: 'Water', done: 'Watered' },
  fertilize: { label: 'Fertilize', done: 'Fertilized' },
  repot: { label: 'Repot', done: 'Repotted' },
  note: { label: 'Note', done: 'Note' },
};

/**
 * A plant's scientific name for the line beneath its name, or none where it would repeat the name,
 * as for a Species known by its scientific name (Aloe vera, Hoya pubicalyx).
 */
export function scientificBeneath(name: string, scientificName: string | null): string | null {
  return scientificName === name ? null : scientificName;
}

/** How many plants Need Attention, as Today's date line and the Daily Digest's title put it. */
export function plantsNeedYou(count: number): string {
  return count === 1 ? '1 plant needs you' : `${count} plants need you`;
}

/** A count and its unit: "1 day", "3 days". */
export function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

/** Days ahead as they are counted: in days, or from 60 on in months. */
export function daysOrMonths(days: number): [count: number, unit: 'day' | 'month'] {
  return days < 60 ? [days, 'day'] : [Math.round(days / 30.4), 'month'];
}

/**
 * The next care of a plant that needs nothing today, which is always days ahead: "Water in 3
 * days", "Fertilize tomorrow"; "Resting" while its watering waits for the Growing season. Paused
 * feeding reads as the day it resumes, when it comes Due unless fed in the Dormant season.
 */
export function nextCareLine(next: NextCare | null): string {
  if (next === null) return 'No schedule';
  if (next.paused && next.type === 'water') return 'Resting';
  const { label } = CARE_WORDS[next.type];
  if (next.days === 1) return `${label} tomorrow`;
  const [count, unit] = daysOrMonths(next.days);
  return `${label} in ${plural(count, unit)}`;
}

/**
 * What a plant that Needs Attention is waiting for, on one line: "Fertilize overdue", "Water due
 * today", "Fertilize, Repot overdue · Water due today".
 */
export function dueLine(due: DueCare[]): string {
  const labels = (overdue: boolean) =>
    due
      .filter((care) => care.daysOverdue > 0 === overdue)
      .map((care) => CARE_WORDS[care.type].label);
  const overdue = labels(true);
  const today = labels(false);
  return [
    overdue.length > 0 && `${overdue.join(', ')} overdue`,
    today.length > 0 && `${today.join(', ')} due today`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** A local calendar day as the Care Log shows it: Today, Yesterday, else its date with its weekday. */
export function dayLabel(day: string, today: string): string {
  const ago = daysBetween(day, today);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  return dateLabel(day, today, 'short');
}

/** A local calendar day's date ("Sep 22", or with a weekday "Tue, Sep 22"), its year only when not today's. */
export function dateLabel(day: string, today: string, weekday?: 'short'): string {
  return localNoon(day).toLocaleDateString(undefined, {
    weekday,
    day: 'numeric',
    month: 'short',
    year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
  });
}

/**
 * A care type's status in a Plant screen tile's short value ("5d", "17mo", "Today", "Paused", "—";
 * Overdue care's days, which the tile follows with "overdue"), and the same in words.
 */
export function tileValue(status: CareStatus, today: string): [short: string, spoken: string] {
  switch (status.state) {
    case 'unscheduled':
      return ['—', 'no schedule'];
    case 'paused':
      return ['Paused', 'paused for the Dormant season'];
    case 'due':
      return status.daysOverdue === 0
        ? ['Today', 'due today']
        : [`${status.daysOverdue}d`, `${plural(status.daysOverdue, 'day')} overdue`];
    case 'upcoming': {
      const [count, unit] = daysOrMonths(daysBetween(today, status.dueOn));
      return [`${count}${unit === 'day' ? 'd' : 'mo'}`, `due in ${plural(count, unit)}`];
    }
  }
}

/** When a care type was last done, in the few words a tile has room for: "Last Sep 22". */
export function lastLine(day: string | undefined, today: string): string {
  if (!day) return 'Never logged';
  const ago = daysBetween(day, today);
  if (ago === 0) return 'Done today';
  if (ago === 1) return 'Done yesterday';
  return `Last ${dateLabel(day, today)}`;
}

/**
 * Whose schedule the plant follows: its Species' default, its own (the Overrides, ADR-0003), or its
 * own for some care types only.
 */
export function whoseSchedule(plant: Plant): string {
  const own = CARE_TYPES.filter((type) => hasOverride(plant, type));
  if (own.length === 0) return 'Species schedule';
  // A plant without a Species has its own schedule or none, care type by care type.
  if (plant.speciesId === null || own.length === CARE_TYPES.length) return 'Own schedule';
  return `Own schedule for ${own.map((type) => CARE_WORDS[type].label).join(' and ')}`;
}
