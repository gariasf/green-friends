import type { CareEventType } from '@/src/core/careLog';
import { daysBetween } from '@/src/core/dates';

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
  return new Date(year, month - 1, date).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
  });
}
