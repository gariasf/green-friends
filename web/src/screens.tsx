import { useMemo } from 'react';

import { dueCare, evaluateCare, needsAttention, nextCare } from '../../src/core/care';
import { listCareEvents, type CareEvent } from '../../src/core/careLog';
import { localDay, localNoon } from '../../src/core/dates';
import { CARE_TYPES, getPlant, listPlants } from '../../src/core/plants';
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
} from '../../src/ui/words';
import type { Garden } from './garden';

/** A photo's address in this page, by its filename; none for a plant without one. */
export type PhotoUrl = (filename: string | null) => string | undefined;

const SYNCED = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** When the Snapshot was taken, under Today's and the Garden's headings. */
function Synced({ takenAt }: { takenAt: Date | null }) {
  return takenAt && <p className="quiet">Synced {SYNCED.format(takenAt)}</p>;
}

// ponytail: the day is the one the screen was drawn on; left open past midnight, Today shows
// yesterday until the next navigation, as the phone's does until the next write.
/**
 * Today, as the phone's (spec #35): the browser's day and how many plants need you, then each plant
 * that Needs Attention, most Overdue first, with what is Due or Overdue and by how much. Read-only,
 * so a plant opens its Plant screen rather than logging care.
 */
export function Today({
  garden,
  takenAt,
  photoUrl,
}: {
  garden: Garden;
  takenAt: Date | null;
  photoUrl: PhotoUrl;
}) {
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
      <h1 tabIndex={-1}>Today</h1>
      <p className="quiet">
        {plants.length > 0 ? `${date} · ${plantsNeedYou(plants.length)}` : date}
      </p>
      <Synced takenAt={takenAt} />
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
              <PlantName
                photo={photoUrl(plant.photo)}
                name={plant.displayName}
                scientificName={plant.scientificName}
              />
              <ul className="due">
                {dueCare(plant).map(({ type, daysOverdue }) => (
                  <li key={type}>
                    <span className="care-label">{CARE_WORDS[type].label}</span>
                    {daysOverdue > 0 ? (
                      <span className="overdue">{plural(daysOverdue, 'day')} overdue</span>
                    ) : (
                      <span className="due-today">Due today</span>
                    )}
                  </li>
                ))}
              </ul>
            </a>
          </li>
        ))}
      </ul>
      {rest.length > 0 && (
        <>
          <h2>Everything else</h2>
          <ul className="rest">
            {rest.map((plant) => {
              const photo = photoUrl(plant.photo);
              return (
                <li key={plant.id}>
                  <a href={`#/plant/${plant.id}`}>
                    {photo ? <img src={photo} alt="" /> : <span className="no-photo" />}
                    <span className="name">{plant.displayName}</span>
                    <span className="quiet">{nextCareLine(nextCare(plant, today))}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

/** Every live plant by Display Name, with its photo and scientific name, as the phone's Garden. */
export function GardenList({
  garden,
  takenAt,
  photoUrl,
}: {
  garden: Garden;
  takenAt: Date | null;
  photoUrl: PhotoUrl;
}) {
  const plants = useMemo(() => listPlants(garden.db), [garden]);
  return (
    <>
      <h1 tabIndex={-1}>Garden</h1>
      <Synced takenAt={takenAt} />
      {plants.length === 0 ? (
        <Empty title="No plants yet" line="Add one in Green Friends on your phone." />
      ) : (
        <ul className="group">
          {plants.map((plant) => (
            <li key={plant.id}>
              <a href={`#/plant/${plant.id}`}>
                <PlantName
                  photo={photoUrl(plant.photo)}
                  name={plant.displayName}
                  scientificName={plant.scientificName}
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * A plant's screen, as the phone's without its buttons: the photo, its names and pet toxicity, a
 * line per care type with when it's next Due (or how long Overdue, or Paused) and when it was last
 * done, its Current Pot and whose schedule it follows, and its Care Log as a timeline. The Web view
 * lists only plants in care, so a link to any other says so.
 */
export function PlantScreen({
  garden,
  id,
  photoUrl,
}: {
  garden: Garden;
  id: string;
  photoUrl: PhotoUrl;
}) {
  const today = localDay(new Date());
  const plant = useMemo(() => {
    const care = evaluateCare(garden.db, today).find((candidate) => candidate.id === id);
    return care && { ...care, row: getPlant(garden.db, id), events: listCareEvents(garden.db, id) };
  }, [garden, id, today]);

  if (!plant) {
    return (
      <>
        <h1 tabIndex={-1}>Not in your Garden</h1>
        <p>This plant isn&apos;t in the Garden your phone last synced.</p>
      </>
    );
  }

  const { row, events } = plant;
  const scientific = scientificBeneath(plant.displayName, plant.scientificName);
  const photo = photoUrl(plant.photo);
  const pot = potLine(row.potSizeCm, row.soil);

  return (
    <>
      {photo && <img className="hero" src={photo} alt={`Photo of ${plant.displayName}`} />}
      <h1 tabIndex={-1}>{plant.displayName}</h1>
      {scientific && <p className="scientific">{scientific}</p>}
      {plant.toxicToPets !== null && (
        <p className={plant.toxicToPets ? 'badge toxic' : 'badge'}>
          {plant.toxicToPets ? 'Toxic to pets' : 'Non-toxic to pets'}
        </p>
      )}

      <h2>Care</h2>
      <dl className="group care">
        {CARE_TYPES.map((type) => {
          const status = plant.care[type];
          const [, spoken] = tileValue(status, today);
          const lastDone = events.find((event) => event.type === type)?.occurredOn;
          const tone =
            status.state === 'due' ? (status.daysOverdue > 0 ? 'overdue' : 'due-today') : '';
          return (
            <div key={type}>
              <dt>{CARE_WORDS[type].label}</dt>
              <dd>
                <span className={tone}>{sentence(spoken)}</span>
                <span className="quiet">{lastLine(lastDone, today)}</span>
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="quiet">{whoseSchedule(row)}</p>

      <h2>Current Pot</h2>
      <p>{pot || 'Not recorded.'}</p>

      <h2>Care Log</h2>
      {events.length === 0 ? (
        <p className="quiet">Nothing logged yet.</p>
      ) : (
        <ol className="timeline">
          {events.map((event) => (
            <TimelineEntry key={event.id} event={event} today={today} />
          ))}
        </ol>
      )}
    </>
  );
}

/** A Care Event on the timeline: a dot in its hue beside its day, what was done, and its details. */
function TimelineEntry({ event, today }: { event: CareEvent; today: string }) {
  const detail = [potLine(event.potSizeCm, event.soil), event.note].filter(Boolean).join(' · ');
  return (
    <li className={event.type}>
      <time className="quiet" dateTime={event.occurredOn}>
        {dayLabel(event.occurredOn, today)}
      </time>
      <strong>{CARE_WORDS[event.type].done}</strong>
      {detail && <p>{detail}</p>}
    </li>
  );
}

/** A plant's photo, decorative beside its name as on the phone, its Display Name and scientific name. */
function PlantName({
  photo,
  name,
  scientificName,
}: {
  photo: string | undefined;
  name: string;
  scientificName: string | null;
}) {
  const scientific = scientificBeneath(name, scientificName);
  return (
    <span className="plant">
      {photo ? <img src={photo} alt="" /> : <span className="no-photo" />}
      <span>
        <span className="name">{name}</span>
        {scientific && <span className="scientific">{scientific}</span>}
      </span>
    </span>
  );
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
