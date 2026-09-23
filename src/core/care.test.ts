import type { Db } from '../db/types';
import { MONSTERA, catalog, gardenDb, noon } from '../test/garden';
import { dueCare, evaluateCare, listNeedsAttention } from './care';
import { logCareEvent } from './careLog';
import { archivePlant, createPlant, updatePlant, type CareSchedule } from './plants';
import { updateSettings } from './settings';
import { seedSpecies } from './species';

/** The care statuses of the one plant in the garden on `today`. */
function careOn(db: Db, today: string) {
  const [plant, ...rest] = evaluateCare(db, today);
  expect(rest).toEqual([]);
  return plant.care;
}

describe('due-ness from the Care Log', () => {
  test('a care type never logged anchors to the plant creation and comes Due one interval later', () => {
    const db = gardenDb();
    createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));

    expect(careOn(db, '2026-09-28').water).toEqual({ state: 'upcoming', dueOn: '2026-09-29' });
    expect(careOn(db, '2026-09-29').water).toEqual({
      state: 'due',
      dueOn: '2026-09-29',
      daysOverdue: 0,
    });
    expect(careOn(db, '2026-10-02').water).toEqual({
      state: 'due',
      dueOn: '2026-09-29',
      daysOverdue: 3,
    });
  });

  test('a plant Needs Attention from the day a care type is Due until it is logged', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));

    expect(listNeedsAttention(db, '2026-09-28')).toEqual([]);
    expect(listNeedsAttention(db, '2026-09-29')).toMatchObject([{ displayName: 'Monstera' }]);
    expect(listNeedsAttention(db, '2026-10-12')).toMatchObject([{ displayName: 'Monstera' }]);

    logCareEvent(db, { plantId: plant.id, type: 'water' }, noon(2026, 10, 12));

    expect(listNeedsAttention(db, '2026-10-12')).toEqual([]);
    expect(careOn(db, '2026-10-19').water).toMatchObject({ state: 'due', daysOverdue: 0 });
  });

  test('the creation anchor is the local day the plant was created, not the UTC day', () => {
    const db = gardenDb();
    // 23:30 UTC on the 21st is already the 22nd where the tests run (Pacific/Auckland).
    createPlant(db, { speciesId: MONSTERA }, new Date('2026-09-21T23:30:00.000Z'));

    expect(careOn(db, '2026-09-28').water).toEqual({ state: 'upcoming', dueOn: '2026-09-29' });
  });

  test('the newest Care Event by day counts, whenever it was logged', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));
    logCareEvent(
      db,
      { plantId: plant.id, type: 'water', occurredOn: '2026-09-25' },
      noon(2026, 9, 26),
    );
    logCareEvent(
      db,
      { plantId: plant.id, type: 'water', occurredOn: '2026-09-23' },
      noon(2026, 9, 27),
    );

    expect(careOn(db, '2026-10-01').water).toEqual({ state: 'upcoming', dueOn: '2026-10-02' });
  });

  test('only a matching Care Event counts: feeding or a Note never waters a plant', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));
    logCareEvent(db, { plantId: plant.id, type: 'fertilize' }, noon(2026, 9, 27));
    logCareEvent(db, { plantId: plant.id, type: 'note', note: 'Thrips?' }, noon(2026, 9, 27));

    expect(careOn(db, '2026-09-29').water).toMatchObject({ state: 'due', dueOn: '2026-09-29' });
    expect(careOn(db, '2026-09-29').fertilize).toEqual({ state: 'upcoming', dueOn: '2026-10-27' });
  });

  test('a care type with no schedule is never Due', () => {
    const db = gardenDb();
    const schedule: CareSchedule = {
      wateringGrowingDays: 7,
      wateringDormantDays: null,
      fertilizingGrowingDays: null,
      fertilizingDormantDays: null,
      repottingMonths: null,
    };
    createPlant(db, { nickname: 'Air plant', schedule }, noon(2026, 9, 22));

    expect(careOn(db, '2030-06-01')).toMatchObject({
      water: { state: 'due' },
      fertilize: { state: 'unscheduled' },
      repot: { state: 'unscheduled' },
    });
  });
});

