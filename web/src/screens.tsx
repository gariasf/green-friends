import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import {
  dueCare,
  effectiveSchedule,
  evaluateCare,
  needsAttention,
  nextCare,
  plantSeasonOn,
  type SeasonOn,
} from '../../src/core/care';
import { readCareGuide } from '../../src/core/careGuide';
import { listCareEvents, type CareEvent } from '../../src/core/careLog';
import { localDay, localNoon, shiftDays } from '../../src/core/dates';
import {
  CARE_TYPES,
  getPlant,
  listPlants,
  SEASONAL,
  type CareSchedule,
  type CareType,
} from '../../src/core/plants';
import { getSettings } from '../../src/core/settings';
import { getSpecies } from '../../src/core/species';
import {
  agoLine,
  CARE_WORDS,
  COMING_UP,
  dateLabel,
  dueLine,
  dueThisWeek,
  entries,
  everyLine,
  lastLine,
  nextCareLine,
  NEEDS_YOU,
  NO_SCHEDULE_LINE,
  noPlantCalled,
  plantsInCare,
  plantsNeedYou,
  plural,
  scientificBeneath,
  SEARCH_PLANTS,
  seasonLine,
  SOMETHING_WRONG,
  tileValue,
  whoseSchedule,
} from '../../src/ui/words';
import type { Garden } from './garden';
import { guides } from '../../src/ui/guides';
import { Calendar } from './calendar';
import { Breadcrumbs, Section, Toggle } from './frame';
import {
  GuideSection,
  seasonInterval,
  seasonMonths,
  SymptomsView,
  SymptomView,
  type PlantView,
} from './guide';
import { CareIcon, GuideIcon, objectPosition, Thumb } from './icons';
import { planDays } from './plan';

/** A photo's address in this page, by its filename; none for a plant without one. */
export type PhotoUrl = (filename: string | null) => string | undefined;

// ponytail: the day is the one the screen was drawn on; left open past midnight, Today shows
// yesterday until the next navigation, as the phone's does until the next write.
/**
 * Today (spec #72): the browser's day and how many plants need you, each plant that Needs
 * Attention as a card with what is Due or Overdue and by how much, then Coming up, two weeks from
 * this week's Monday as a calendar. Read-only, so a plant opens its page rather than logging care.
 */
