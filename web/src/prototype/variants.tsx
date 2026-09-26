// PROTOTYPE (prototype/web-design): throwaway, never merged.
// Question: what should the Web view look like on a laptop? Three structurally different layouts
// on the existing page, switched with `?variant=A|B|C` (dev server only), over the real Snapshot.
//   A  Sidebar + list/detail panes, like Mail or Notes
//   B  Top bar, a Today dashboard (needs you / coming up), photo grid, photo beside the details
//   C  One board: every plant a row, a column per care type, details in a side drawer
// Shared between them: the care symbols, the leaf placeholder and the app mark (icons.tsx).
import { useEffect, useMemo, type ReactNode } from 'react';

import {
  dueCare,
  evaluateCare,
  needsAttention,
  nextCare,
  type CareStatus,
  type PlantCare,
} from '../../../src/core/care';
import { listCareEvents, type CareEvent } from '../../../src/core/careLog';
import { localDay, localNoon } from '../../../src/core/dates';
import { CARE_TYPES, getPlant, type CareType } from '../../../src/core/plants';
import {
  CARE_WORDS,
  dayLabel,
  lastLine,
  nextCareLine,
  plantsNeedYou,
  plural,
  scientificBeneath,
  tileValue,
  whoseSchedule,
} from '../../../src/ui/words';
import type { Garden } from '../garden';
import type { PhotoUrl } from '../screens';
import { AppMark, CareIcon, Thumb } from './icons';
import './prototype.css';

export type Route = { tab: 'today' } | { tab: 'garden' } | { tab: 'plant'; id: string };
type Props = { garden: Garden; takenAt: Date | null; photoUrl: PhotoUrl; screen: Route };

export const VARIANTS = {
  A: { name: 'Sidebar + panes', View: VariantA },
  B: { name: 'Top bar + dashboard', View: VariantB },
  C: { name: 'One board + drawer', View: VariantC },
} as const;
export type VariantKey = keyof typeof VARIANTS;

// ---------- shared data (not layout) ----------

const today = () => localDay(new Date());

function usePlants(garden: Garden) {
  return useMemo(() => {
    const day = today();
    const plants = evaluateCare(garden.db, day);
    const urgent = (plant: PlantCare) =>
      Math.max(-1, ...dueCare(plant).map((due) => due.daysOverdue));
    return {
      day,
      plants,
      needing: plants.filter(needsAttention).sort((a, b) => urgent(b) - urgent(a)),
      rest: plants
        .filter((plant) => !needsAttention(plant))
        .sort((a, b) => (nextCare(a, day)?.days ?? 1e9) - (nextCare(b, day)?.days ?? 1e9)),
    };
  }, [garden]);
}

function usePlant(garden: Garden, id: string | null) {
  return useMemo(() => {
    if (!id) return null;
    const care = evaluateCare(garden.db, today()).find((plant) => plant.id === id);
    return care
      ? { ...care, row: getPlant(garden.db, id), events: listCareEvents(garden.db, id) }
      : null;
  }, [garden, id]);
}

type FullPlant = NonNullable<ReturnType<typeof usePlant>>;

const SYNCED = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const SYNCED_SHORT = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

