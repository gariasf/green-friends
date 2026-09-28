/*
 * PROTOTYPE (#71) variant C, Table and inspector (Linear): the sidebar folds to an icon rail, the
 * Garden is a table with a column per care type, searchable and keyboard-driven (↑/↓ or j/k, /,
 * Esc), and a plant opens in an inspector on the right with tabs: Care, Care Guide, Symptoms.
 * Today is a flat Things-style list grouped by when: Overdue, Due today, This week, Later.
 */
import {
  CalendarCheckIcon,
  MagnifyingGlassIcon,
  PottedPlantIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useMemo, useRef, useState } from 'react';

import { evaluateCare, needsAttention, type PlantCare } from '../../../src/core/care';
import { daysBetween, localNoon } from '../../../src/core/dates';
import { CARE_TYPES, type CareType } from '../../../src/core/plants';
import {
  CARE_WORDS,
  dateLabel,
  lastLine,
  plantsNeedYou,
  plural,
  scientificBeneath,
  seasonLine,
  whoseSchedule,
} from '../../../src/ui/words';
import { SymptomsView, SymptomView } from '../guide';
import { AppMark, CareIcon, objectPosition, Thumb } from '../icons';
import {
  CareLogList,
  GuideSections,
  potLine,
  SeasonToggle,
  statusShort,
  statusWords,
  SYNCED,
  useInCare,
  useKeys,
  usePlant,
  useSearch,
  type Plant,
  type ShellProps,
} from './shared';

export function VariantC(props: ShellProps) {
  const { screen } = props;
  const chosen = screen.tab === 'plant' ? screen.id : null;
  return (
    <div className={`vC ${chosen ? 'c-open' : ''}`}>
      <Rail {...props} />
      <main className="c-main">
        {screen.tab === 'today' ? <TodayC {...props} /> : <TableC {...props} chosen={chosen} />}
      </main>
      {chosen && (
        <aside className="c-inspector" aria-label="Plant">
          <Inspector {...props} id={chosen} />
        </aside>
      )}
    </div>
  );
}

