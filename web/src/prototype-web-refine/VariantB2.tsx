/*
 * PROTOTYPE (#71) variant B2, Library refined: the owner's pick (B), more structured. Every page on
 * one frame (a header, then sections with a heading and a rule). Today: Needs you, then a two-week
 * plan as a calendar (done care on past days, everything Due on today, planned care after it,
 * repeats included). The plant: the Care card beside the photo from the top; the Care Guide's
 * seasonal advice as Growing | Dormant columns (no toggle, nothing reflows) and the rest in a fixed
 * grid; the Care Log as a table. The Symptoms in columns, each cause's tell and fix side by side.
 */
import { CheckIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';

import {
  dueCare,
  effectiveSchedule,
  evaluateCare,
  needsAttention,
  nextCare,
  seasonOn,
  type PlantCare,
} from '../../../src/core/care';
import { causeFact, symptomCauses } from '../../../src/core/careGuide';
import { listCareEvents, type CareEvent } from '../../../src/core/careLog';
import { daysBetween, localNoon, shiftDays } from '../../../src/core/dates';
import { CARE_TYPES, getPlant, type CareType } from '../../../src/core/plants';
import { getSettings } from '../../../src/core/settings';
import { getSpecies } from '../../../src/core/species';
import { guides } from '../../../src/ui/guides';
import {
  CARE_WORDS,
  causeFactLine,
  causesIntro,
  dateLabel,
  dueLine,
  lastLine,
  nextCareLine,
  npkNote,
  PET_WARNING,
  plantsNeedYou,
  plural,
  scientificBeneath,
  SOMETHING_WRONG,
  SYMPTOM_GROUPS,
  SYMPTOMS_TITLE,
  whoseSchedule,
} from '../../../src/ui/words';
import type { Garden } from '../garden';
import { CareIcon, GuideIcon, objectPosition, Thumb } from '../icons';
import {
  LightScale,
  potLine,
  statusWords,
  useInCare,
  useKeys,
  usePlant,
  useSearch,
  type Plant,
  type ShellProps,
} from './shared';
import { Sidebar } from './VariantA';

const SIZES = { S: '9rem', M: '13rem', L: '18rem' } as const;

export function VariantB2(props: ShellProps) {
  const { screen } = props;
  return (
    <div className="vB vB2">
      <Sidebar {...props} />
      <main className="b2-main">
        {screen.tab === 'today' && <TodayB2 {...props} />}
        {screen.tab === 'garden' && <GardenB2 {...props} />}
        {screen.tab === 'plant' && <PlantB2 {...props} id={screen.id} />}
      </main>
    </div>
  );
}

/** A section's heading, what it counts or says on the right, and a rule beneath. */
function Section({
  title,
  meta,
  children,
  className,
}: {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`b2-section ${className ?? ''}`}>
      <header className="b2-section-head">
        <h2>{title}</h2>
        {meta && <span className="quiet">{meta}</span>}
      </header>
      {children}
    </section>
  );
}

// ---------- The schedule, for the plan and the Care card ----------

/** A plant's effective intervals, and its Season on any day. */
function useSchedules(garden: Garden) {
  return useMemo(() => {
    const settings = getSettings(garden.db);
    function scheduleOf(id: string) {
      const plant = getPlant(garden.db, id);
      const species = plant.speciesId ? getSpecies(garden.db, plant.speciesId) : null;
      const schedule = effectiveSchedule(plant, species);
      const restsInSummer = species?.restsInSummer ?? false;
      /** The interval in days for a care type on `day`'s Season; null when Paused or none. */
      const every = (type: CareType, day: string): number | null => {
        if (type === 'repot') return null;
        const dormant = seasonOn(day, settings, restsInSummer).season === 'dormant';
        if (type === 'water') {
          return dormant ? schedule.wateringDormantDays : schedule.wateringGrowingDays;
        }
        return dormant ? schedule.fertilizingDormantDays : schedule.fertilizingGrowingDays;
      };
      /** The months each Season runs: "Mar – Oct"; null when it grows all year. */
      const months = () => {
        const growing = Array.from(
          { length: 12 },
          (_, index) =>
            seasonOn(`2026-${String(index + 1).padStart(2, '0')}-15`, settings, restsInSummer)
              .season === 'growing',
        );
        if (growing.every(Boolean)) return null;
        const name = (index: number) =>
          new Date(2026, index, 15).toLocaleDateString(undefined, { month: 'short' });
        const start = growing.findIndex((on, index) => on && !growing[(index + 11) % 12]);
        const end = growing.findIndex((on, index) => on && !growing[(index + 1) % 12]);
        return {
          growing: `${name(start)} – ${name(end)}`,
          dormant: `${name((end + 1) % 12)} – ${name((start + 11) % 12)}`,
        };
      };
      return { schedule, every, months, repotMonths: schedule.repottingMonths };
    }
    return scheduleOf;
  }, [garden]);
}