describe('seasons', () => {
  test('the Dormant interval applies from the first day of the Dormant season', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));
    logCareEvent(
      db,
      { plantId: plant.id, type: 'water', occurredOn: '2026-10-25' },
      noon(2026, 10, 25),
    );

    // Growing season (March-October by default): 7 days.
    expect(careOn(db, '2026-10-31').water).toEqual({ state: 'upcoming', dueOn: '2026-11-01' });
    // Dormant season from November: 14 days.
    expect(careOn(db, '2026-11-01').water).toEqual({ state: 'upcoming', dueOn: '2026-11-08' });
    expect(careOn(db, '2026-11-08').water).toMatchObject({ state: 'due', daysOverdue: 0 });
  });

  test('care Overdue when the season turns is Due again on the first day of the new season, not earlier', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));
    logCareEvent(
      db,
      { plantId: plant.id, type: 'water', occurredOn: '2026-10-15' },
      noon(2026, 10, 15),
    );

    expect(careOn(db, '2026-10-31').water).toEqual({
      state: 'due',
      dueOn: '2026-10-22',
      daysOverdue: 9,
    });
    expect(careOn(db, '2026-11-01').water).toEqual({
      state: 'due',
      dueOn: '2026-11-01',
      daysOverdue: 0,
    });
  });

  test('a care type with no Dormant interval is Paused for the Dormant season and resumes on the first Growing day', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));
    logCareEvent(
      db,
      { plantId: plant.id, type: 'fertilize', occurredOn: '2026-10-15' },
      noon(2026, 10, 15),
    );

    expect(careOn(db, '2026-11-14').fertilize).toEqual({ state: 'paused', until: '2027-03-01' });
    expect(careOn(db, '2027-02-28').fertilize).toEqual({ state: 'paused', until: '2027-03-01' });
    // Not 105 days overdue: never earlier than the first day of the Season.
    expect(careOn(db, '2027-03-01').fertilize).toEqual({
      state: 'due',
      dueOn: '2027-03-01',
      daysOverdue: 0,
    });
    expect(careOn(db, '2027-03-05').fertilize).toMatchObject({ state: 'due', daysOverdue: 4 });
  });

  test('a Paused plant does not Need Attention for that care type', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));
    logCareEvent(
      db,
      { plantId: plant.id, type: 'water', occurredOn: '2026-11-10' },
      noon(2026, 11, 10),
    );

    expect(listNeedsAttention(db, '2026-11-14')).toEqual([]);
  });

  test('changing the growing months re-derives due-ness at once from the same Care Log', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));
    logCareEvent(
      db,
      { plantId: plant.id, type: 'water', occurredOn: '2026-10-25' },
      noon(2026, 10, 25),
    );
    expect(careOn(db, '2026-11-08').water).toMatchObject({ dueOn: '2026-11-08', daysOverdue: 0 });

    updateSettings(db, { growingEndMonth: 11 });

    expect(careOn(db, '2026-11-08').water).toMatchObject({ dueOn: '2026-11-01', daysOverdue: 7 });
  });

  test('equal start and end months mean Growing all year: nothing is ever Paused', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));
    logCareEvent(
      db,
      { plantId: plant.id, type: 'fertilize', occurredOn: '2026-10-15' },
      noon(2026, 10, 15),
    );
    updateSettings(db, { growingStartMonth: 1, growingEndMonth: 1 });

    expect(careOn(db, '2026-11-13').fertilize).toEqual({ state: 'upcoming', dueOn: '2026-11-14' });
    expect(careOn(db, '2027-01-14').fertilize).toMatchObject({ state: 'due', daysOverdue: 61 });
  });

  test('a growing season wrapping past December (southern hemisphere) pauses over the local winter', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 3, 1));
    logCareEvent(
      db,
      { plantId: plant.id, type: 'fertilize', occurredOn: '2026-03-20' },
      noon(2026, 3, 20),
    );
    updateSettings(db, { growingStartMonth: 10, growingEndMonth: 3 });

    expect(careOn(db, '2026-03-31').fertilize).toEqual({ state: 'upcoming', dueOn: '2026-04-19' });
    expect(careOn(db, '2026-06-15').fertilize).toEqual({ state: 'paused', until: '2026-10-01' });
    expect(careOn(db, '2026-10-01').fertilize).toMatchObject({
      dueOn: '2026-10-01',
      daysOverdue: 0,
    });
    expect(careOn(db, '2027-01-15').fertilize).toMatchObject({ state: 'due', dueOn: '2026-10-01' });
  });
});

