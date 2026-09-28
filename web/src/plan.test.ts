import initSqlJs from 'sql.js';
import { expect, test } from 'vitest';

import { logCareEvent } from '../../src/core/careLog';
import { buildExport } from '../../src/core/export';
import { NO_SCHEDULE, createPlant, type CareSchedule } from '../../src/core/plants';
import { updateSettings, type SettingsPatch } from '../../src/core/settings';
import { openTestDb } from '../../src/test/db';
import { noon } from '../../src/test/garden';
import { photoStore } from '../../src/test/photos';
import type { Db } from '../../src/db/types';
import { openGarden } from './garden';
import { planDays } from './plan';

/**
 * A Snapshot's Garden with one plant, Fern, on its own schedule, watered on `watered`; created on
 * Sep 1 of the first watering's year. Opened through sql.js as the Web view opens one.
 */
async function fern(
  schedule: Partial<CareSchedule>,
  watered: string[],
  settings: SettingsPatch = {},
  logged: (db: Db, plantId: string) => void = () => {},
) {
  const db = openTestDb();
  const year = Number(watered[0].slice(0, 4));
  const later = noon(year + 1, 12, 31);
  const plant = createPlant(
    db,
    { nickname: 'Fern', schedule: { ...NO_SCHEDULE, ...schedule } },
    noon(year - 1, 9, 1),
  );
  for (const day of watered) {
    logCareEvent(db, { plantId: plant.id, type: 'water', occurredOn: day }, later);
  }
  logged(db, plant.id);
  updateSettings(db, settings, later);
  const zip = buildExport(db, photoStore().files, '1.2.3', later);
  return openGarden(await initSqlJs(), zip).db;
}

/** Each day that holds something, as "done water Fern", "due water Fern 2", "coming water Fern". */
function planned(db: Db, today: string, start: string, days = 14) {
  return Object.fromEntries(
    planDays(db, today, start, days)
      .filter(({ items }) => items.length > 0)
      .map(({ day, items }) => [
        day,
        items.map(({ kind, type, plant, daysOverdue }) =>
          [kind, type, plant.displayName, kind === 'due' ? daysOverdue : '']
            .filter((part) => part !== '')
            .join(' '),
        ),
      ]),
  );
}

test("past days hold that day's Care Events but no Notes, and watering every 4 days comes at 4-day steps", async () => {
  const db = await fern({ wateringGrowingDays: 4 }, ['2026-09-28'], {}, (db, plantId) =>
    logCareEvent(
      db,
      { plantId, type: 'note', occurredOn: '2026-09-29', note: 'New leaf' },
      noon(2026, 12, 31),
    ),
  );

  expect(planned(db, '2026-09-30', '2026-09-28')).toEqual({
    '2026-09-28': ['done water Fern'],
    '2026-10-02': ['coming water Fern'],
    '2026-10-06': ['coming water Fern'],
    '2026-10-10': ['coming water Fern'],
  });
});

test('Overdue care sits on today with its days, and its repeats count from today', async () => {
  const db = await fern({ wateringGrowingDays: 4 }, ['2026-09-24']);

  expect(planned(db, '2026-09-30', '2026-09-28')).toEqual({
    '2026-09-30': ['due water Fern 2'],
    '2026-10-04': ['coming water Fern'],
    '2026-10-08': ['coming water Fern'],
  });
});

test('a Dormant season with no interval stops the repeats', async () => {
  // Growing from March through September, so October is Dormant and watering is Paused.
  const db = await fern({ wateringGrowingDays: 4, wateringDormantDays: null }, ['2026-09-24'], {
    growingEndMonth: 9,
  });

  expect(planned(db, '2026-09-28', '2026-09-28')).toEqual({
    '2026-09-28': ['due water Fern 0'],
  });
});

test("a repeat never lands before its Season's first day", async () => {
  // Dormant every 14 days until March, then every 7: done Feb 20, next Due Mar 1, not Feb 27.
  const db = await fern({ wateringGrowingDays: 7, wateringDormantDays: 14 }, ['2027-02-06']);

  expect(planned(db, '2027-02-20', '2027-02-20')).toEqual({
    '2027-02-20': ['due water Fern 0'],
    '2027-03-01': ['coming water Fern'],
  });
});

test('the first coming Due day follows the Season too', async () => {
  // Watered Feb 20: Dormant, it would come Due Mar 6; from Mar 1 it's Growing and Due at once.
  const db = await fern({ wateringGrowingDays: 7, wateringDormantDays: 14 }, ['2027-02-20']);

  expect(planned(db, '2027-02-22', '2027-02-22')).toEqual({
    '2027-03-01': ['coming water Fern'],
  });
});