export function Today({ garden, photoUrl }: { garden: Garden; photoUrl: PhotoUrl }) {
  const today = localDay(new Date());
  const inCare = useMemo(() => evaluateCare(garden.db, today), [garden, today]);
  const plants = inCare.filter(needsAttention);
  // Weeks start on Monday.
  const monday = shiftDays(today, -((localNoon(today).getDay() + 6) % 7));
  const plan = useMemo(() => planDays(garden.db, today, monday, 14), [garden, today, monday]);
  const dueThisWeekCount = plan
    .slice(0, 7)
    .filter(({ day }) => day >= today)
    .flatMap(({ items }) => items)
    .filter(({ kind }) => kind !== 'done').length;
  const date = localNoon(today).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const range = `${dateLabel(plan[0].day, today)} – ${dateLabel(plan[13].day, today)}`;

  return (
    <>
      <header className="page-head">
        <h1 tabIndex={-1}>Today</h1>
        <p className="quiet">
          {plants.length > 0 ? `${date} · ${plantsNeedYou(plants.length)}` : date}
        </p>
      </header>
      {inCare.length === 0 && (
        <Empty title="No plants in care" line="Add one in Green Friends on your phone." />
      )}
      {inCare.length > 0 && plants.length === 0 && (
        <Empty title="All caught up" line="Nothing needs you today." />
      )}
      {plants.length > 0 && (
        <Section title={NEEDS_YOU} note={plural(plants.length, 'plant')}>
          <ul className="cards">
            {plants.map((plant) => (
              <li key={plant.id}>
                <a className="card" href={`#/plant/${plant.id}`}>
                  <Thumb
                    src={photoUrl(plant.photo)}
                    focus={plant.focus}
                    name={plant.displayName}
                    size="lg"
                  />
                  <span className="card-body">
                    <span className="name">{plant.displayName}</span>
                    <ul className="due">
                      {dueCare(plant).map(({ type, daysOverdue }) => (
                        <li key={type}>
                          <CareIcon type={type} size={16} />
                          <span>{CARE_WORDS[type].label}</span>
                          {daysOverdue > 0 ? (
                            <span className="overdue">{plural(daysOverdue, 'day')} overdue</span>
                          ) : (
                            <span className="due-today">Due today</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {inCare.length > 0 && (
        <Section title={COMING_UP} note={`${range} · ${dueThisWeek(dueThisWeekCount)}`}>
          <Calendar plan={plan} today={today} photoUrl={photoUrl} />
        </Section>
      )}
    </>
  );
}

const SIZES = { S: '9rem', M: '13rem', L: '18rem' } as const;
type Size = keyof typeof SIZES;
const SIZE_KEY = 'garden-photo-size';

/** The photo size this browser chose last; M where it chose none or keeps nothing. */
function storedSize(): Size {
  try {
    const kept = localStorage.getItem(SIZE_KEY);
    return kept && kept in SIZES ? (kept as Size) : 'M';
  } catch {
    return 'M';
  }
}

/**
 * The Garden, a page of its own (spec #72): every plant in care by Display Name as a grid of
 * square photos across the window (spec #61), each over what's Due or Overdue, or its next care;
 * above it, All | Needs you, a search by name (`/` to reach it) and the photos' size.
 */
export function GardenPage({ garden, photoUrl }: { garden: Garden; photoUrl: PhotoUrl }) {
  // The day the screen was drawn on, as Today's.
  const today = localDay(new Date());
  const plants = useMemo(() => {
    const care = new Map(evaluateCare(garden.db, today).map((plant) => [plant.id, plant]));
    return listPlants(garden.db).flatMap((plant) => care.get(plant.id) ?? []);
  }, [garden, today]);
  const [show, setShow] = useState<'all' | 'needYou'>('all');
  const [query, setQuery] = useState('');
  const [size, setSize] = useState<Size>(storedSize);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement).closest('input, textarea, [contenteditable]');
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        search.current?.focus();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const choose = (next: Size) => {
    setSize(next);
    try {
      localStorage.setItem(SIZE_KEY, next);
    } catch {
      // Kept for this visit only.
    }
  };
  const needYou = plants.filter(needsAttention);
  const needle = query.trim().toLowerCase();
  const shown = (show === 'needYou' ? needYou : plants).filter(
    (plant) =>
      !needle ||
      `${plant.displayName} ${plant.scientificName ?? ''}`.toLowerCase().includes(needle),
  );

  return (
    <>
      <header className="page-head garden-head">
        <div>
          <h1 tabIndex={-1}>Garden</h1>
          <p className="quiet">{plantsInCare(plants.length)}</p>
        </div>
        {plants.length > 0 && (
          <div className="tools">
            <Toggle
              label="Show"
              options={[
                ['all', 'All'],
                ['needYou', `${NEEDS_YOU} · ${needYou.length}`],
              ]}
              value={show}
              onChange={setShow}
            />
            <label className="search">
              <MagnifyingGlassIcon size={16} aria-hidden="true" />
              <input
                ref={search}
                type="search"
                placeholder={SEARCH_PLANTS}
                aria-label={SEARCH_PLANTS}
                aria-keyshortcuts="/"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Escape' && event.currentTarget.blur()}
              />
              <kbd aria-hidden="true">/</kbd>
            </label>
            <Toggle
              label="Photo size"
              options={(Object.keys(SIZES) as Size[]).map((key) => [key, key])}
              value={size}
              onChange={choose}
            />
          </div>
        )}
      </header>
      {plants.length === 0 && (
        <Empty title="No plants yet" line="Add one in Green Friends on your phone." />
      )}
      {plants.length > 0 && shown.length === 0 && (
        <p className="quiet">{needle ? noPlantCalled(query) : 'Nothing needs you today.'}</p>
      )}
      <ul className={`garden-grid size-${size}`} style={{ '--cell': SIZES[size] } as CSSProperties}>
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
                <span className="quiet line">
                  {due.length > 0 && <span className={`dot ${tone}`} />}
                  {due.length > 0 ? dueLine(due) : nextCareLine(nextCare(plant, today))}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * A plant on a page of its own (spec #72): its names, then the photo with the Care card beside it,
 * each care type's interval, status and when it was last done, whose schedule it follows, its Pot
 * and Something wrong?; under the photo its Care Guide (spec #48) and its Care Log. By `view`, its
 * Symptoms or one Symptom instead. The Web view lists only plants in care, so a link to any other
 * says so.
 */
export function PlantDetail({
  garden,
  id,
  view,
  photoUrl,
}: {
  garden: Garden;
  id: string;
  view: PlantView;
  photoUrl: PhotoUrl;
}) {
  const today = localDay(new Date());
  const plant = useMemo(() => {
    const care = evaluateCare(garden.db, today).find((candidate) => candidate.id === id);
    if (!care) return undefined;
    const row = getPlant(garden.db, id);
    const species = row.speciesId ? getSpecies(garden.db, row.speciesId) : null;
    return {
      ...care,
      row,
      events: listCareEvents(garden.db, id),
      guide: readCareGuide(garden.db, id, today, guides),
      season: plantSeasonOn(garden.db, row.speciesId, today),
      schedule: effectiveSchedule(row, species),
      months: seasonMonths(getSettings(garden.db), species?.restsInSummer ?? false),
    };
  }, [garden, id, today]);

  if (!plant) {
    return (
      <>
        <Breadcrumbs trail={[['Garden', '#/garden']]} />
        <h1 tabIndex={-1}>Not in your Garden</h1>
        <p>This plant isn&apos;t in the Garden your phone last synced.</p>
      </>
    );
  }

  const { row, events, guide } = plant;
  const name = plant.displayName;
  if (view.page === 'symptoms') return <SymptomsView id={id} name={name} />;
  if (view.page === 'symptom') {
    return (
      <SymptomView
        garden={garden}
        id={id}
        name={name}
        symptomId={view.symptomId}
        profile={guide?.profile ?? null}
        today={today}
      />
    );
  }

  const photo = photoUrl(plant.photo);
  const pot = potLine(row.potSizeCm, row.soil);
  return (
    <>
      <Breadcrumbs trail={[['Garden', '#/garden'], [name]]} />
      <header className="page-head plant-head">
        <h1 tabIndex={-1}>{name}</h1>
        <Scientific name={name} scientificName={plant.scientificName} />
        {plant.toxicToPets !== null && (
          <span className={plant.toxicToPets ? 'badge toxic' : 'badge'}>
            {plant.toxicToPets ? 'Toxic to pets' : 'Non-toxic to pets'}
          </span>
        )}
      </header>
      <div className="plant-columns">
        <div className="plant-main">
          {photo ? (
            <img
              className="plant-photo"
              src={photo}
              alt={`Photo of ${name}`}
              style={{ objectPosition: objectPosition(plant.focus, 16 / 9) }}
            />
          ) : (
            <div className="plant-photo initial band" aria-hidden="true">
              {name.trim().charAt(0).toUpperCase()}
            </div>
          )}
          <GuideSection guide={guide} months={plant.months} />
          <Section title="Care Log" note={entries(events.length)}>
            {events.length === 0 ? (
              <p className="quiet">Nothing logged yet.</p>
            ) : (
              <table className="log">
                <tbody>
                  {events.map((event) => (
                    <CareLogRow key={event.id} event={event} today={today} />
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>

        <aside className="care-card" aria-labelledby="care-heading">
          <header className="care-card-head">
            <h2 id="care-heading">Care</h2>
            <span className="quiet">{seasonLine(plant.season, today)}</span>
          </header>
          <ul className="care-rows">
            {CARE_TYPES.map((type) => {
              const status = plant.care[type];
              const [, spoken] = tileValue(status, today);
              const lastDone = events.find((event) => event.type === type)?.occurredOn;
              const tone =
                status.state === 'due' ? (status.daysOverdue > 0 ? 'overdue' : 'due-today') : '';
              return (
                <li key={type}>
                  <CareIcon type={type} size={20} />
                  <span className="grow">
                    <strong>{CARE_WORDS[type].label}</strong>
                    <span className="quiet">
                      {intervalLine(type, plant.schedule, plant.season.season)}
                    </span>
                  </span>
                  <span className="status">
                    <span className={tone}>{sentence(spoken)}</span>
                    <span className="quiet">{lastLine(lastDone, today)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <dl className="facts">
            <div>
              <dt>Schedule</dt>
              <dd>{whoseSchedule(row)}</dd>
            </div>
            {pot && (
              <div>
                <dt>Pot</dt>
                <dd>{pot}</dd>
              </div>
            )}
          </dl>
          <a className="wrong" href={`#/plant/${id}/symptoms`}>
            <GuideIcon name="symptom" />
            <span className="grow">
              <strong>Something wrong?</strong>
              <span className="quiet">{SOMETHING_WRONG}</span>
            </span>
            <GuideIcon name="next" size={14} />
          </a>
        </aside>
      </div>
    </>
  );
}

/** A care type's interval in today's Season: "Every 7 days", "Every 24 months", Paused, or none. */
function intervalLine(type: CareType, schedule: CareSchedule, season: SeasonOn['season']): string {
  if (type === 'repot') {
    const months = schedule.repottingMonths;
    return months === null ? NO_SCHEDULE_LINE : everyLine(months, 'month');
  }
  const { growing, dormant } = SEASONAL[type];
  return seasonInterval({ growing: schedule[growing], dormant: schedule[dormant] }, season);
}

/** A Care Event: its day, what was done, its details, and how long ago. */
function CareLogRow({ event, today }: { event: CareEvent; today: string }) {
  const detail = [potLine(event.potSizeCm, event.soil), event.note].filter(Boolean).join(' · ');
  return (
    <tr>
      <td className="quiet day">
        <time dateTime={event.occurredOn}>{dateLabel(event.occurredOn, today, 'short')}</time>
      </td>
      <td className="what">
        <CareIcon type={event.type} size={16} />
        {CARE_WORDS[event.type].done}
      </td>
      <td className="quiet">{detail}</td>
      <td className="quiet ago">{sentence(agoLine(event.occurredOn, today))}</td>
    </tr>
  );
}

/** The scientific name beneath a Display Name, unless it says the same. */
function Scientific({ name, scientificName }: { name: string; scientificName: string | null }) {
  const scientific = scientificBeneath(name, scientificName);
  return scientific && <span className="scientific">{scientific}</span>;
}

function Empty({ title, line }: { title: string; line: string }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p className="quiet">{line}</p>
    </div>
  );
}

/** A pot's size and soil, those it has: "21 cm pot · Aroid mix". */
function potLine(sizeCm: number | null, soil: string | null): string {
  return [sizeCm !== null && `${sizeCm} cm pot`, soil].filter(Boolean).join(' · ');
}

/** Words said mid-sentence ("due in 3 days"), as a line of their own. */
function sentence(words: string): string {
  return words[0].toUpperCase() + words.slice(1);
}
