import type { SFSymbol } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import type { ColorValue } from 'react-native';
import { Color } from 'expo-router';

import type { CareStatus, PlantCare } from '@/src/core/care';
import type { CareEvent, CareEventType } from '@/src/core/careLog';
import { daysBetween } from '@/src/core/dates';
import { CARE_TYPES, SEASONAL, type CareSchedule, type CareType } from '@/src/core/plants';
import { Field, optionalNumber } from '@/src/ui/Form';
import { colors } from '@/src/ui/theme';

/**
 * How each kind of Care Event reads: its SF Symbol and hue, as a checklist row or a choice
 * (label), and once logged (done).
 */
export const CARE_COPY: Record<
  CareEventType,
  { symbol: SFSymbol; hue: ColorValue; label: string; done: string }
> = {
  water: { symbol: 'drop.fill', hue: Color.ios.systemBlue, label: 'Water', done: 'Watered' },
  fertilize: {
    symbol: 'sparkles',
    hue: Color.ios.systemYellow,
    label: 'Fertilize',
    done: 'Fertilized',
  },
  repot: {
    symbol: 'shippingbox.fill',
    hue: Color.ios.systemBrown,
    label: 'Repot',
    done: 'Repotted',
  },
  note: { symbol: 'note.text', hue: Color.ios.systemGray, label: 'Note', done: 'Note' },
};

/** How many plants Need Attention, as Today's summary and the Daily Digest's title put it. */
export function plantsNeedYou(count: number): string {
  return count === 1 ? '1 plant needs you' : `${count} plants need you`;
}

/** A local calendar day as the Care Log shows it: Today, Yesterday, else its date. */
export function dayLabel(day: string, today: string): string {
  const ago = daysBetween(day, today);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
  });
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

function monthName(day: string): string {
  const [year, month] = day.split('-').map(Number);
  return new Date(year, month - 1, 1, 12).toLocaleDateString(undefined, { month: 'long' });
}

/**
 * PROTOTYPE (UI pass): one care type's status in words, and the colour it wears: "2 days overdue"
 * in red, "Due today" in orange, "In 4 days", "Paused until March", "No schedule".
 */
export function careStatus(status: CareStatus, today: string): { text: string; color: ColorValue } {
  switch (status.state) {
    case 'unscheduled':
      return { text: 'No schedule', color: colors.tertiaryLabel };
    case 'paused':
      return { text: `Paused until ${monthName(status.until)}`, color: colors.secondaryLabel };
    case 'due':
      return status.daysOverdue === 0
        ? { text: 'Due today', color: colors.dueToday }
        : { text: `${plural(status.daysOverdue, 'day')} overdue`, color: colors.overdue };
    case 'upcoming': {
      const days = daysBetween(today, status.dueOn);
      if (days === 1) return { text: 'Tomorrow', color: colors.secondaryLabel };
      if (days < 60) return { text: `In ${days} days`, color: colors.secondaryLabel };
      return { text: `In ${Math.round(days / 30.4)} months`, color: colors.secondaryLabel };
    }
  }
}

/**
 * PROTOTYPE (UI pass): the one line a plant that needs nothing today shows, its soonest care:
 * "Water in 3 days", "Water tomorrow"; "Resting" when watering is Paused.
 */
export function nextCare(plant: PlantCare, today: string): string {
  const soonest = CARE_TYPES.map((type) => ({ type, status: plant.care[type] }))
    .flatMap(({ type, status }) =>
      status.state === 'upcoming' || status.state === 'due' ? [{ type, dueOn: status.dueOn }] : [],
    )
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))[0];
  if (!soonest) return plant.care.water.state === 'paused' ? 'Resting' : 'No schedule';
  const label = CARE_COPY[soonest.type].label;
  const days = daysBetween(today, soonest.dueOn);
  if (days < 0) return `${label} · ${plural(-days, 'day')} overdue`;
  if (days === 0) return `${label} today`;
  if (days === 1) return `${label} tomorrow`;
  if (days < 60) return `${label} in ${days} days`;
  return `${label} in ${Math.round(days / 30.4)} months`;
}

/** A recent day in few words: "today", "yesterday", else "Sep 22" (with the year when not this one). */
export function shortDay(day: string, today: string): string {
  const ago = daysBetween(day, today);
  if (ago === 0) return 'today';
  if (ago === 1) return 'yesterday';
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
  });
}

/** "Last watered Sep 22", "Last watered yesterday", or "Never logged". */
export function lastDone(type: CareType, day: string | undefined, today: string): string {
  if (!day) return 'Never logged';
  return `Last ${CARE_COPY[type].done.toLowerCase()} ${shortDay(day, today)}`;
}

/** A care type's schedule in words; null for no schedule. */
export function describeSchedule(type: CareType, schedule: CareSchedule | null): string {
  if (!schedule) return 'Never due';
  if (type === 'repot') {
    return schedule.repottingMonths === null
      ? 'Never due'
      : `Every ${plural(schedule.repottingMonths, 'month')}`;
  }
  const growing = schedule[SEASONAL[type].growing];
  const dormant = schedule[SEASONAL[type].dormant];
  if (growing === null) return 'Never due';
  return dormant === null
    ? `Every ${plural(growing, 'day')}, paused in winter`
    : `Every ${plural(growing, 'day')}, ${plural(dormant, 'day')} in winter`;
}

/**
 * The form for what a Care Event of `type` records beside its day, a Note's text or a repot's new
 * pot size and soil, filled from `event` when editing one. Gives the fields to show, their values
 * for logCareEvent or editCareEvent (undefined where the type records nothing), and whether they
 * are complete: a Note needs text.
 */
export function useCareEventDetails(type: CareEventType, event?: CareEvent) {
  const [note, setNote] = useState(event?.note ?? '');
  const [potSizeCm, setPotSizeCm] = useState(event?.potSizeCm?.toString() ?? '');
  const [soil, setSoil] = useState(event?.soil ?? '');

  let fields: ReactNode = null;
  if (type === 'note') {
    fields = (
      <Field
        label="Note"
        placeholder="What did you notice? Pests, a new leaf…"
        value={note}
        onChangeText={setNote}
        multiline
        // Straight to the keyboard for a new Note, not for one opened to be edited.
        autoFocus={note === ''}
      />
    );
  }
  if (type === 'repot') {
    fields = (
      <>
        <Field
          label="New pot size"
          suffix="cm"
          placeholder="Optional"
          value={potSizeCm}
          onChangeText={setPotSizeCm}
          keyboardType="decimal-pad"
        />
        <Field label="Soil" placeholder="Optional" value={soil} onChangeText={setSoil} />
      </>
    );
  }

  return {
    fields,
    values: {
      note: type === 'note' ? note : undefined,
      potSizeCm: type === 'repot' ? optionalNumber(potSizeCm) : undefined,
      soil: type === 'repot' ? soil : undefined,
    },
    complete: type !== 'note' || note.trim() !== '',
  };
}
