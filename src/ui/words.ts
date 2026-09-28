// The app's words for care, with nothing from React Native, so the Web view (web/) says the same.
// Relative imports, as in src/core: the Web view's build has no `@/`.
import type { CareStatus, DueCare, NextCare, SeasonOn } from '../core/care';
import type { CareProfile, CauseFact, SeasonalSchedule, Symptom } from '../core/careGuide';
import type { CareEventType } from '../core/careLog';
import { daysBetween, localNoon } from '../core/dates';
import { CARE_TYPES, hasOverride, type CareType, type Plant } from '../core/plants';

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

/** The Web view's Garden, under its title: "8 plants in care". */
export function plantsInCare(count: number): string {
  return `${plural(count, 'plant')} in care`;
}

/** The Web view's Garden's filter for the plants that Need Attention, and its search. */
export const NEEDS_YOU = 'Needs you';
export const SEARCH_PLANTS = 'Search plants';

/** A Garden search that finds nothing. */
export function noPlantCalled(query: string): string {
  return `No plant called “${query.trim()}”`;
}

/** A count and its unit: "1 day", "3 days", joined by a no-break space so no line splits them. */
export function plural(count: number, unit: string): string {
  return `${count}\u00a0${unit}${count === 1 ? '' : 's'}`;
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
  return `${CARE_WORDS[next.type].label} ${nextCareWhen(next)}`;
}

/**
 * When nextCareLine's care comes, for where its care type shows as its icon (Today's Everything
 * else): "in 3 days", "tomorrow".
 */
