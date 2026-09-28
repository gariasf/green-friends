/*
 * PROTOTYPE (web polish, 2026-09-28): the design after the three critics, on a switch. Never merge.
 *   now  the design on main
 *   A    quiet paper: no rules under headings, warm neutrals, a tinted surface, near-white only
 *        with a shadow, serif section headings, less bold, one pill
 *   B    A's Today with the plant status first: the Care card before the photo, intervals once,
 *        no Dormant column when unused, one name for fertilizing (the owner's pick, round 2)
 *   C    B with one reason per surface: an outline groups, a fill selects, a tint is now; no
 *        white boxes, no shadows; the Care Guide as a sheet on one label column (round 4)
 * `?variant=` keeps the choice; ← and → cycle it.
 */
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useEffect, useSyncExternalStore } from 'react';

import './polish.css';

const VARIANTS = [
  ['now', 'main today'],
  ['A', 'Quiet paper'],
  ['B', "A's Today, status-first plant"],
  ['C', 'B outlined, the guide as a sheet'],
] as const;
export type Variant = (typeof VARIANTS)[number][0];

function read(): Variant {
  // Node (the tests) renders main's design.
  if (typeof location === 'undefined') return 'now';
  const asked = new URLSearchParams(location.search).get('variant');
  return VARIANTS.find(([key]) => key === asked)?.[0] ?? 'A';
}

let current = read();
if (typeof document !== 'undefined') document.documentElement.dataset.variant = current;
const listeners = new Set<() => void>();

function set(next: Variant) {
  current = next;
  document.documentElement.dataset.variant = next;
  const url = new URL(location.href);
  url.searchParams.set('variant', next);
  history.replaceState(null, '', url);
  listeners.forEach((listener) => listener());
}

export function useVariant(): Variant {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
}

export function Switcher() {
  const variant = useVariant();
  const index = VARIANTS.findIndex(([key]) => key === variant);
  const go = (step: number) => set(VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length][0]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest('input, textarea, [contenteditable]')) return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
  if (!import.meta.env.DEV) return null;
  return (
    <div className="proto-bar" role="toolbar" aria-label="Prototype variants">
      <button type="button" onClick={() => go(-1)} aria-label="Previous variant">
        <CaretLeftIcon size={16} />
      </button>
      <span>
        <strong>{variant}</strong> {VARIANTS[index][1]}
      </span>
      <button type="button" onClick={() => go(1)} aria-label="Next variant">
        <CaretRightIcon size={16} />
      </button>
    </div>
  );
}
