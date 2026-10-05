import { effectiveSchedule, forecastCare, seasonOn, type PlantCare } from '../../src/core/care';
import { listCareEvents } from '../../src/core/careLog';
import { shiftDays } from '../../src/core/dates';
import { CARE_TYPES, getPlant, SEASONAL, type CareType } from '../../src/core/plants';
import { getSettings } from '../../src/core/settings';
import { getSpecies } from '../../src/core/species';
import type { Db } from '../../src/db/types';

/**
 * What's planned (spec #72): the days of Today's Coming up, read from the Care Log and the care
 * engine as the phone's Today reads them. Nothing here is stored or written.
 */

/**
 * One thing on a day: care `done` that day (a past day), `due` on today (Overdue when daysOverdue
 * is above 0), or `coming` Due that day, as if each care is done on its day.
 */
export type PlanItem = {
  plant: PlantCare;
  type: CareType;
  kind: 'done' | 'due' | 'coming';
  daysOverdue: number;
};

export type PlanDay = { day: string; items: PlanItem[] };

/**
 * Each of `days` days from `start`: before `today` the Care Events logged that day (no Notes); on
 * `today` every care type Due or Overdue; after it each care type's next Due day, then for watering
 * and fertilizing again at the interval of the Season on the day, as if done on each Due day. An
 * Overdue care's repeats count from today. Repotting doesn't repeat in a plan this short.
 */
export function planDays(db: Db, today: string, start: string, days: number): PlanDay[] {
  const dates = Array.from({ length: days }, (_, index) => shiftDays(start, index));
  const plan = new Map(dates.map((day) => [day, [] as PlanItem[]]));
  const add = (day: string, item: PlanItem) => plan.get(day)?.push(item);
  const end = dates[dates.length - 1];
  const settings = getSettings(db);
  const forecast = forecastCare(db);
  // Each later day as the care engine sees it if nothing is logged, plant by plant.
  const ahead = dates
    .filter((day) => day > today)
    .map((day) => ({ day, care: new Map(forecast(day).map((plant) => [plant.id, plant.care])) }));

  for (const plant of forecast(today)) {
    for (const event of listCareEvents(db, plant.id)) {
      // A Note or a Soil check is no care done.
      if (event.type === 'note' || event.type === 'soilCheck') continue;
      if (event.occurredOn >= start && event.occurredOn < today) {
        add(event.occurredOn, { plant, type: event.type, kind: 'done', daysOverdue: 0 });
      }
    }
    const row = getPlant(db, plant.id);
    const species = row.speciesId ? getSpecies(db, row.speciesId) : null;
    const schedule = effectiveSchedule(row, species);
    const restsInSummer = species?.restsInSummer ?? false;

    for (const type of CARE_TYPES) {
      const status = plant.care[type];
      let done: string | undefined;
      if (status.state === 'due') {
        add(today, { plant, type, kind: 'due', daysOverdue: status.daysOverdue });
        done = today;
      } else {
        done = ahead.find(({ care }) => care.get(plant.id)?.[type].state === 'due')?.day;
        if (done) add(done, { plant, type, kind: 'coming', daysOverdue: 0 });
      }
      if (type === 'repot') continue;
      const { growing, dormant } = SEASONAL[type];
      // The care engine's Due, from `done` on: the interval for the day's Season, never before
      // that Season's first day; a Dormant season with no interval is Paused.
      while (done) {
        const last: string = done;
        done = undefined;
        for (let day = shiftDays(last, 1); day <= end; day = shiftDays(day, 1)) {
          const season = seasonOn(day, settings, restsInSummer);
          const every = schedule[season.season === 'dormant' ? dormant : growing];
          if (every === null) continue;
          const dueOn = shiftDays(last, every);
          if (day >= dueOn && (season.startsOn === null || day >= season.startsOn)) {
            done = day;
            add(day, { plant, type, kind: 'coming', daysOverdue: 0 });
            break;
          }
        }
      }
    }
  }
  return dates.map((day) => ({ day, items: plan.get(day)! }));
}
