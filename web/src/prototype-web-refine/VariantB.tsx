/*
 * PROTOTYPE (#71) variant B, Library: no list pane. The Garden fills the window as a photo grid
 * with search and a size control (Photos, Airbnb search). A plant opens as its own page: names,
 * a wide photo, then the Care Guide and the Care Log to read beside a sticky Care card (Airbnb's
 * listing). Today: Needs you as photo cards, then the week ahead as an agenda, a column a day.
 */
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useState } from 'react';

import { dueCare, needsAttention, nextCare } from '../../../src/core/care';
import { daysBetween, localNoon, shiftDays } from '../../../src/core/dates';
import { CARE_TYPES, type CareType } from '../../../src/core/plants';
import {
  CARE_WORDS,
  dueLine,
  lastLine,
  nextCareLine,
  plantsNeedYou,
  plural,
  scientificBeneath,
  seasonLine,
  SOMETHING_WRONG,
  whoseSchedule,
} from '../../../src/ui/words';
import { SymptomsView, SymptomView } from '../guide';
import { CareIcon, GuideIcon, objectPosition, Thumb } from '../icons';
import {
  CareLogList,
  GuideSections,
  potLine,
  SeasonToggle,
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

export function VariantB(props: ShellProps) {
  const { screen } = props;
  return (
    <div className="vB">
      <Sidebar {...props} />
      <main className="b-main">
        {screen.tab === 'today' && <TodayB {...props} />}
        {screen.tab === 'garden' && <GardenB {...props} />}
        {screen.tab === 'plant' && <PlantB {...props} id={screen.id} />}
      </main>
    </div>
  );
}

function GardenB({ garden, photoUrl }: ShellProps) {
  const { today, byName } = useInCare(garden);
  const { query, setQuery, shown } = useSearch(byName);
  const [size, setSize] = useState<keyof typeof SIZES>('M');
  useKeys((event) => {
    if (event.key === '/') {
      event.preventDefault();
      document.querySelector<HTMLInputElement>('.b-toolbar input')?.focus();
    }
  });
  return (
    <>
      <div className="b-toolbar">
        <h1 tabIndex={-1}>Garden</h1>
        <span className="quiet">{plural(byName.length, 'plant')}</span>
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
    </>
  );
}

function PlantB({ garden, screen, photoUrl, id }: ShellProps & { id: string }) {
  const plant = usePlant(garden, id);
  if (!plant) return <h1 tabIndex={-1}>Not in your Garden</h1>;
  const view = screen.tab === 'plant' ? screen.view : { page: 'plant' as const };
  const crumbs = (
    <p className="b-crumbs">
      <a href="#/garden">Garden</a> <span aria-hidden="true">/</span>{' '}
      {view.page === 'plant' || view.page === 'guide' ? (
        plant.displayName
      ) : (
        <a href={`#/plant/${id}`}>{plant.displayName}</a>
      )}
    </p>
  );
  if (view.page === 'symptoms' || view.page === 'symptom') {
    return (
      <div className="b-narrow">
        {crumbs}
        {view.page === 'symptoms' ? (
          <SymptomsView id={id} name={plant.displayName} />
        ) : (
          <SymptomView
            garden={garden}
            id={id}
            name={plant.displayName}
            symptomId={'symptomId' in view ? view.symptomId : ''}
            profile={plant.guide?.profile ?? null}
            today={plant.today}
          />
        )}
      </div>
    );
  }
  const photo = photoUrl(plant.photo);
  const scientific = scientificBeneath(plant.displayName, plant.scientificName);
  return (
    <article className="b-plant">
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
      {photo && (
        <img
          className="b-photo"
          src={photo}
          alt={`Photo of ${plant.displayName}`}
          style={{ objectPosition: objectPosition(plant.focus, 2.4) }}
        />
      )}
      <div className="b-cols">
        <div className="b-read">
          <GuideB plant={plant} id={id} />
          <h2>Care Log</h2>
          <CareLogList events={plant.events} today={plant.today} />
        </div>
        <aside className="b-card">
          <h2>Care</h2>
          {CARE_TYPES.map((type) => {
            const { words, tone } = statusWords(plant.care[type], plant.today);
            const last = plant.events.find((event) => event.type === type)?.occurredOn;
            return (
              <div key={type} className="b-care">
                <CareIcon type={type} size={20} />
                <span className="grow">
                  <strong>{CARE_WORDS[type].label}</strong>
                  <span className="quiet">{lastLine(last, plant.today)}</span>
                </span>
                <span className={tone}>{words}</span>
              </div>
            );
          })}
          <p className="quiet b-sched">
            {[whoseSchedule(plant.row), potLine(plant.row.potSizeCm, plant.row.soil)]
              .filter(Boolean)
              .join(' · ')}
          </p>
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

function GuideB({ plant }: { plant: Plant; id: string }) {
  const [season, setSeason] = useState(plant.season.season);
  const { guide } = plant;
  if (!guide) {
    return (
      <>
        <h2>Care Guide</h2>
        <p className="quiet">No Care Guide for this plant yet.</p>
      </>
    );
  }
  return (
    <>
      <div className="b-guide-head">
        <div>
          <h2>Care Guide</h2>
          <p className="quiet">
            {guide.profile.name} · {seasonLine(plant.season, plant.today)}
          </p>
        </div>
        <SeasonToggle value={season} onChange={setSeason} />
      </div>
      <div className="b-sections">
        <GuideSections guide={guide} season={season} />
      </div>
    </>
  );
}

type Coming = { plantId: string; name: string; photo: string | null; type: CareType };

function TodayB({ garden, photoUrl }: ShellProps) {
  const { today, byUrgency } = useInCare(garden);
  const plants = byUrgency.filter(needsAttention);
  const date = localNoon(today).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  // The next seven days, each with the care that comes Due on it.
  const days = Array.from({ length: 7 }, (_, offset) => shiftDays(today, offset + 1));
  const byDay = new Map<string, Coming[]>(days.map((day) => [day, []]));
  let later = 0;
  for (const plant of byUrgency) {
    for (const type of CARE_TYPES) {
      const status = plant.care[type];
      if (status.state !== 'upcoming') continue;
      const list = byDay.get(status.dueOn);
      if (list) list.push({ plantId: plant.id, name: plant.displayName, photo: plant.photo, type });
      else if (daysBetween(today, status.dueOn) > 7) later += 1;
    }
  }
  return (
    <>
      <h1 tabIndex={-1}>Today</h1>
      <p className="quiet">
        {date} · {plants.length > 0 ? plantsNeedYou(plants.length) : 'Nothing needs you today'}
      </p>
      <ul className="b-need">
        {plants.map((plant) => (
          <li key={plant.id}>
            <a href={`#/plant/${plant.id}`}>
              <Thumb
                src={photoUrl(plant.photo)}
                focus={plant.focus}
                name={plant.displayName}
                size="cell"
              />
              <span className="name">{plant.displayName}</span>
              {dueCare(plant).map(({ type, daysOverdue }) => (
                <span key={type} className="b-due">
                  <CareIcon type={type} size={16} />
                  {CARE_WORDS[type].label}
                  <span className={daysOverdue > 0 ? 'overdue' : 'due-today'}>
                    {daysOverdue > 0 ? `${plural(daysOverdue, 'day')} overdue` : 'due today'}
                  </span>
                </span>
              ))}
            </a>
          </li>
        ))}
      </ul>
      <h2>The week ahead</h2>
      <ol className="b-week">
        {days.map((day, index) => {
          const coming = byDay.get(day) ?? [];
          const noon = localNoon(day);
          return (
            <li key={day} className={coming.length === 0 ? 'b-empty' : undefined}>
              <p className="b-day">
                <strong>
                  {index === 0
                    ? 'Tomorrow'
                    : noon.toLocaleDateString(undefined, { weekday: 'short' })}
                </strong>{' '}
                <span className="quiet">{noon.getDate()}</span>
              </p>
              {coming.map((care) => (
                <a
                  key={care.plantId + care.type}
                  href={`#/plant/${care.plantId}`}
                  className="b-chip"
                >
                  <CareIcon type={care.type} size={14} />
                  <span>{care.name}</span>
                </a>
              ))}
              {coming.length === 0 && <span className="quiet">—</span>}
            </li>
          );
        })}
      </ol>
      {later > 0 && <p className="quiet">{later} more after that.</p>}
    </>
  );
}