function longDate(day: string) {
  return localNoon(day).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function tone(status: CareStatus) {
  if (status.state !== 'due') return status.state;
  return status.daysOverdue > 0 ? 'overdue' : 'due-today';
}

function statusWords(status: CareStatus, day: string) {
  const [, spoken] = tileValue(status, day);
  return spoken[0].toUpperCase() + spoken.slice(1);
}

function potLine(sizeCm: number | null, soil: string | null) {
  return [sizeCm !== null && `${sizeCm} cm pot`, soil].filter(Boolean).join(' · ');
}

function Toxic({ value }: { value: boolean | null }) {
  if (value === null) return null;
  return (
    <span className={value ? 'p-badge toxic' : 'p-badge'}>
      {value ? 'Toxic to pets' : 'Non-toxic to pets'}
    </span>
  );
}

function Timeline({ events, day }: { events: CareEvent[]; day: string }) {
  if (events.length === 0) return <p className="p-quiet">Nothing logged yet.</p>;
  return (
    <ol className="p-timeline">
      {events.map((event) => {
        const detail = [potLine(event.potSizeCm, event.soil), event.note]
          .filter(Boolean)
          .join(' · ');
        return (
          <li key={event.id}>
            <CareIcon type={event.type} size={16} />
            <div>
              <strong>{CARE_WORDS[event.type].done}</strong>
              {detail && <p>{detail}</p>}
            </div>
            <time className="p-quiet" dateTime={event.occurredOn}>
              {dayLabel(event.occurredOn, day)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

function useFocusTop(screen: Route) {
  useEffect(() => {
    scrollTo(0, 0);
  }, [screen]);
}

// ---------- A: sidebar + list/detail panes ----------

function VariantA({ garden, takenAt, photoUrl, screen }: Props) {
  const { day, plants, needing, rest } = usePlants(garden);
  const selected = screen.tab === 'plant' ? screen.id : null;
  const plant = usePlant(garden, selected);
  const showList = screen.tab !== 'today';

  return (
    <div className={`proto va ${selected ? 'has-detail' : ''}`}>
      <aside className="va-side">
        <div className="va-brand">
          <AppMark size={30} />
          <span>Green Friends</span>
        </div>
        <nav className="va-nav" aria-label="Screens">
          <a href="#/" aria-current={screen.tab === 'today' ? 'page' : undefined}>
            <span>Today</span>
            {needing.length > 0 && <span className="va-count">{needing.length}</span>}
          </a>
          <a href="#/garden" aria-current={screen.tab !== 'today' ? 'page' : undefined}>
            <span>Garden</span>
            <span className="va-count quiet">{plants.length}</span>
          </a>
        </nav>
        {takenAt && <p className="va-synced">Synced {SYNCED.format(takenAt)}</p>}
      </aside>

      {screen.tab === 'today' ? (
        <main className="va-today">
          <h1>Today</h1>
          <p className="p-quiet">
            {longDate(day)}
            {needing.length > 0 && ` · ${plantsNeedYou(needing.length)}`}
          </p>
          <div className="va-cards">
            {needing.map((p) => (
              <a key={p.id} className="va-card" href={`#/plant/${p.id}`}>
                <Thumb src={photoUrl(p.photo)} className="lg" />
                <div className="va-card-body">
                  <strong>{p.displayName}</strong>
                  {scientificBeneath(p.displayName, p.scientificName) && (
                    <em className="p-quiet">{p.scientificName}</em>
                  )}
                  {dueCare(p).map(({ type, daysOverdue }) => (
                    <span key={type} className="va-due">
                      <CareIcon type={type} size={16} />
                      {CARE_WORDS[type].label}
                      <span className={daysOverdue > 0 ? 'overdue' : 'due-today'}>
                        {daysOverdue > 0 ? `${plural(daysOverdue, 'day')} overdue` : 'Due today'}
                      </span>
                    </span>
                  ))}
                </div>
              </a>
            ))}
          </div>
          <h2>Everything else</h2>
          <ul className="va-rest">
            {rest.map((p) => {
              const next = nextCare(p, day);
              return (
                <li key={p.id}>
                  <a href={`#/plant/${p.id}`}>
                    <Thumb src={photoUrl(p.photo)} />
                    <span className="grow">{p.displayName}</span>
                    {next && <CareIcon type={next.type} size={14} />}
                    <span className="p-quiet">{nextCareLine(next)}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </main>
      ) : (
        <>
          {showList && (
            <section className="va-list" aria-label="Garden">
              <h1>Garden</h1>
              <ul>
                {plants.map((p) => {
                  const due = dueCare(p);
                  return (
                    <li key={p.id}>
                      <a
                        href={`#/plant/${p.id}`}
                        aria-current={p.id === selected ? 'page' : undefined}
                      >
                        <Thumb src={photoUrl(p.photo)} />
                        <span className="grow">
                          <span className="name">{p.displayName}</span>
                          <span className="p-quiet small">
                            {due.length > 0
                              ? due.map((d) => CARE_WORDS[d.type].label).join(', ') +
                                (due.some((d) => d.daysOverdue > 0) ? ' overdue' : ' due today')
                              : nextCareLine(nextCare(p, day))}
                          </span>
                        </span>
                        {due.length > 0 && (
                          <span
                            className={`va-dot ${due.some((d) => d.daysOverdue > 0) ? 'overdue' : 'due-today'}`}
                          />
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <main className="va-detail">
            {plant ? (
              <>
                <a className="va-back" href="#/garden">
                  ‹ Garden
                </a>
                <div className="va-head">
                  <Thumb src={photoUrl(plant.photo)} className="xl" />
                  <div>
                    <h1>{plant.displayName}</h1>
                    {scientificBeneath(plant.displayName, plant.scientificName) && (
                      <em className="p-quiet">{plant.scientificName}</em>
                    )}
                    <div>
                      <Toxic value={plant.toxicToPets} />
                    </div>
                  </div>
                </div>
                <DetailCareRows plant={plant} day={day} />
                <p className="p-quiet small">
                  {whoseSchedule(plant.row)} ·{' '}
                  {potLine(plant.row.potSizeCm, plant.row.soil) || 'Pot not recorded'}
                </p>
                <h2>Care Log</h2>
                <Timeline events={plant.events} day={day} />
              </>
            ) : (
              <div className="va-empty">
                <AppMark size={48} />
                <p className="p-quiet">Pick a plant to see its care and Care Log.</p>
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
}

function DetailCareRows({ plant, day }: { plant: FullPlant; day: string }) {
  return (
    <dl className="va-care">
      {CARE_TYPES.map((type) => {
        const status = plant.care[type];
        const last = plant.events.find((event) => event.type === type)?.occurredOn;
        return (
          <div key={type}>
            <dt>
              <CareIcon type={type} />
              {CARE_WORDS[type].label}
            </dt>
            <dd>
              <span className={tone(status)}>{statusWords(status, day)}</span>
              <span className="p-quiet small">{lastLine(last, day)}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

// ---------- B: top bar, Today dashboard, photo grid, photo beside details ----------

function VariantB({ garden, takenAt, photoUrl, screen }: Props) {
  useFocusTop(screen);
  const { day, plants, needing, rest } = usePlants(garden);
  const plant = usePlant(garden, screen.tab === 'plant' ? screen.id : null);

  return (
    <div className="proto vb">
      <header className="vb-bar">
        <a className="vb-brand" href="#/">
          <AppMark size={26} />
          <span>Green Friends</span>
        </a>
        <nav aria-label="Screens">
          <a href="#/" aria-current={screen.tab === 'today' ? 'page' : undefined}>
            Today
          </a>
          <a href="#/garden" aria-current={screen.tab !== 'today' ? 'page' : undefined}>
            Garden
          </a>
        </nav>
        {takenAt && (
          <span className="vb-synced" title={SYNCED.format(takenAt)}>
            <span className="vb-live" /> Synced {SYNCED_SHORT.format(takenAt)}
          </span>
        )}
      </header>

      <main className="vb-main">
        {screen.tab === 'today' && (
          <>
            <div className="vb-hello">
              <h1>{longDate(day)}</h1>
              <p className="p-quiet">
                {needing.length > 0 ? plantsNeedYou(needing.length) : 'Nothing needs you today.'}
              </p>
            </div>
            <div className="vb-cols">
              <section>
                <h2>Needs you</h2>
                {needing.map((p) => (
                  <a key={p.id} className="vb-need" href={`#/plant/${p.id}`}>
                    <Thumb src={photoUrl(p.photo)} className="xl" />
                    <div>
                      <strong>{p.displayName}</strong>
                      <ul>
                        {dueCare(p).map(({ type, daysOverdue }) => (
                          <li key={type}>
                            <CareIcon type={type} />
                            {CARE_WORDS[type].label}
                            <span className={daysOverdue > 0 ? 'overdue' : 'due-today'}>
                              {daysOverdue > 0
                                ? `${plural(daysOverdue, 'day')} overdue`
                                : 'Due today'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </a>
                ))}
              </section>
              <section>
                <h2>Coming up</h2>
                <ol className="vb-agenda">
                  {rest.map((p) => {
                    const next = nextCare(p, day);
                    return (
                      <li key={p.id}>
                        <a href={`#/plant/${p.id}`}>
                          <span className="vb-when">
                            {next
                              ? next.paused
                                ? '—'
                                : next.days === 1
                                  ? 'Tmrw'
                                  : `${next.days}d`
                              : '—'}
                          </span>
                          <Thumb src={photoUrl(p.photo)} />
                          <span className="grow">
                            <span className="name">{p.displayName}</span>
                            <span className="p-quiet small">{nextCareLine(next)}</span>
                          </span>
                          {next && <CareIcon type={next.type} />}
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>
          </>
        )}

        {screen.tab === 'garden' && (
          <>
            <h1>Garden</h1>
            <ul className="vb-grid">
              {plants.map((p) => {
                const due = dueCare(p);
                return (
                  <li key={p.id}>
                    <a href={`#/plant/${p.id}`}>
                      <Thumb src={photoUrl(p.photo)} className="fill" />
                      <strong>{p.displayName}</strong>
                      <span
                        className={`small ${due.length ? (due.some((d) => d.daysOverdue > 0) ? 'overdue' : 'due-today') : 'p-quiet'}`}
                      >
                        {due.length
                          ? due.map((d) => CARE_WORDS[d.type].label).join(', ') + ' now'
                          : nextCareLine(nextCare(p, day))}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {screen.tab === 'plant' &&
          (plant ? (
            <div className="vb-plant">
              <div className="vb-photo">
                <Thumb src={photoUrl(plant.photo)} className="fill" />
              </div>
              <div>
                <h1>{plant.displayName}</h1>
                {scientificBeneath(plant.displayName, plant.scientificName) && (
                  <em className="p-quiet">{plant.scientificName}</em>
                )}
                <div className="vb-badges">
                  <Toxic value={plant.toxicToPets} />
                  {potLine(plant.row.potSizeCm, plant.row.soil) && (
                    <span className="p-badge">{potLine(plant.row.potSizeCm, plant.row.soil)}</span>
                  )}
                </div>
                <div className="vb-tiles">
                  {CARE_TYPES.map((type) => {
                    const status = plant.care[type];
                    const [short, spoken] = tileValue(status, day);
                    const last = plant.events.find((e) => e.type === type)?.occurredOn;
                    return (
                      <div key={type} className={`vb-tile ${tone(status)}`}>
                        <span className="vb-tile-top">
                          <CareIcon type={type} />
                          {CARE_WORDS[type].label}
                        </span>
                        <strong>{short}</strong>
                        <span className="small">{spoken}</span>
                        <span className="p-quiet small">{lastLine(last, day)}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="p-quiet small">{whoseSchedule(plant.row)}</p>
                <h2>Care Log</h2>
                <Timeline events={plant.events} day={day} />
              </div>
            </div>
          ) : (
            <p>This plant isn&apos;t in the Garden your phone last synced.</p>
          ))}
      </main>
    </div>
  );
}

// ---------- C: one board, a drawer for the plant ----------

function VariantC({ garden, takenAt, photoUrl, screen }: Props) {
  const { day, needing, rest } = usePlants(garden);
  const plant = usePlant(garden, screen.tab === 'plant' ? screen.id : null);
  const rows = [...needing, ...rest];
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && location.hash.startsWith('#/plant/')) location.hash = '#/';
    };
    addEventListener('keydown', close);
    return () => removeEventListener('keydown', close);
  }, []);

  return (
    <div className="proto vc">
      <header className="vc-head">
        <div className="vc-brand">
          <AppMark size={40} />
          <div>
            <h1>{longDate(day)}</h1>
            <p className="p-quiet">
              {needing.length > 0 ? plantsNeedYou(needing.length) : 'Nothing needs you today'}
              {takenAt && ` · Synced ${SYNCED.format(takenAt)}`}
            </p>
          </div>
        </div>
      </header>

      <main>
        <table className="vc-board">
          <thead>
            <tr>
              <th scope="col">Plant</th>
              {CARE_TYPES.map((type) => (
                <th key={type} scope="col">
                  <CareIcon type={type} size={16} /> {CARE_WORDS[type].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className={needsAttention(p) ? 'needs' : ''}
                aria-selected={plant?.id === p.id}
                onClick={() => (location.hash = `#/plant/${p.id}`)}
              >
                <th scope="row">
                  <a href={`#/plant/${p.id}`} onClick={(e) => e.stopPropagation()}>
                    <Thumb src={photoUrl(p.photo)} />
                    <span>
                      <span className="name">{p.displayName}</span>
                      {scientificBeneath(p.displayName, p.scientificName) && (
                        <em className="p-quiet small">{p.scientificName}</em>
                      )}
                    </span>
                  </a>
                </th>
                {CARE_TYPES.map((type) => (
                  <td key={type} data-label={CARE_WORDS[type].label}>
                    <Chip status={p.care[type]} day={day} type={type} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </main>

      {plant && (
        <>
          <a className="vc-scrim" href="#/" aria-label="Close" />
          <aside className="vc-drawer" aria-label={plant.displayName}>
            <a className="vc-close" href="#/" aria-label="Close">
              ×
            </a>
            <Thumb src={photoUrl(plant.photo)} className="fill vc-photo" />
            <h2 className="vc-name">{plant.displayName}</h2>
            {scientificBeneath(plant.displayName, plant.scientificName) && (
              <em className="p-quiet">{plant.scientificName}</em>
            )}
            <div>
              <Toxic value={plant.toxicToPets} />
            </div>
            <DetailCareRows plant={plant} day={day} />
            <p className="p-quiet small">
              {whoseSchedule(plant.row)} ·{' '}
              {potLine(plant.row.potSizeCm, plant.row.soil) || 'Pot not recorded'}
            </p>
            <h3>Care Log</h3>
            <Timeline events={plant.events} day={day} />
          </aside>
        </>
      )}
    </div>
  );
}

function Chip({ status, day, type }: { status: CareStatus; day: string; type: CareType }) {
  const [short, spoken] = tileValue(status, day);
  const text =
    status.state === 'due' ? (status.daysOverdue > 0 ? `${short} overdue` : 'Today') : short;
  return (
    <span className={`vc-chip ${tone(status)}`} title={`${CARE_WORDS[type].label}: ${spoken}`}>
      {text}
    </span>
  );
}

// ---------- the switcher (dev only) ----------

export function PrototypeSwitcher({ current }: { current: VariantKey }): ReactNode {
  const keys = Object.keys(VARIANTS) as VariantKey[];
  const go = (step: number) => {
    const next = keys[(keys.indexOf(current) + step + keys.length) % keys.length];
    const url = new URL(location.href);
    url.searchParams.set('variant', next);
    location.replace(url);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = document.activeElement;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          (el as HTMLElement).isContentEditable)
      )
        return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
  return (
    <div className="proto-switcher">
      <button type="button" onClick={() => go(-1)} aria-label="Previous variant">
        ‹
      </button>
      <span>
        {current} ({VARIANTS[current].name})
      </span>
      <button type="button" onClick={() => go(1)} aria-label="Next variant">
        ›
      </button>
    </div>
  );
}
