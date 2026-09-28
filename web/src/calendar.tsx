import { CheckIcon } from '@phosphor-icons/react';

import { localNoon } from '../../src/core/dates';
import { CALENDAR_LEGEND, calendarItemWords, dayLabel, plantsNeedYou } from '../../src/ui/words';
import { CareIcon, Thumb } from './icons';
import type { PlanDay, PlanItem } from './plan';
import type { PhotoUrl } from './screens';
import { useVariant } from './prototype-web-polish/variant';

/**
 * Coming up's calendar (spec #72): two weeks of seven days as a table, past days with what was
 * done, today raised with what's Due or Overdue, later days with what comes Due; below 40rem, a
 * list of the days that hold something instead (app.css shows one or the other).
 */
export function Calendar({
  plan,
  today,
  photoUrl,
}: {
  plan: PlanDay[];
  today: string;
  photoUrl: PhotoUrl;
}) {
  const variant = useVariant();
  const weeks = [plan.slice(0, 7), plan.slice(7, 14)];
  return (
    <>
      <table className="calendar">
        <thead>
          <tr>
            {weeks[0].map(({ day }) => (
              <th key={day} scope="col">
                {localNoon(day).toLocaleDateString(undefined, { weekday: 'short' })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].day}>
              {week.map(({ day, items }) => {
                const date = localNoon(day);
                const when = day < today ? 'past' : day === today ? 'today' : 'later';
                return (
                  <td key={day} className={when}>
                    <p className="date">
                      <span className="num">{date.getDate()}</span>
                      {when === 'today' && <span className="today-label">Today</span>}
                      {when !== 'today' && date.getDate() === 1 && (
                        <span className="quiet">
                          {date.toLocaleDateString(undefined, { month: 'short' })}
                        </span>
                      )}
                    </p>
                    {/* PROTOTYPE (web polish): B points today at Needs you rather than repeat it. */}
                    {variant === 'B' && when === 'today' && items.length > 0 ? (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => document.getElementById('needs-you')?.scrollIntoView()}
                      >
                        {plantsNeedYou(new Set(items.map(({ plant }) => plant.id)).size)}
                      </button>
                    ) : (
                      <Items items={items} photoUrl={photoUrl} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ol className="calendar-list">
        {plan
          .filter(({ items }) => items.length > 0)
          .map(({ day, items }) => (
            <li key={day} className={day < today ? 'past' : undefined}>
              <h3>{dayLabel(day, today)}</h3>
              <Items items={items} photoUrl={photoUrl} />
            </li>
          ))}
      </ol>
      <p className="quiet legend">
        <span>
          <CheckIcon className="check" size={12} weight="bold" aria-hidden="true" />
          {CALENDAR_LEGEND.done}
        </span>
        <span aria-hidden="true">·</span>
        <span>
          <CareIcon type="water" size={12} />
          {CALENDAR_LEGEND.coming}
        </span>
      </p>
    </>
  );
}

/** A day's care, each a link to its plant that says its full words. */
function Items({ items, photoUrl }: { items: PlanItem[]; photoUrl: PhotoUrl }) {
  if (items.length === 0) return null;
  return (
    <ul className="items">
      {items.map(({ plant, type, kind, daysOverdue }, index) => {
        const words = calendarItemWords(kind, type, plant.displayName, daysOverdue);
        const tone = kind !== 'due' ? '' : daysOverdue > 0 ? 'overdue' : 'due-today';
        return (
          // A plant's care can be logged twice on one day.
          <li key={index} className={kind}>
            <a href={`#/plant/${plant.id}`} title={words} aria-label={words}>
              {kind === 'done' ? (
                <CheckIcon className="check" size={12} weight="bold" aria-hidden="true" />
              ) : (
                <CareIcon type={type} size={14} />
              )}
              <Thumb
                src={photoUrl(plant.photo)}
                focus={plant.focus}
                name={plant.displayName}
                size="xs"
              />
              <span className={`item-name ${tone}`}>{plant.displayName}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
