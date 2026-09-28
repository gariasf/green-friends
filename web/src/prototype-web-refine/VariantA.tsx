/*
 * PROTOTYPE (#71) variant A, Reading page: the #41 panes kept, the Garden a dense text list with
 * search (Notes, Mail), the Plant pane a photo band then two columns, Care and the Care Log beside
 * the Care Guide (Airbnb). Sentence-case headings, one raised surface (Care), the rest flat with
 * rules (Things). Today: a wide grid of cards, then Everything else as a table.
 */
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useMemo, useRef, useState } from 'react';

import { dueCare, evaluateCare, needsAttention, nextCare } from '../../../src/core/care';
import { localNoon } from '../../../src/core/dates';
import { CARE_TYPES } from '../../../src/core/plants';
import {
  CARE_WORDS,
  dueLine,
  lastLine,
  nextCareLine,
  nextCareWhen,
  plantsNeedYou,
  plural,
  scientificBeneath,
  seasonLine,
  SOMETHING_WRONG,
  whoseSchedule,
} from '../../../src/ui/words';
import { SymptomsView, SymptomView } from '../guide';
import { AppMark, CareIcon, GuideIcon, objectPosition, Thumb } from '../icons';
import {
  CareLogList,
  GuideSections,
  potLine,
  SeasonToggle,
  statusWords,
  SYNCED,
  useInCare,
  useKeys,
  usePlant,
  useSearch,
  type Plant,
  type ShellProps,
} from './shared';

