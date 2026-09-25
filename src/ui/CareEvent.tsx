import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import type { ColorValue } from 'react-native';

import type { NextCare } from '@/src/core/care';
import type { CareEvent, CareEventType } from '@/src/core/careLog';
import { daysBetween, localNoon } from '@/src/core/dates';
import { Field, optionalNumber } from '@/src/ui/Form';
import { colors } from '@/src/ui/theme';

/**
 * How each kind of Care Event reads: its symbol and hue, as a checklist row or a choice (label),
 * and once logged (done).
 */
export const CARE_COPY: Record<
  CareEventType,
  { symbol: SFSymbol; hue: ColorValue; label: string; done: string }
> = {
  water: { symbol: 'drop.fill', hue: colors.water, label: 'Water', done: 'Watered' },
  fertilize: {
    symbol: 'sparkles',
    hue: colors.fertilize,
    label: 'Fertilize',
    done: 'Fertilized',
  },
  repot: { symbol: 'shippingbox.fill', hue: colors.repot, label: 'Repot', done: 'Repotted' },
  note: { symbol: 'note.text', hue: colors.note, label: 'Note', done: 'Note' },
};

/**
 * A Care Event type's symbol, in its hue. Always beside its words, so VoiceOver skips it rather
 * than read the symbol's name ("sparkle").
 */
export function CareSymbol({ type, size }: { type: CareEventType; size: number }) {
  const { symbol, hue } = CARE_COPY[type];
  return <SymbolView accessibilityElementsHidden name={symbol} size={size} tintColor={hue} />;
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
  const { label } = CARE_COPY[next.type];
  if (next.days === 1) return `${label} tomorrow`;
  const [count, unit] = daysOrMonths(next.days);
  return `${label} in ${plural(count, unit)}`;
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
        label="What did you notice?"
        placeholder="Pests, a new leaf…"
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
