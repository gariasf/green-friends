import { useState, type ReactNode } from 'react';

import type { CareEvent, CareEventType } from '@/src/core/careLog';
import { daysBetween } from '@/src/core/dates';
import { Field, optionalNumber } from '@/src/ui/Form';

/** How each kind of Care Event reads: as a checklist row or a choice (label), and once logged (done). */
export const CARE_COPY: Record<CareEventType, { icon: string; label: string; done: string }> = {
  water: { icon: '💧', label: 'Water', done: 'Watered' },
  fertilize: { icon: '✨', label: 'Fertilize', done: 'Fertilized' },
  repot: { icon: '🪨', label: 'Repot', done: 'Repotted' },
  note: { icon: '📝', label: 'Note', done: 'Note' },
};

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
          placeholder="New pot size in cm (optional)"
          value={potSizeCm}
          onChangeText={setPotSizeCm}
          keyboardType="decimal-pad"
        />
        <Field placeholder="Soil (optional)" value={soil} onChangeText={setSoil} />
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
