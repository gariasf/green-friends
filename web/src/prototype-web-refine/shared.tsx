/*
 * PROTOTYPE (#71, branch prototype/web-refine): throwaway. Three desktop variants of the Web view
 * on the same page, switched with ?variant= and the bar at the bottom. Never merge this folder.
 * What they share: data reads, the Care Guide's sections, the switcher. Layouts are each variant's.
 */
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';

import { evaluateCare, plantSeasonOn, type CareStatus } from '../../../src/core/care';
import {
  readCareGuide,
  type CareGuide,
  CARE_GUIDES_LIGHT,
  type CareProfile,
} from '../../../src/core/careGuide';
import { listCareEvents, type CareEvent } from '../../../src/core/careLog';
import { daysBetween, localDay } from '../../../src/core/dates';
import { getPlant, listPlants } from '../../../src/core/plants';
import { guides } from '../../../src/ui/guides';
import {
  CARE_WORDS,
  dayLabel,
  daysOrMonths,
  lightLabel,
  lightWords,
  npkNote,
  plural,
  tileValue,
  yourSchedule,
} from '../../../src/ui/words';
import type { Garden } from '../garden';
import { CareIcon, GuideIcon } from '../icons';

export type Route =
  | { tab: 'today' }
  | { tab: 'garden' }
  | {
      tab: 'plant';
      id: string;
      view: { page: 'plant' | 'guide' | 'symptoms' } | { page: 'symptom'; symptomId: string };
    };

export type ShellProps = {
  garden: Garden;
  takenAt: Date | null;
  pairKey: Uint8Array;
  screen: Route;
  photoUrl: (filename: string | null) => string | undefined;
};

export const SYNCED = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** Every plant in care, by Display Name, and the same most Overdue first. */
export function useInCare(garden: Garden) {
  const today = localDay(new Date());
  return useMemo(() => {
    const byUrgency = evaluateCare(garden.db, today);
    const care = new Map(byUrgency.map((plant) => [plant.id, plant]));
    const byName = listPlants(garden.db).flatMap((plant) => care.get(plant.id) ?? []);
    return { today, byUrgency, byName };
  }, [garden, today]);
}

/** The chosen plant, as PlantDetail reads it. */
export function usePlant(garden: Garden, id: string | null) {
  const today = localDay(new Date());
  return useMemo(() => {
    if (!id) return undefined;
    const care = evaluateCare(garden.db, today).find((candidate) => candidate.id === id);
    if (!care) return undefined;
    const row = getPlant(garden.db, id);
    return {
      ...care,
      row,
      today,
      events: listCareEvents(garden.db, id),
      guide: readCareGuide(garden.db, id, today, guides),
      season: plantSeasonOn(garden.db, row.speciesId, today),
    };
  }, [garden, id, today]);
}

export type Plant = NonNullable<ReturnType<typeof usePlant>>;

/** A care type's status in words and its tone: "5 days overdue" in caution. */
export function statusWords(status: CareStatus, today: string): { words: string; tone: string } {
  const [, spoken] = tileValue(status, today);
  const tone = status.state === 'due' ? (status.daysOverdue > 0 ? 'overdue' : 'due-today') : '';
  return { words: spoken[0].toUpperCase() + spoken.slice(1), tone };
}

/** A care type's status in a table cell's few characters: "5d overdue", "in 12d", "Today". */
export function statusShort(status: CareStatus, today: string): { words: string; tone: string } {
  switch (status.state) {
    case 'unscheduled':
      return { words: '—', tone: 'quiet' };
    case 'paused':
      return { words: 'Paused', tone: 'quiet' };
    case 'due':
      return status.daysOverdue === 0
        ? { words: 'Today', tone: 'due-today' }
        : { words: `${plural(status.daysOverdue, 'day')} overdue`, tone: 'overdue' };
    case 'upcoming': {
      const [count, unit] = daysOrMonths(daysBetween(today, status.dueOn));
      return {
        words: count === 1 && unit === 'day' ? 'Tomorrow' : `in ${plural(count, unit)}`,
        tone: '',
      };
    }
  }
}

export function potLine(sizeCm: number | null, soil: string | null): string {
  return [sizeCm !== null && `${sizeCm} cm pot`, soil].filter(Boolean).join(' · ');
}

/** Growing | Dormant as a plain text toggle rather than iOS's segmented control. */
export function SeasonToggle({
  value,
  onChange,
}: {
  value: 'growing' | 'dormant';
  onChange: (season: 'growing' | 'dormant') => void;
}) {
  return (
    <span className="p-toggle" role="group" aria-label="Season">
      {(['growing', 'dormant'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {option === 'growing' ? 'Growing' : 'Dormant'}
        </button>
      ))}
    </span>
  );
}

export function LightScale({ light }: { light: CareProfile['light'] }) {
  return (
    <span className="scale" role="img" aria-label={lightLabel(light)}>
      <span className="steps" aria-hidden="true">
        {CARE_GUIDES_LIGHT.level.map((level) => (
          <span key={level} className={level === light.level ? 'marked' : undefined} />
        ))}
      </span>
      <span className="quiet" aria-hidden="true">
        {lightWords(light).join(' · ')}
      </span>
    </span>
  );
}