describe('repotting', () => {
  test('repotting is due a number of months after the newest repot Care Event, whatever the season', () => {
    const db = gardenDb();
    const schedule: CareSchedule = {
      wateringGrowingDays: 4,
      wateringDormantDays: 7,
      fertilizingGrowingDays: null,
      fertilizingDormantDays: null,
      repottingMonths: 18,
    };
    createPlant(
      db,
      { nickname: 'Mystery fern', schedule, lastDone: { repot: '2025-08-31' } },
      noon(2026, 9, 22),
    );

    expect(careOn(db, '2027-02-27').repot).toEqual({ state: 'upcoming', dueOn: '2027-02-28' });
    expect(careOn(db, '2027-02-28').repot).toMatchObject({ state: 'due', daysOverdue: 0 });
    expect(careOn(db, '2027-03-10').repot).toMatchObject({ dueOn: '2027-02-28', daysOverdue: 10 });
  });

  test('a plant never repotted is due one from its creation', () => {
    const db = gardenDb();
    createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));

    expect(careOn(db, '2028-09-21').repot).toEqual({ state: 'upcoming', dueOn: '2028-09-22' });
    expect(careOn(db, '2028-09-22').repot).toMatchObject({ state: 'due', daysOverdue: 0 });
  });
});

describe('effective schedule', () => {
  test('an Override shadows the Species default for that whole care type, and clearing it falls back', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));

    // Watering every 3 days, Paused over winter; the species says 7 and 14.
    updatePlant(db, plant.id, { wateringGrowingDays: 3, wateringDormantDays: null });

    expect(careOn(db, '2026-09-25').water).toMatchObject({ state: 'due', dueOn: '2026-09-25' });
    expect(careOn(db, '2026-11-15').water).toEqual({ state: 'paused', until: '2027-03-01' });
    // Fertilizing still follows the species.
    expect(careOn(db, '2026-09-25').fertilize).toEqual({ state: 'upcoming', dueOn: '2026-10-22' });

    updatePlant(db, plant.id, { wateringGrowingDays: null });

    expect(careOn(db, '2026-09-25').water).toEqual({ state: 'upcoming', dueOn: '2026-09-29' });
    // Back on the species' Dormant interval: no longer Paused (and clamped to the season start).
    expect(careOn(db, '2026-11-15').water).toMatchObject({ state: 'due', dueOn: '2026-11-01' });
  });

  test('a catalog update flows through to plants without an Override for that care type', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 22));
    updatePlant(db, plant.id, { fertilizingGrowingDays: 14 });
    const thirstier = { ...catalog.monstera, wateringGrowingDays: 5 };

    seedSpecies(db, { version: 2, species: [thirstier] });

    expect(careOn(db, '2026-09-27').water).toMatchObject({ state: 'due', dueOn: '2026-09-27' });
    expect(careOn(db, '2026-10-06').fertilize).toMatchObject({ state: 'due', dueOn: '2026-10-06' });
  });
});

describe('Needs Attention', () => {
  test('lists the most Overdue plant first and leaves out plants with nothing Due', () => {
    const db = gardenDb();
    createPlant(db, { speciesId: MONSTERA, nickname: 'Window' }, noon(2026, 9, 1));
    createPlant(db, { speciesId: MONSTERA, nickname: 'Shelf' }, noon(2026, 9, 15));
    createPlant(db, { speciesId: MONSTERA, nickname: 'Desk' }, noon(2026, 9, 20));

    expect(listNeedsAttention(db, '2026-09-22')).toMatchObject([
      { displayName: 'Window', care: { water: { daysOverdue: 14 } } },
      { displayName: 'Shelf', care: { water: { daysOverdue: 0 } } },
    ]);
    expect(evaluateCare(db, '2026-09-22').map((plant) => plant.displayName)).toEqual([
      'Window',
      'Shelf',
      'Desk',
    ]);
  });

  test("a plant's Due care types come in care-type order, each with its days Overdue", () => {
    const db = gardenDb();
    // Watered every 7 days from creation (Due Sep 8), fed every 30 days from Aug 20 (Due Sep 19).
    createPlant(
      db,
      { speciesId: MONSTERA, lastDone: { fertilize: '2026-08-20' } },
      noon(2026, 9, 1),
    );

    const [plant] = evaluateCare(db, '2026-09-22');

    expect(dueCare(plant)).toEqual([
      { type: 'water', dueOn: '2026-09-08', daysOverdue: 14 },
      { type: 'fertilize', dueOn: '2026-09-19', daysOverdue: 3 },
    ]);
  });

  test('an Archived plant is left out of the evaluation altogether', () => {
    const db = gardenDb();
    const window = createPlant(db, { speciesId: MONSTERA, nickname: 'Window' }, noon(2026, 9, 1));
    createPlant(db, { speciesId: MONSTERA, nickname: 'Shelf' }, noon(2026, 9, 15));

    archivePlant(db, window.id);

    expect(listNeedsAttention(db, '2026-09-22')).toMatchObject([{ displayName: 'Shelf' }]);
    expect(evaluateCare(db, '2026-09-22')).toMatchObject([{ displayName: 'Shelf' }]);
  });
});
