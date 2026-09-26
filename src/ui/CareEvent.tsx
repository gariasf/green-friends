import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import type { ColorValue } from 'react-native';

import type { CareEvent, CareEventType } from '@/src/core/careLog';
import { Field, optionalNumber } from '@/src/ui/Form';
import { colors } from '@/src/ui/theme';
import { CARE_WORDS } from '@/src/ui/words';

/**
 * How each kind of Care Event reads: its symbol and hue beside its words (CARE_WORDS), as a
 * checklist row or a choice (label), and once logged (done).
 */
export const CARE_COPY: Record<
  CareEventType,
  { symbol: SFSymbol; hue: ColorValue; label: string; done: string }
> = {
  water: { symbol: 'drop.fill', hue: colors.water, ...CARE_WORDS.water },
  fertilize: { symbol: 'sparkles', hue: colors.fertilize, ...CARE_WORDS.fertilize },
  repot: { symbol: 'shippingbox.fill', hue: colors.repot, ...CARE_WORDS.repot },
  note: { symbol: 'note.text', hue: colors.note, ...CARE_WORDS.note },
};

/**
 * A Care Event type's symbol, in its hue. Always beside its words, so VoiceOver skips it rather
 * than read the symbol's name ("sparkle").
 */
export function CareSymbol({ type, size }: { type: CareEventType; size: number }) {
  const { symbol, hue } = CARE_COPY[type];
  return <SymbolView accessibilityElementsHidden name={symbol} size={size} tintColor={hue} />;
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