export function VariantA(props: ShellProps) {
  const { screen } = props;
  return (
    <div className={`vA ${screen.tab === 'today' ? '' : 'a-panes'}`}>
      <Sidebar {...props} />
      {screen.tab === 'today' ? (
        <main className="a-today">
          <TodayA {...props} />
        </main>
      ) : (
        <>
          <ListA {...props} />
          <main className="a-detail">
            {screen.tab === 'plant' ? (
              <PlantA {...props} id={screen.id} />
            ) : (
              <div className="a-pick">
                <AppMark size={40} />
                <p className="quiet">Pick a plant, or press / to search.</p>
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
}

/** The #41 sidebar, with sentence-case section labels and a keyboard hint. */
export function Sidebar({ garden, takenAt, screen }: ShellProps) {
  const counts = useMemo(() => {
    const care = evaluateCare(garden.db);
    return { needYou: care.filter(needsAttention).length, plants: care.length };
  }, [garden]);
  return (
    <header className="p-sidebar">
      <p className="brand">
        <AppMark />
        <span>Green Friends</span>
      </p>
      <nav aria-label="Screens">
        <a href="#/today" aria-current={screen.tab === 'today' ? 'page' : undefined}>
          Today
          {counts.needYou > 0 && <span className="count">{counts.needYou}</span>}
        </a>
        <a href="#/garden" aria-current={screen.tab === 'today' ? undefined : 'page'}>
          Garden
          <span className="count quiet">{counts.plants}</span>
        </a>
      </nav>
      {takenAt && <p className="synced">Synced {SYNCED.format(takenAt)}</p>}
    </header>
  );
}

function ListA({ garden, screen, photoUrl }: ShellProps) {
  const { today, byName } = useInCare(garden);
  const { query, setQuery, shown } = useSearch(byName);
  const search = useRef<HTMLInputElement>(null);
  const chosen = screen.tab === 'plant' ? screen.id : null;
  useKeys((event) => {
    if (event.key === '/') {
      event.preventDefault();
      search.current?.focus();
    }
    if (event.key === 'Escape') search.current?.blur();
    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp' ||
      event.key === 'j' ||
      event.key === 'k'
    ) {
      event.preventDefault();
      const at = shown.findIndex((plant) => plant.id === chosen);
      const step = event.key === 'ArrowDown' || event.key === 'j' ? 1 : -1;
      const next = shown[Math.min(shown.length - 1, Math.max(0, at + step))];
      if (next) location.hash = `#/plant/${next.id}`;
    }
  });
  return (
    <section className="a-list" aria-labelledby="a-garden">
      <div className="a-list-head">
        <h1 id="a-garden" tabIndex={-1}>
          Garden
        </h1>
        <label className="p-search">
          <MagnifyingGlassIcon size={16} aria-hidden="true" />
          <input
            ref={search}
            type="search"
            placeholder="Search plants"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <kbd>/</kbd>
        </label>
      </div>
      <ul>
        {shown.map((plant) => {
          const due = dueCare(plant);
          const tone = due.some((care) => care.daysOverdue > 0) ? 'overdue' : 'due-today';
          return (
            <li key={plant.id}>
              <a
                href={`#/plant/${plant.id}`}
                aria-current={plant.id === chosen ? 'page' : undefined}
              >
                <Thumb src={photoUrl(plant.photo)} focus={plant.focus} name={plant.displayName} />
                <span className="grow">
                  <span className="name">{plant.displayName}</span>
                  <span className={`a-line ${due.length > 0 ? tone : 'quiet'}`}>
                    {due.length > 0 ? dueLine(due) : nextCareLine(nextCare(plant, today))}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
        {shown.length === 0 && <li className="quiet a-none">No plant called “{query}”.</li>}
      </ul>
      <p className="a-keys quiet">
        <kbd>↑</kbd> <kbd>↓</kbd> through the Garden · <kbd>/</kbd> search
      </p>
    </section>
  );
}

function PlantA({ garden, screen, photoUrl, id }: ShellProps & { id: string }) {
  const plant = usePlant(garden, id);
  if (!plant) return <h1 tabIndex={-1}>Not in your Garden</h1>;
  const photo = photoUrl(plant.photo);
  const scientific = scientificBeneath(plant.displayName, plant.scientificName);
  const view = screen.tab === 'plant' ? screen.view : { page: 'plant' as const };
  return (
    <article className="a-plant">
      <header className={photo ? 'a-band' : 'a-band a-band-none'}>
        {photo ? (
          <img
            src={photo}
            alt={`Photo of ${plant.displayName}`}
            style={{ objectPosition: objectPosition(plant.focus, 3) }}
          />
        ) : (
          <Thumb src={undefined} name={plant.displayName} size="xl" />
        )}
        <div className="a-names">
          <h1 tabIndex={-1}>{plant.displayName}</h1>
          {scientific && <p className="scientific">{scientific}</p>}
          {plant.toxicToPets !== null && (
            <p className={plant.toxicToPets ? 'badge toxic' : 'badge'}>
              {plant.toxicToPets ? 'Toxic to pets' : 'Non-toxic to pets'}
            </p>
          )}
        </div>
      </header>
      <div className="a-cols">
        <div className="a-main">
          <h2>Care</h2>
          <CareTable plant={plant} />
          <p className="quiet">
            {[whoseSchedule(plant.row), potLine(plant.row.potSizeCm, plant.row.soil)]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <h2>Care Log</h2>
          <CareLogList events={plant.events} today={plant.today} />
        </div>
        <aside className="a-side">
          {view.page === 'symptoms' ? (
            <SymptomsView id={id} name="Care Guide" />
          ) : view.page === 'symptom' ? (
            <SymptomView
              garden={garden}
              id={id}
              name="Care Guide"
              symptomId={view.symptomId}
              profile={plant.guide?.profile ?? null}
              today={plant.today}
            />
          ) : (
            <GuideA plant={plant} id={id} />
          )}
        </aside>
      </div>
    </article>
  );
}

/** Care as the one raised surface: a row per care type, status then when last, read left to right. */
function CareTable({ plant }: { plant: Plant }) {
  return (
    <table className="a-care">
      <tbody>
        {CARE_TYPES.map((type) => {
          const { words, tone } = statusWords(plant.care[type], plant.today);
          const last = plant.events.find((event) => event.type === type)?.occurredOn;
          return (
            <tr key={type}>
              <th scope="row">
                <CareIcon type={type} /> {CARE_WORDS[type].label}
              </th>
              <td className={tone}>{words}</td>
              <td className="quiet">{lastLine(last, plant.today)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function GuideA({ plant, id }: { plant: Plant; id: string }) {
  const [season, setSeason] = useState(plant.season.season);
  const { guide } = plant;
  return (
    <>
      <div className="a-guide-head">
        <h2>Care Guide</h2>
        {guide && <SeasonToggle value={season} onChange={setSeason} />}
      </div>
      {guide ? (
        <>
          <p className="quiet">
            {guide.profile.name} · {seasonLine(plant.season, plant.today)}
          </p>
          <GuideSections guide={guide} season={season} />
        </>
      ) : (
        <p className="quiet">No Care Guide for this plant yet.</p>
      )}
      <a className="a-wrong" href={`#/plant/${id}/symptoms`}>
        <GuideIcon name="symptom" />
        <span className="grow">
          <strong>Something wrong?</strong>
          <span className="quiet"> {SOMETHING_WRONG}</span>
        </span>
        <GuideIcon name="next" size={14} />
      </a>
    </>
  );
}

function TodayA({ garden, photoUrl }: ShellProps) {
  const { today, byUrgency } = useInCare(garden);
  const plants = byUrgency.filter(needsAttention);
  const rest = byUrgency.filter((plant) => !needsAttention(plant));
  const date = localNoon(today).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return (
    <>
      <h1 tabIndex={-1}>Today</h1>
      <p className="quiet">
        {date} · {plants.length > 0 ? plantsNeedYou(plants.length) : 'Nothing needs you today'}
      </p>
      <ul className="a-cards">
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
                  <span key={type} className="a-due">
                    <CareIcon type={type} size={16} />
                    {CARE_WORDS[type].label}
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
      {rest.length > 0 && (
        <>
          <h2>Everything else</h2>
          <table className="a-table">
            <thead>
              <tr>
                <th>Plant</th>
                <th>Next</th>
                <th>When</th>
                <th>Species</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((plant) => {
                const next = nextCare(plant, today);
                return (
                  <tr key={plant.id} onClick={() => (location.hash = `#/plant/${plant.id}`)}>
                    <td>
                      <a href={`#/plant/${plant.id}`} className="a-cell-plant">
                        <Thumb
                          src={photoUrl(plant.photo)}
                          focus={plant.focus}
                          name={plant.displayName}
                        />
                        <span className="name">{plant.displayName}</span>
                      </a>
                    </td>
                    <td>
                      {next && (
                        <span className="a-next">
                          <CareIcon type={next.type} size={16} />
                          {next.paused && next.type === 'water'
                            ? 'Resting'
                            : CARE_WORDS[next.type].label}
                        </span>
                      )}
                    </td>
                    <td>{next ? nextCareWhen(next) : 'No schedule'}</td>
                    <td className="quiet">
                      <i>{plant.scientificName ?? '—'}</i>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
