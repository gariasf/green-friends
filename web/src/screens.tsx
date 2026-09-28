import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import {
  dueCare,
  evaluateCare,
  needsAttention,
  nextCare,
  plantSeasonOn,
} from '../../src/core/care';
import { readCareGuide } from '../../src/core/careGuide';
import { listCareEvents, type CareEvent } from '../../src/core/careLog';
import { localDay, localNoon } from '../../src/core/dates';
import { CARE_TYPES, getPlant, listPlants } from '../../src/core/plants';
import {
  CARE_WORDS,
  dayLabel,
  dueLine,
  lastLine,
  nextCareLine,
  NEEDS_YOU,
  noPlantCalled,
  plantsInCare,
  plantsNeedYou,
  plural,
  scientificBeneath,
  SEARCH_PLANTS,
  tileValue,
  whoseSchedule,
} from '../../src/ui/words';
import type { Garden } from './garden';
import { guides } from '../../src/ui/guides';
import { Breadcrumbs, Section, Toggle } from './frame';
import { CareRows, GuideView, SymptomsView, SymptomView, type PlantView } from './guide';
import { CareIcon, objectPosition, Thumb } from './icons';

/** A photo's address in this page, by its filename; none for a plant without one. */
export type PhotoUrl = (filename: string | null) => string | undefined;

// ponytail: the day is the one the screen was drawn on; left open past midnight, Today shows
// yesterday until the next navigation, as the phone's does until the next write.
/**
 * Today, as the phone's (spec #35): the browser's day and how many plants need you, then each plant
 * that Needs Attention, most Overdue first, with what is Due or Overdue and by how much, and the
 * rest with their next care. Read-only, so a plant opens its Plant screen rather than logging care.
 */
export function Today({ garden, photoUrl }: { garden: Garden; photoUrl: PhotoUrl }) {
  const today = localDay(new Date());
  // listNeedsAttention, and the rest of the plants in care beside it.
  const inCare = useMemo(() => evaluateCare(garden.db, today), [garden, today]);
  const plants = inCare.filter(needsAttention);
  const rest = inCare.filter((plant) => !needsAttention(plant));
  const date = localNoon(today).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

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
                <Scientific name={plant.displayName} scientificName={plant.scientificName} />
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
      {rest.length > 0 && (
        <Section title="Everything else">
          <ul className="group rows">
            {rest.map((plant) => {
              const next = nextCare(plant, today);
              return (
                <li key={plant.id}>
                  <a href={`#/plant/${plant.id}`}>
                    <Thumb
                      src={photoUrl(plant.photo)}
                      focus={plant.focus}
                      name={plant.displayName}
                    />
                    <span className="name">{plant.displayName}</span>
                    <span className="quiet next">
                      {next && <CareIcon type={next.type} size={14} />}
                      {nextCareLine(next)}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
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
 * A plant, as the phone's Plant screen without its buttons: the photo beside its names and pet
 * toxicity, a row per care type with when it's next Due (or how long Overdue, or Paused) and when
 * it was last done, whose schedule it follows and its Current Pot, its Care group (spec #48) and
 * its Care Log; or, by `view`, its Care Guide, the Symptoms or one Symptom in its place. The Web view
 * lists only plants in care, so a link to any other says so.
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
    return {
      ...care,
      row,
      events: listCareEvents(garden.db, id),
      guide: readCareGuide(garden.db, id, today, guides),
      season: plantSeasonOn(garden.db, row.speciesId, today),
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
  if (view.page === 'guide' && guide) {
    return (
      <div className="plant">
        <GuideView id={id} name={name} guide={guide} today={today} />
      </div>
    );
  }
  if (view.page === 'symptoms') {
    return (
      <div className="plant">
        <SymptomsView id={id} name={name} />
      </div>
    );
  }
  if (view.page === 'symptom') {
    return (
      <div className="plant">
        <SymptomView
          garden={garden}
          id={id}
          name={name}
          symptomId={view.symptomId}
          profile={guide?.profile ?? null}
          today={today}
        />
      </div>
    );
  }

  const photo = photoUrl(plant.photo);
  const badge = plant.toxicToPets !== null && (
    <p className={plant.toxicToPets ? 'badge toxic' : 'badge'}>
      {plant.toxicToPets ? 'Toxic to pets' : 'Non-toxic to pets'}
    </p>
  );
  return (
    <div className="plant">
      <Breadcrumbs trail={[['Garden', '#/garden'], [name]]} />
      {photo ? (
        // As the phone's hero: the photo across the page's column, the names over its foot on a scrim.
        <div className="hero">
          <img
            src={photo}
            alt={`Photo of ${plant.displayName}`}
            style={{ objectPosition: objectPosition(plant.focus, 3 / 2) }}
          />
          <div className="hero-names">
            <h1 tabIndex={-1}>{plant.displayName}</h1>
            <Scientific name={plant.displayName} scientificName={plant.scientificName} />
          </div>
          {badge}
        </div>
      ) : (
        <div className="head">
          <Thumb src={undefined} name={plant.displayName} size="xl" />
          <div>
            <h1 tabIndex={-1}>{plant.displayName}</h1>
            <Scientific name={plant.displayName} scientificName={plant.scientificName} />
            {badge}
          </div>
        </div>
      )}

      <Section title="Care">
        <dl className="group care">
          {CARE_TYPES.map((type) => {
            const status = plant.care[type];
            const [, spoken] = tileValue(status, today);
            const lastDone = events.find((event) => event.type === type)?.occurredOn;
            const tone =
              status.state === 'due' ? (status.daysOverdue > 0 ? 'overdue' : 'due-today') : '';
            return (
              <div key={type}>
                <dt>
                  <CareIcon type={type} />
                  {CARE_WORDS[type].label}
                </dt>
                <dd>
                  <span className={tone}>{sentence(spoken)}</span>
                  <span className="quiet">{lastLine(lastDone, today)}</span>
                </dd>
              </div>
            );
          })}
        </dl>
        <p className="quiet">
          {[whoseSchedule(row), potLine(row.potSizeCm, row.soil)].filter(Boolean).join(' · ')}
        </p>
      </Section>

      <CareRows id={id} guide={guide} season={plant.season} today={today} />

      <Section title="Care Log">
        {events.length === 0 ? (
          <p className="quiet">Nothing logged yet.</p>
        ) : (
          <ol className="group log">
            {events.map((event) => (
              <CareLogRow key={event.id} event={event} today={today} />
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

/** A Care Event: its symbol, what was done and its details, and its day on the right. */
function CareLogRow({ event, today }: { event: CareEvent; today: string }) {
  const detail = [potLine(event.potSizeCm, event.soil), event.note].filter(Boolean).join(' · ');
  return (
    <li>
      <CareIcon type={event.type} size={16} />
      <span className="grow">
        <strong>{CARE_WORDS[event.type].done}</strong>
        {detail && <span className="quiet">{detail}</span>}
      </span>
      <time className="quiet" dateTime={event.occurredOn}>
        {dayLabel(event.occurredOn, today)}
      </time>
    </li>
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

/** Words the tiles say mid-sentence ("due in 3 days"), as a line of their own. */
function sentence(words: string): string {
  return words[0].toUpperCase() + words.slice(1);
}