type PlanItem = {
  plant: PlantCare;
  type: CareType;
  kind: 'done' | 'overdue' | 'due' | 'planned';
  days?: number;
  note?: string;
};

/**
 * What each day of the fortnight from `start` holds: on past days the care logged, on today every
 * care Due or Overdue, after it the care that comes Due, and again at its interval, as if each is
 * done on its day.
 */
function usePlan(garden: Garden, today: string, start: string, length: number) {
  const scheduleFor = useSchedules(garden);
  return useMemo(() => {
    const end = shiftDays(start, length - 1);
    const plan = new Map<string, PlanItem[]>();
    for (let index = 0; index < length; index++) plan.set(shiftDays(start, index), []);
    const add = (day: string, item: PlanItem) => plan.get(day)?.push(item);
    for (const plant of evaluateCare(garden.db, today)) {
      for (const event of listCareEvents(garden.db, plant.id)) {
        if (event.occurredOn >= start && event.occurredOn < today && event.type !== 'note') {
          add(event.occurredOn, { plant, type: event.type, kind: 'done' });
        }
      }
      const { every } = scheduleFor(plant.id);
      for (const type of CARE_TYPES) {
        const status = plant.care[type];
        let day: string;
        if (status.state === 'due') {
          day = today;
          add(today, {
            plant,
            type,
            kind: status.daysOverdue > 0 ? 'overdue' : 'due',
            days: status.daysOverdue,
          });
        } else if (status.state === 'upcoming') {
          day = status.dueOn;
          add(day, { plant, type, kind: 'planned' });
        } else continue;
        for (let interval = every(type, day); interval; interval = every(type, day)) {
          day = shiftDays(day, interval);
          if (day > end) break;
          add(day, { plant, type, kind: 'planned' });
        }
      }
    }
    return plan;
  }, [garden, today, start, length, scheduleFor]);
}

// ---------- Today ----------