function Rail({ garden, takenAt, screen }: ShellProps) {
  const needYou = useMemo(() => evaluateCare(garden.db).filter(needsAttention).length, [garden]);
  return (
    <nav className="c-rail" aria-label="Screens">
      <span className="c-mark" title="Green Friends">
        <AppMark size={28} />
      </span>
      <a
        href="#/today"
        title="Today"
        aria-label="Today"
        aria-current={screen.tab === 'today' ? 'page' : undefined}
      >
        <CalendarCheckIcon size={22} aria-hidden="true" />
        {needYou > 0 && <span className="c-badge">{needYou}</span>}
      </a>
      <a
        href="#/garden"
        title="Garden"
        aria-label="Garden"
        aria-current={screen.tab === 'today' ? undefined : 'page'}
      >
        <PottedPlantIcon size={22} aria-hidden="true" />
      </a>
      {takenAt && (
        <span className="c-synced" title={`Synced ${SYNCED.format(takenAt)}`}>
          {takenAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </span>
      )}
    </nav>
  );
}

function TableC({ garden, photoUrl, chosen }: ShellProps & { chosen: string | null }) {
  const { today, byName } = useInCare(garden);
  const { query, setQuery, shown } = useSearch(byName);
  const search = useRef<HTMLInputElement>(null);
  useKeys((event) => {
    if (event.key === '/') {
      event.preventDefault();
      search.current?.focus();
    } else if (event.key === 'Escape') {
      if (document.activeElement === search.current) search.current?.blur();
      else if (chosen) location.hash = '#/garden';
    } else if (['ArrowDown', 'ArrowUp', 'j', 'k'].includes(event.key)) {
      event.preventDefault();
      const at = shown.findIndex((plant) => plant.id === chosen);
      const step = event.key === 'ArrowDown' || event.key === 'j' ? 1 : -1;
      const next = shown[Math.min(shown.length - 1, Math.max(0, at + step))];
      if (next) location.hash = `#/plant/${next.id}`;
    }
  });
  return (
    <>
      <div className="c-bar">
        <h1 tabIndex={-1}>Garden</h1>
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
        <span className="quiet c-hint">
          <kbd>↑</kbd>
          <kbd>↓</kbd> move · <kbd>esc</kbd> close
        </span>
      </div>
      <table className="c-table">
        <thead>
          <tr>
            <th>Plant</th>
            {CARE_TYPES.map((type) => (
              <th key={type}>
                <CareIcon type={type} size={14} /> {CARE_WORDS[type].label}
              </th>
            ))}
            <th className="c-pets">Pets</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((plant) => (
            <tr
              key={plant.id}
              aria-selected={plant.id === chosen}
              onClick={() => (location.hash = `#/plant/${plant.id}`)}
            >
              <td>
                <a href={`#/plant/${plant.id}`} className="c-plant">
                  <Thumb src={photoUrl(plant.photo)} focus={plant.focus} name={plant.displayName} />
                  <span>
                    <span className="name">{plant.displayName}</span>
                    <span className="scientific">
                      {scientificBeneath(plant.displayName, plant.scientificName)}
                    </span>
                  </span>
                </a>
              </td>
              {CARE_TYPES.map((type) => {
                const { words, tone } = statusShort(plant.care[type], today);
                return (
                  <td key={type} className={tone}>
                    {words}
                  </td>
                );
              })}
              <td className="c-pets">
                {plant.toxicToPets === null ? (
                  <span className="quiet">—</span>
                ) : plant.toxicToPets ? (
                  <span className="overdue">Toxic</span>
                ) : (
                  <span className="quiet">Safe</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length === 0 && <p className="quiet c-none">No plant called “{query}”.</p>}
    </>
  );
}

function Inspector({ garden, screen, photoUrl, id }: ShellProps & { id: string }) {
  const plant = usePlant(garden, id);
  if (!plant) return <h1 tabIndex={-1}>Not in your Garden</h1>;
  const view = screen.tab === 'plant' ? screen.view : { page: 'plant' as const };
  const tab = view.page === 'symptom' ? 'symptoms' : view.page;
  const photo = photoUrl(plant.photo);
  const scientific = scientificBeneath(plant.displayName, plant.scientificName);
  return (
    <>
      <div className="c-head">
        {photo ? (
          <img src={photo} alt="" style={{ objectPosition: objectPosition(plant.focus, 1) }} />
        ) : (
          <Thumb src={undefined} name={plant.displayName} size="lg" />
        )}
        <div className="grow">
          <h1 tabIndex={-1}>{plant.displayName}</h1>
          {scientific && <span className="scientific">{scientific}</span>}
          {plant.toxicToPets !== null && (
            <span className={plant.toxicToPets ? 'badge toxic' : 'badge'}>
              {plant.toxicToPets ? 'Toxic to pets' : 'Non-toxic to pets'}
            </span>
          )}
        </div>
        <a className="c-close" href="#/garden" aria-label="Close" title="Close (Esc)">
          <XIcon size={18} />
        </a>
      </div>
      <nav className="c-tabs" aria-label="Plant">
        <a href={`#/plant/${id}`} aria-current={tab === 'plant' ? 'page' : undefined}>
          Care
        </a>
        <a href={`#/plant/${id}/guide`} aria-current={tab === 'guide' ? 'page' : undefined}>
          Care Guide
        </a>
        <a href={`#/plant/${id}/symptoms`} aria-current={tab === 'symptoms' ? 'page' : undefined}>
          Something wrong?
        </a>
      </nav>
      <div className="c-body">
        {tab === 'plant' && <CareTab plant={plant} />}
        {tab === 'guide' && <GuideTab plant={plant} />}
        {view.page === 'symptoms' && <SymptomsView id={id} name={plant.displayName} />}
        {view.page === 'symptom' && (
          <SymptomView
            garden={garden}
            id={id}
            name={plant.displayName}
            symptomId={view.symptomId}
            profile={plant.guide?.profile ?? null}
            today={plant.today}
          />
        )}
      </div>
    </>
  );
}

function CareTab({ plant }: { plant: Plant }) {
  return (
    <>
      <dl className="c-props">
        {CARE_TYPES.map((type) => {
          const { words, tone } = statusWords(plant.care[type], plant.today);
          const last = plant.events.find((event) => event.type === type)?.occurredOn;
          return (
            <div key={type}>
              <dt>
                <CareIcon type={type} size={16} /> {CARE_WORDS[type].label}
              </dt>
              <dd>
                <span className={tone}>{words}</span>
                <span className="quiet"> · {lastLine(last, plant.today)}</span>
              </dd>
            </div>
          );
        })}
        <div>
          <dt>Schedule</dt>
          <dd>{whoseSchedule(plant.row)}</dd>
        </div>
        {(plant.row.potSizeCm !== null || plant.row.soil) && (
          <div>
            <dt>Pot</dt>
            <dd>{potLine(plant.row.potSizeCm, plant.row.soil)}</dd>
          </div>
        )}
      </dl>
      <h2>Care Log</h2>
      <CareLogList events={plant.events} today={plant.today} />
    </>
  );
}

function GuideTab({ plant }: { plant: Plant }) {
  const [season, setSeason] = useState(plant.season.season);
  const { guide } = plant;
  if (!guide) return <p className="quiet">No Care Guide for this plant yet.</p>;
  return (
    <>
      <div className="c-guide-head">
        <span className="quiet">
          {guide.profile.name} · {seasonLine(plant.season, plant.today)}
        </span>
        <SeasonToggle value={season} onChange={setSeason} />
      </div>
      <GuideSections guide={guide} season={season} />
    </>
  );
}

type Item = { plant: PlantCare; type: CareType; dueOn: string; days: number };

function TodayC({ garden, photoUrl }: ShellProps) {
  const { today, byUrgency } = useInCare(garden);
  const needYou = byUrgency.filter(needsAttention).length;
  const items: Item[] = byUrgency.flatMap((plant) =>
    CARE_TYPES.flatMap((type) => {
      const status = plant.care[type];
      if (status.state !== 'due' && status.state !== 'upcoming') return [];
      return [{ plant, type, dueOn: status.dueOn, days: daysBetween(today, status.dueOn) }];
    }),
  );
  items.sort((a, b) => a.days - b.days || a.plant.displayName.localeCompare(b.plant.displayName));
  const groups: [string, Item[]][] = [
    ['Overdue', items.filter((item) => item.days < 0)],
    ['Due today', items.filter((item) => item.days === 0)],
    ['This week', items.filter((item) => item.days > 0 && item.days <= 7)],
    ['Later', items.filter((item) => item.days > 7 && item.days <= 60)],
  ];
  const date = localNoon(today).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return (
    <div className="c-today">
      <h1 tabIndex={-1}>Today</h1>
      <p className="quiet">
        {date} · {needYou > 0 ? plantsNeedYou(needYou) : 'Nothing needs you today'}
      </p>
      {groups.map(
        ([title, list]) =>
          list.length > 0 && (
            <section key={title}>
              <h2>
                {title} <span className="quiet">{list.length}</span>
              </h2>
              <ul>
                {list.map(({ plant, type, dueOn, days }) => (
                  <li key={plant.id + type}>
                    <a href={`#/plant/${plant.id}`}>
                      <Thumb
                        src={photoUrl(plant.photo)}
                        focus={plant.focus}
                        name={plant.displayName}
                      />
                      <CareIcon type={type} size={18} />
                      <span className="c-what">
                        {CARE_WORDS[type].label} <strong>{plant.displayName}</strong>
                      </span>
                      <span
                        className={
                          days < 0
                            ? 'overdue c-when'
                            : days === 0
                              ? 'due-today c-when'
                              : 'quiet c-when'
                        }
                      >
                        {days < 0
                          ? `${plural(-days, 'day')} overdue`
                          : days === 0
                            ? 'Today'
                            : days === 1
                              ? 'Tomorrow'
                              : dateLabel(dueOn, today, 'short')}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ),
      )}
    </div>
  );
}