/** The full Care Guide's sections for a season, flat: each a heading and its text. */
export function GuideSections({
  guide,
  season,
}: {
  guide: CareGuide;
  season: 'growing' | 'dormant';
}) {
  const { profile, schedule } = guide;
  const npk = npkNote(profile.fertilizer.type);
  return (
    <>
      <section className="p-sec">
        <h3>
          <CareIcon type="water" /> Watering
        </h3>
        <p>{profile.watering[season]}</p>
        <p>{profile.watering.how}</p>
        <p className="quiet">{yourSchedule(schedule.water)}</p>
      </section>
      <section className="p-sec">
        <h3>
          <CareIcon type="fertilize" /> Fertiliser
        </h3>
        <p>
          <strong>{profile.fertilizer.type}</strong>
        </p>
        {npk && <p className="quiet">{npk}</p>}
        <p>{profile.fertilizer[season]}</p>
        <p className="quiet">{yourSchedule(schedule.fertilize)}</p>
      </section>
      <section className="p-sec">
        <h3>
          <GuideIcon name="light" /> Light and warmth
        </h3>
        <LightScale light={profile.light} />
        <p>{profile.light.text}</p>
      </section>
      <section className="p-sec">
        <h3>
          <GuideIcon name="soil" /> Soil
        </h3>
        <p>{profile.soil}</p>
      </section>
      {guide.careNotes && (
        <section className="p-sec">
          <h3>
            <GuideIcon name="leaf" /> This plant
          </h3>
          <p>{guide.careNotes}</p>
        </section>
      )}
      <section className="p-sec p-fact">
        <h3>
          <GuideIcon name="fact" /> Fun fact
        </h3>
        <p>{guide.funFact.text}</p>
        <p>
          <a className="link" href={guide.funFact.source} target="_blank" rel="noreferrer">
            More on Wikipedia
          </a>
        </p>
      </section>
    </>
  );
}

/** The Care Log as rows: symbol, what was done and its details, its day. */
export function CareLogList({ events, today }: { events: CareEvent[]; today: string }) {
  if (events.length === 0) return <p className="quiet">Nothing logged yet.</p>;
  return (
    <ol className="p-log">
      {events.map((event) => {
        const detail = [potLine(event.potSizeCm, event.soil), event.note]
          .filter(Boolean)
          .join(' · ');
        return (
          <li key={event.id}>
            <CareIcon type={event.type} size={16} />
            <span className="grow">
              <strong>{CARE_WORDS[event.type].done}</strong>
              {detail && <span className="quiet"> · {detail}</span>}
            </span>
            <time className="quiet" dateTime={event.occurredOn}>
              {dayLabel(event.occurredOn, today)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

/** Keys the page listens to, skipped while typing in a field. */
export function useKeys(handler: (event: KeyboardEvent) => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, [contenteditable]') && event.key !== 'Escape') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      handler(event);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
}

export const VARIANTS = [
  ['now', 'main today'],
  ['A', 'Reading page'],
  ['B', 'Library'],
  ['C', 'Table + inspector'],
] as const;
export type Variant = (typeof VARIANTS)[number][0];

export function initialVariant(): Variant {
  const asked = new URLSearchParams(location.search).get('variant');
  return VARIANTS.find(([key]) => key === asked)?.[0] ?? 'A';
}

/** The floating bar: ← variant → , also on the ← and → keys. Dev builds only. */
export function Switcher({
  current,
  onChange,
}: {
  current: Variant;
  onChange: (variant: Variant) => void;
}) {
  const index = VARIANTS.findIndex(([key]) => key === current);
  const go = (step: number) => {
    const [key] = VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length];
    const url = new URL(location.href);
    url.searchParams.set('variant', key);
    history.replaceState(null, '', url);
    onChange(key);
  };
  useKeys((event) => {
    if (event.key === 'ArrowLeft') go(-1);
    if (event.key === 'ArrowRight') go(1);
  });
  const [, name] = VARIANTS[index];
  if (!import.meta.env.DEV) return null;
  return (
    <div className="proto-bar" role="toolbar" aria-label="Prototype variants">
      <button type="button" onClick={() => go(-1)} aria-label="Previous variant">
        <CaretLeftIcon size={16} />
      </button>
      <span>
        <strong>{current}</strong> {name}
      </span>
      <button type="button" onClick={() => go(1)} aria-label="Next variant">
        <CaretRightIcon size={16} />
      </button>
    </div>
  );
}

/** A search box's filter over plants by Display Name or scientific name. */
export function useSearch<T extends { displayName: string; scientificName: string | null }>(
  plants: T[],
) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? plants.filter((plant) =>
        `${plant.displayName} ${plant.scientificName ?? ''}`.toLowerCase().includes(needle),
      )
    : plants;
  return { query, setQuery, shown };
}
