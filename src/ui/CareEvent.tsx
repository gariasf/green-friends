import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import type { ColorValue } from 'react-native';

import type { CareEvent, CareEventType } from '@/src/core/careLog';
import { daysBetween } from '@/src/core/dates';
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

/** A Care Event type's symbol, in its hue. */
export function CareSymbol({ type, size }: { type: CareEventType; size: number }) {
  const { symbol, hue } = CARE_COPY[type];
  return <SymbolView name={symbol} size={size} tintColor={hue} />;
}

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