function TodayB2({ garden, photoUrl }: ShellProps) {
  const { today, byUrgency } = useInCare(garden);
  const plants = byUrgency.filter(needsAttention);
  // Weeks start on Monday.
  const weekStart = shiftDays(today, -((localNoon(today).getDay() + 6) % 7));
  const plan = usePlan(garden, today, weekStart, 14);
  const days = [...plan.keys()];
  const date = localNoon(today).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const range = (from: string, to: string) => `${dateLabel(from, today)} – ${dateLabel(to, today)}`;
  const thisWeek = days.slice(0, 7).reduce((sum, day) => sum + countLeft(plan.get(day)!), 0);

  return (
    <div className="b2-page">
      <header className="b2-head">
        <h1 tabIndex={-1}>Today</h1>
        <p className="quiet">
          {date} · {plants.length > 0 ? plantsNeedYou(plants.length) : 'Nothing needs you today'}
        </p>
      </header>

      {plants.length > 0 && (
        <Section title="Needs you" meta={plural(plants.length, 'plant')}>
          <ul className="b2-need">
            {plants.map((plant) => (
              <li key={plant.id}>
                <a href={`#/plant/${plant.id}`}>
                  <Thumb
                    src={photoUrl(plant.photo)}
                    focus={plant.focus}
                    name={plant.displayName}
                    size="lg"
                  />
                  <span className="grow">
                    <span className="name">{plant.displayName}</span>
                    {dueCare(plant).map(({ type, daysOverdue }) => (
                      <span key={type} className="b2-due">
                        <CareIcon type={type} size={16} />
                        <span className="grow">{CARE_WORDS[type].label}</span>
                        <span className={daysOverdue > 0 ? 'overdue' : 'due-today'}>
                          {daysOverdue > 0 ? `${plural(daysOverdue, 'day')} overdue` : 'Due today'}
                        </span>
                      </span>
                    ))}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Plan" meta={`${range(days[0], days[13])} · ${thisWeek} to do this week`}>
        <div className="b2-cal" role="table" aria-label="Plan for two weeks">
          <div className="b2-cal-row b2-cal-days" role="row">
            {days.slice(0, 7).map((day) => (
              <span key={day} role="columnheader">
                {localNoon(day).toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
            ))}
          </div>
          {[0, 7].map((offset) => (
            <div key={offset} className="b2-cal-row" role="row">
              {days.slice(offset, offset + 7).map((day) => (
                <DayCell
                  key={day}
                  day={day}
                  today={today}
                  items={plan.get(day)!}
                  photoUrl={photoUrl}
                />
              ))}
            </div>
          ))}
        </div>
        <p className="quiet b2-legend">
          <span>
            <CheckIcon size={12} weight="bold" /> done
          </span>
          <span>
            <CareIcon type="water" size={12} /> planned from each schedule, as if each care is done
            on its day
          </span>
        </p>
      </Section>
    </div>
  );
}

function countLeft(items: PlanItem[]) {
  return items.filter((item) => item.kind !== 'done').length;
}

function DayCell({
  day,
  today,
  items,
  photoUrl,
}: {
  day: string;
  today: string;
  items: PlanItem[];
  photoUrl: ShellProps['photoUrl'];
}) {
  const when = day < today ? 'past' : day === today ? 'today' : 'future';
  const noon = localNoon(day);
  const first = noon.getDate() === 1;
  return (
    <div className={`b2-cell ${when}`} role="cell">
      <p className="b2-date">
        <span className="b2-num">{noon.getDate()}</span>
        {when === 'today' && <span className="b2-today">Today</span>}
        {first && when !== 'today' && (
          <span className="quiet">{noon.toLocaleDateString(undefined, { month: 'short' })}</span>
        )}
      </p>
      <ul>
        {items.map((item, index) => (
          <li key={index} className={`b2-item ${item.kind}`}>
            <a href={`#/plant/${item.plant.id}`} title={itemTitle(item)}>
              {item.kind === 'done' ? (
                <CheckIcon size={12} weight="bold" className="b2-check" aria-hidden="true" />
              ) : (
                <CareIcon type={item.type} size={14} />
              )}
              <Thumb
                src={photoUrl(item.plant.photo)}
                focus={item.plant.focus}
                name={item.plant.displayName}
              />
              <span className="b2-item-name">{item.plant.displayName}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function itemTitle(item: PlanItem): string {
  const what = `${CARE_WORDS[item.type].label} ${item.plant.displayName}`;
  if (item.kind === 'done') return `${CARE_WORDS[item.type].done}: ${item.plant.displayName}`;
  if (item.kind === 'overdue') return `${what}, ${plural(item.days ?? 0, 'day')} overdue`;
  if (item.kind === 'due') return `${what}, due today`;
  return what;
}

// ---------- Garden ----------

function GardenB2({ garden, photoUrl }: ShellProps) {
  const { today, byName } = useInCare(garden);
  const [needYouOnly, setNeedYouOnly] = useState(false);
  const { query, setQuery, shown } = useSearch(
    needYouOnly ? byName.filter(needsAttention) : byName,
  );
  const needYou = byName.filter(needsAttention).length;
  const [size, setSize] = useState<keyof typeof SIZES>('M');
  useKeys((event) => {
    if (event.key === '/') {
      event.preventDefault();
      document.querySelector<HTMLInputElement>('.b2-tools input')?.focus();
    }
  });
  return (
    <div className="b2-page">
      <header className="b2-head b2-head-row">
        <div>
          <h1 tabIndex={-1}>Garden</h1>
          <p className="quiet">{plural(byName.length, 'plant')} in care</p>
        </div>
        <div className="b2-tools">
          <span className="p-toggle" role="group" aria-label="Show">
            <button type="button" aria-pressed={!needYouOnly} onClick={() => setNeedYouOnly(false)}>
              All
            </button>
            <button type="button" aria-pressed={needYouOnly} onClick={() => setNeedYouOnly(true)}>
              Needs you · {needYou}
            </button>
          </span>
          <label className="p-search">
            <MagnifyingGlassIcon size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search plants"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <kbd>/</kbd>
          </label>
          <span className="p-toggle" role="group" aria-label="Photo size">
            {(Object.keys(SIZES) as (keyof typeof SIZES)[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={size === key}
                onClick={() => setSize(key)}
              >
                {key}
              </button>
            ))}
          </span>
        </div>
      </header>
      <ul className="b-grid" style={{ '--cell': SIZES[size] } as React.CSSProperties}>
        {shown.map((plant) => {
          const due = dueCare(plant);
          const tone = due.some((care) => care.daysOverdue > 0) ? 'overdue' : 'due-today';
          return (
            <li key={plant.id}>
              <a href={`#/plant/${plant.id}`}>
                <Thumb
                  src={photoUrl(plant.photo)}
                  focus={plant.focus}
                  name={plant.displayName}
                  size="cell"
                />
                <span className="name">{plant.displayName}</span>
                <span className={due.length > 0 ? `b-line ${tone}` : 'b-line quiet'}>
                  {due.length > 0 ? dueLine(due) : nextCareLine(nextCare(plant, today))}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="quiet">No plant called “{query}”.</p>}
    </div>
  );
}

// ---------- The plant ----------

function PlantB2({ garden, screen, photoUrl, id }: ShellProps & { id: string }) {
  const plant = usePlant(garden, id);
  const scheduleFor = useSchedules(garden);
  if (!plant) return <h1 tabIndex={-1}>Not in your Garden</h1>;
  const view = screen.tab === 'plant' ? screen.view : { page: 'plant' as const };
  const onSymptoms = view.page === 'symptoms' || view.page === 'symptom';
  const symptom =
    view.page === 'symptom' ? guides.symptoms.find((s) => s.id === view.symptomId) : undefined;
  const crumbs = (
    <p className="b-crumbs">
      <a href="#/garden">Garden</a> <span aria-hidden="true">/</span>{' '}
      {onSymptoms ? <a href={`#/plant/${id}`}>{plant.displayName}</a> : plant.displayName}
      {symptom && (
        <>
          {' '}
          <span aria-hidden="true">/</span> <a href={`#/plant/${id}/symptoms`}>{SYMPTOMS_TITLE}</a>
        </>
      )}
    </p>
  );
  if (view.page === 'symptoms') {
    return (
      <div className="b2-page">
        {crumbs}
        <SymptomsB2 id={id} />
      </div>
    );
  }
  if (view.page === 'symptom') {
    return (
      <div className="b2-page">
        {crumbs}
        {symptom ? <SymptomB2 garden={garden} plant={plant} symptomId={symptom.id} /> : null}
      </div>
    );
  }

  const photo = photoUrl(plant.photo);
  const scientific = scientificBeneath(plant.displayName, plant.scientificName);
  const schedules = scheduleFor(id);
  return (
    <article className="b2-page b2-plant">
      <header className="b2-head">
        {crumbs}
        <div className="b-title">
          <h1 tabIndex={-1}>{plant.displayName}</h1>
          {scientific && <span className="scientific">{scientific}</span>}
          {plant.toxicToPets !== null && (
            <span className={plant.toxicToPets ? 'badge toxic' : 'badge'}>
              {plant.toxicToPets ? 'Toxic to pets' : 'Non-toxic to pets'}
            </span>
          )}
        </div>
      </header>
      <div className="b2-cols">
        <div className="b2-read">
          {photo ? (
            <img
              className="b2-photo"
              src={photo}
              alt={`Photo of ${plant.displayName}`}
              style={{ objectPosition: objectPosition(plant.focus, 16 / 9) }}
            />
          ) : (
            <div className="b2-photo b2-nophoto">
              <Thumb src={undefined} name={plant.displayName} size="xl" />
            </div>
          )}
          <GuideB2 plant={plant} months={schedules.months()} />
          <Section
            title="Care Log"
            meta={`${plant.events.length} ${plant.events.length === 1 ? 'entry' : 'entries'}`}
          >
            <LogTable events={plant.events} today={plant.today} />
          </Section>
        </div>
        <aside className="b2-card">
          <header className="b2-card-head">
            <h2>Care</h2>
            <span className="quiet">
              {plant.season.season === 'growing' ? 'Growing season' : 'Dormant season'}
            </span>
          </header>
          {CARE_TYPES.map((type) => {
            const { words, tone } = statusWords(plant.care[type], plant.today);
            const last = plant.events.find((event) => event.type === type)?.occurredOn;
            const every =
              type === 'repot'
                ? schedules.repotMonths && `Every ${plural(schedules.repotMonths, 'month')}`
                : schedules.every(type, plant.today);
            return (
              <div key={type} className="b2-care">
                <CareIcon type={type} size={20} />
                <span className="b2-care-label">
                  <strong>{CARE_WORDS[type].label}</strong>
                  <span className="quiet">
                    {typeof every === 'number'
                      ? `Every ${plural(every, 'day')}`
                      : (every ?? (plant.care[type].state === 'paused' ? 'Paused' : 'No schedule'))}
                  </span>
                </span>
                <span className="b2-care-status">
                  <span className={tone}>{words}</span>
                  <span className="quiet">{lastLine(last, plant.today)}</span>
                </span>
              </div>
            );
          })}
          <dl className="b2-facts">
            <div>
              <dt>Schedule</dt>
              <dd>{whoseSchedule(plant.row)}</dd>
            </div>
            {potLine(plant.row.potSizeCm, plant.row.soil) && (
              <div>
                <dt>Pot</dt>
                <dd>{potLine(plant.row.potSizeCm, plant.row.soil)}</dd>
              </div>
            )}
          </dl>
          <a className="b-wrong" href={`#/plant/${id}/symptoms`}>
            <GuideIcon name="symptom" />
            <span className="grow">
              <strong>Something wrong?</strong>
              <span className="quiet">{SOMETHING_WRONG}</span>
            </span>
            <GuideIcon name="next" size={14} />
          </a>
        </aside>
      </div>
    </article>
  );
}

/**
 * The Care Guide with nothing to switch: what changes with the Season in two columns, today's
 * marked Now, and the rest in a fixed grid, so the page never reflows.
 */
function GuideB2({
  plant,
  months,
}: {
  plant: Plant;
  months: { growing: string; dormant: string } | null;
}) {
  const { guide } = plant;
  if (!guide) {
    return (
      <Section title="Care Guide">
        <p className="quiet">No Care Guide for this plant yet.</p>
      </Section>
    );
  }
  const { profile, schedule } = guide;
  const now = plant.season.season;
  const npk = npkNote(profile.fertilizer.type);
  const every = (days: number | null) =>
    days === null ? 'Paused' : `Every ${plural(days, 'day')}`;
  const seasons = [
    ['growing', 'Growing', months ? months.growing : 'all year here'],
    ['dormant', 'Dormant', months ? months.dormant : 'never in your garden'],
  ] as const;
  return (
    <Section title="Care Guide" meta={profile.name}>
      <div className="b2-seasons" role="table" aria-label="Care by Season">
        <div role="row" className="b2-seasons-head">
          <span role="columnheader" />
          {seasons.map(([key, label, range]) => (
            <span key={key} role="columnheader" className={key === now ? 'now' : undefined}>
              <strong>{label}</strong>
              {range && <span className="quiet"> {range}</span>}
              {key === now && <span className="b2-now">Now</span>}
            </span>
          ))}
        </div>
        <div role="row">
          <span role="rowheader">
            <CareIcon type="water" /> Water
          </span>
          {seasons.map(([key]) => (
            <span key={key} role="cell" className={key === now ? 'now' : undefined}>
              {profile.watering[key]}
              <span className="b2-every">{every(schedule.water[key])}</span>
            </span>
          ))}
        </div>
        <div role="row">
          <span role="rowheader">
            <CareIcon type="fertilize" /> Feed
          </span>
          {seasons.map(([key]) => (
            <span key={key} role="cell" className={key === now ? 'now' : undefined}>
              {profile.fertilizer[key]}
              <span className="b2-every">{every(schedule.fertilize[key])}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="b2-guide-grid">
        <section>
          <h3>
            <CareIcon type="water" /> How to water
          </h3>
          <p>{profile.watering.how}</p>
        </section>
        <section>
          <h3>
            <CareIcon type="fertilize" /> Fertiliser
          </h3>
          <p>{profile.fertilizer.type}</p>
          {npk && <p className="quiet">{npk}</p>}
        </section>
        <section>
          <h3>
            <GuideIcon name="light" /> Light and warmth
          </h3>
          <LightScale light={profile.light} />
          <p>{profile.light.text}</p>
        </section>
        <section>
          <h3>
            <GuideIcon name="soil" /> Soil
          </h3>
          <p>{profile.soil}</p>
        </section>
        {guide.careNotes && (
          <section className="wide">
            <h3>
              <GuideIcon name="leaf" /> This plant
            </h3>
            <p>{guide.careNotes}</p>
          </section>
        )}
        <section className="wide b2-fact">
          <h3>
            <GuideIcon name="fact" /> Fun fact
          </h3>
          <p>
            {guide.funFact.text}{' '}
            <a className="link" href={guide.funFact.source} target="_blank" rel="noreferrer">
              More on Wikipedia
            </a>
          </p>
        </section>
      </div>
    </Section>
  );
}

function LogTable({ events, today }: { events: CareEvent[]; today: string }) {
  if (events.length === 0) return <p className="quiet">Nothing logged yet.</p>;
  return (
    <table className="b2-log">
      <tbody>
        {events.map((event) => (
          <tr key={event.id}>
            <td className="quiet b2-log-day">
              <time dateTime={event.occurredOn}>{dateLabel(event.occurredOn, today, 'short')}</time>
            </td>
            <td className="b2-log-what">
              <CareIcon type={event.type} size={16} /> {CARE_WORDS[event.type].done}
            </td>
            <td className="quiet">
              {[potLine(event.potSizeCm, event.soil), event.note].filter(Boolean).join(' · ')}
            </td>
            <td className="quiet b2-log-ago">{agoShort(event.occurredOn, today)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function agoShort(day: string, today: string) {
  const days = daysBetween(day, today);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return days < 60 ? `${days} days ago` : `${Math.round(days / 30.4)} months ago`;
}

// ---------- Symptoms ----------

function SymptomsB2({ id }: { id: string }) {
  return (
    <>
      <header className="b2-head">
        <h1 tabIndex={-1}>{SYMPTOMS_TITLE}</h1>
        <p className="quiet">
          Pick what you see; the causes most likely for this plant come first.
        </p>
      </header>
      <div className="b2-symptom-cols">
        {SYMPTOM_GROUPS.map(({ kind, title }) => (
          <Section key={kind} title={title}>
            <ul className="b2-links">
              {guides.symptoms
                .filter((symptom) => symptom.kind === kind)
                .map((symptom) => (
                  <li key={symptom.id}>
                    <a href={`#/plant/${id}/symptom/${symptom.id}`}>
                      <GuideIcon name={kind === 'pest' ? 'pest' : 'leaf'} />
                      <span className="grow">{symptom.name}</span>
                      <GuideIcon name="next" size={14} />
                    </a>
                  </li>
                ))}
            </ul>
          </Section>
        ))}
      </div>
    </>
  );
}

function SymptomB2({
  garden,
  plant,
  symptomId,
}: {
  garden: Garden;
  plant: Plant;
  symptomId: string;
}) {
  const symptom = guides.symptoms.find((candidate) => candidate.id === symptomId)!;
  const profile = plant.guide?.profile ?? null;
  const causes = symptomCauses(symptom, profile);
  return (
    <>
      <header className="b2-head">
        <h1 tabIndex={-1}>{symptom.name}</h1>
        <p className="quiet">{causesIntro(profile)}</p>
      </header>
      <div className="b2-causes" role="table" aria-label="Causes">
        <div role="row" className="b2-causes-head">
          <span role="columnheader">Cause</span>
          <span role="columnheader">How to tell</span>
          <span role="columnheader">What to do</span>
        </div>
        {causes.map((causeId) => {
          const cause = guides.causes[causeId];
          return (
            <div key={causeId} role="row">
              <span role="rowheader">
                <strong>{cause.name}</strong>
                {cause.fact && (
                  <span className="quiet">
                    {causeFactLine(
                      causeFact(garden.db, plant.id, cause.fact, plant.today),
                      plant.today,
                    )}
                  </span>
                )}
              </span>
              <span role="cell">{cause.tell}</span>
              <span role="cell">
                {cause.fix}
                {cause.petWarning && <span className="pet-warning">{PET_WARNING}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}