export function nextCareWhen(next: NextCare): string {
  if (next.days === 1) return 'tomorrow';
  const [count, unit] = daysOrMonths(next.days);
  return `in ${plural(count, unit)}`;
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
 * A care type's status as a Plant screen tile shows it, saying which way it counts (spec #84): the
 * value, with any words before and after it that the tile sets small ("in 3 d", "in 17 mo", "5 d
 * overdue", "Today", "Paused", "—"); and the same in words, for VoiceOver.
 */
export function tileValue(
  status: CareStatus,
  today: string,
): [short: { before?: string; value: string; after?: string }, spoken: string] {
  switch (status.state) {
    case 'unscheduled':
      return [{ value: '—' }, 'no schedule'];
    case 'paused':
      return [{ value: 'Paused' }, 'paused for the Dormant season'];
    case 'due':
      return status.daysOverdue === 0
        ? [{ value: 'Today' }, 'due today']
        : [
            { value: String(status.daysOverdue), after: 'd overdue' },
            `${plural(status.daysOverdue, 'day')} overdue`,
          ];
    case 'upcoming': {
      const [count, unit] = daysOrMonths(daysBetween(today, status.dueOn));
      return [
        { before: 'in', value: String(count), after: unit === 'day' ? 'd' : 'mo' },
        `due in ${plural(count, unit)}`,
      ];
    }
  }
}

/**
 * A tile's second line: the day it's next Due while upcoming ("Tue, Sep 29", "Mar 7, 2028"),
 * otherwise when it was last done, which explains a lateness.
 */
export function tileLine(status: CareStatus, lastDone: string | undefined, today: string): string {
  if (status.state !== 'upcoming') return lastLine(lastDone, today);
  const thisYear = status.dueOn.slice(0, 4) === today.slice(0, 4);
  return dateLabel(status.dueOn, today, thisYear ? 'short' : undefined);
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

/**
 * A seasonal schedule as the Care Guide shows it: "every 7 days, every 14 days in the Dormant
 * season"; in a garden Growing all year, just "every 7 days".
 */
export function scheduleLine({ growing, dormant }: SeasonalSchedule, allYear = false): string {
  if (growing === null) return 'no schedule';
  if (allYear) return `every ${plural(growing, 'day')}`;
  const inDormant =
    dormant === null
      ? 'paused in the Dormant season'
      : `every ${plural(dormant, 'day')} in the Dormant season`;
  return `every ${plural(growing, 'day')}, ${inDormant}`;
}

/**
 * Today's Season, as the Plant screen heads its Care rows: "Growing season", "Dormant season, until
 * Mar 1", "Growing all year".
 */
export function seasonLine(season: SeasonOn, today: string): string {
  if (season.season === 'dormant')
    return `Dormant season, until ${dateLabel(season.resumesOn, today)}`;
  return isAllYear(season) ? `Growing ${ALL_YEAR}` : 'Growing season';
}

/** A garden Growing all year never started its Growing season (`SeasonOn`), and has no Dormant one. */
export function isAllYear(season: SeasonOn): boolean {
  return season.season === 'growing' && season.startsOn === null;
}

const FACT_DONE = {
  watering: 'Last watered',
  fertilizing: 'Last fertilized',
  repotting: 'Last repotted',
};

/**
 * What the Care Log says beside a cause, with no diagnosis in it: "Last watered 6 days ago.
 * Schedule: every 7 days, every 14 days in the Dormant season", "Last fertilized: never logged. No schedule".
 */
export function causeFactLine(fact: CauseFact, today: string): string {
  if (fact.kind === 'season') return seasonLine(fact.season, today);
  const done = FACT_DONE[fact.kind];
  const when =
    fact.lastOn === null ? `${done}: never logged` : `${done} ${agoLine(fact.lastOn, today)}`;
  if (fact.kind === 'repotting') {
    return fact.potSizeCm === null ? when : `${when}, in a ${fact.potSizeCm} cm pot`;
  }
  const schedule = scheduleLine(fact.schedule);
  return `${when}. ${fact.schedule.growing === null ? 'No schedule' : `Schedule: ${schedule}`}`;
}

/** How long ago a day was: "today", "yesterday", "6 days ago", "12 months ago". */
export function agoLine(day: string, today: string): string {
  const ago = daysBetween(day, today);
  if (ago === 0) return 'today';
  if (ago === 1) return 'yesterday';
  const [count, unit] = daysOrMonths(ago);
  return `${plural(count, unit)} ago`;
}

const LIGHT_LEVEL = {
  low: 'Low light',
  medium: 'Medium light',
  'bright-indirect': 'Bright indirect light',
  direct: 'Direct sun',
} as const;

const DIRECT_SUN = {
  none: 'No direct sun',
  morning: 'Morning sun',
  some: 'A few hours of sun',
  'all-day': 'Sun all day',
} as const;

/** Direct sun says itself once, as gardeners do, then its hours. */
const IN_SUN = {
  some: ['Part sun', '3 to 6 hours a day'],
  'all-day': ['Full sun', '6 hours or more a day'],
} as const;

/**
 * A profile's light in the two parts the Care group's Light row and the Care Guide show beneath
 * the scale (spec #48): how bright, then how much direct sun. "Bright indirect light · Morning
 * sun", "Full sun · 6 hours or more a day".
 */
export function lightWords({
  level,
  directSun,
}: Pick<CareProfile['light'], 'level' | 'directSun'>): readonly [string, string] {
  if (level === 'direct' && (directSun === 'some' || directSun === 'all-day')) {
    return IN_SUN[directSun];
  }
  return [LIGHT_LEVEL[level], DIRECT_SUN[directSun]];
}

/** A profile's light in one line, for VoiceOver: "Light: bright indirect light, morning sun". */
export function lightLabel(light: Pick<CareProfile['light'], 'level' | 'directSun'>) {
  return `Light: ${lightWords(light)
    .map((word) => word.toLowerCase())
    .join(', ')}`;
}

/** Beneath a fertiliser's name, what its ratio's three numbers are; none for "No fertiliser". */
export function npkNote(type: string): string | null {
  return type.includes('N-P-K')
    ? 'N-P-K: the three numbers on the label, for nitrogen, phosphorus and potassium.'
    : null;
}

/** The Symptom list's two groups, in order. */
export const SYMPTOM_GROUPS: { kind: Symptom['kind']; title: string }[] = [
  { kind: 'plant', title: 'Leaves and stems' },
  { kind: 'pest', title: 'Pests' },
];

/** Beneath Something wrong?, what the Symptoms cover. */
export const SOMETHING_WRONG = 'Brown tips, yellow leaves, pests';

/** Beside a cause whose treatment can harm pets; the cause's What to do names the treatment. */
export const PET_WARNING = 'This treatment can harm pets: keep them away until the leaves are dry.';

/** A plant without a Care Profile, in place of the Care group's rows. */
export const NO_CARE_GUIDE = {
  title: 'No Care Guide yet',
  line: 'Set a Species to see how to water, feed and place it.',
};

/** The Symptom list's title. */
export const SYMPTOMS_TITLE = 'What do you see?';

/**
 * The Care group's Feed row: the fertiliser while Growing, without its ratio, which the Fertiliser
 * card explains; the Dormant advice (usually stop) while Dormant.
 */
export function feedLine(profile: CareProfile, season: SeasonOn['season']): string {
  if (season === 'dormant') return profile.fertilizer.dormant;
  return profile.fertilizer.type.replace(/ \(N-P-K [^)]*\)/, '');
}

/** Under Watering and Fertiliser: "Your schedule: every 7 days, every 14 days in the Dormant season". */
export function yourSchedule(schedule: SeasonalSchedule, allYear = false): string {
  return `Your schedule: ${scheduleLine(schedule, allYear)}`;
}

/** The Note a cause's Log it as a Note fills in: "Brown, crispy tips: maybe dry air." */
export function symptomNote(symptom: Symptom, causeName: string): string {
  return `${symptom.name}: maybe ${causeName.toLowerCase()}.`;
}

/** The first line above a Symptom's causes. */
export function causesIntro(profile: CareProfile | null): string {
  return profile
    ? `The causes most likely for a ${profile.name.toLowerCase()} come first.`
    : 'The most common causes come first.';
}

/** A care type's interval, as the Web view's Care card and Season table show it: "Every 7 days". */
export function everyLine(count: number, unit: 'day' | 'month'): string {
  return `Every ${plural(count, unit)}`;
}

/** In place of an interval: none in this Season (Paused), or none at all. */
export const PAUSED = 'Paused';
export const NO_SCHEDULE_LINE = 'No schedule';

/** The Web view's Season table, under Growing, for a garden that grows all year. */
export const ALL_YEAR = 'all year';

/** The Care Guide's fixed grid's first heading. */
export const HOW_TO_WATER = 'How to water';

/** A Symptom's table's columns in the Web view. */
export const CAUSE_COLUMNS = ['Cause', 'How to tell', 'What to do'] as const;

/** The Care Log's count: "1 entry", "4 entries". */
export function entries(count: number): string {
  return `${count}\u00a0${count === 1 ? 'entry' : 'entries'}`;
}

/** Today's two-week calendar in the Web view. */
export const COMING_UP = 'Coming up';

/** Under Coming up, after a check and after a care icon. */
export const CALENDAR_LEGEND = {
  done: 'done',
  coming: 'from each Care Schedule, as if each care is done on its day',
};

/**
 * One care on Coming up's calendar, in full words for its title and a screen reader: "Watered:
 * Monsti" (done), "Fertilize Monsti, 5 days overdue", "Water Monsti, due today", "Water Monsti".
 */
export function calendarItemWords(
  kind: 'done' | 'due' | 'coming',
  type: CareType,
  name: string,
  daysOverdue: number,
): string {
  if (kind === 'done') return `${CARE_WORDS[type].done}: ${name}`;
  const what = `${CARE_WORDS[type].label} ${name}`;
  if (kind === 'coming') return what;
  return daysOverdue > 0 ? `${what}, ${plural(daysOverdue, 'day')} overdue` : `${what}, due today`;
}
