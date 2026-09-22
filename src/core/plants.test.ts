import { MONSTERA, NOON_SEP_22, POTHOS, gardenDb } from '../test/garden';
import { listCareEvents } from './careLog';
import {
  archivePlant,
  createPlant,
  getPlant,
  listPlants,
  updatePlant,
  type CareSchedule,
  type PlantPatch,
} from './plants';

/** Watered every 4 days (7 in the Dormant season), fed monthly, never in winter; repotted every 18 months. */
const FERN_SCHEDULE: CareSchedule = {
  wateringGrowingDays: 4,
  wateringDormantDays: 7,
  fertilizingGrowingDays: 30,
  fertilizingDormantDays: null,
  repottingMonths: 18,
};

/** Only ever watered; never fed or repotted. */
const AIR_PLANT_SCHEDULE: CareSchedule = {
  wateringGrowingDays: 7,
  wateringDormantDays: null,
  fertilizingGrowingDays: null,
  fertilizingDormantDays: null,
  repottingMonths: null,
};

describe('creating plants', () => {
  test('a plant created from a species is listed under the species colloquial name', () => {
    const db = gardenDb();

    createPlant(db, { speciesId: MONSTERA });

    expect(listPlants(db)).toMatchObject([
      { displayName: 'Monstera', scientificName: 'Monstera deliciosa' },
    ]);
  });

  test('a nickname is the Display Name even when the plant has a species', () => {
    const db = gardenDb();

    createPlant(db, { speciesId: MONSTERA, nickname: 'Big Monty' });

    expect(listPlants(db)).toMatchObject([
      { displayName: 'Big Monty', scientificName: 'Monstera deliciosa' },
    ]);
  });

  test('a blank nickname leaves the species colloquial name as the Display Name', () => {
    const db = gardenDb();

    createPlant(db, { speciesId: MONSTERA, nickname: '   ' });

    expect(listPlants(db)).toMatchObject([{ displayName: 'Monstera' }]);
  });

  test('the Garden lists plants by Display Name, ignoring case', () => {
    const db = gardenDb();

    createPlant(db, { speciesId: POTHOS });
    createPlant(db, { speciesId: MONSTERA, nickname: 'aloe lookalike' });

    expect(listPlants(db).map((plant) => plant.displayName)).toEqual(['aloe lookalike', 'Pothos']);
  });

  test('a plant without a species needs a nickname', () => {
    const db = gardenDb();

    expect(() => createPlant(db, { speciesId: '', nickname: '  ' })).toThrow(/nickname/i);

    expect(listPlants(db)).toEqual([]);
  });

  test('a plant without a species needs its own care schedule', () => {
    const db = gardenDb();

    expect(() => createPlant(db, { nickname: 'Mystery fern' })).toThrow(/schedule/i);

    expect(listPlants(db)).toEqual([]);
  });

  test('a plant without a species runs on the schedule it is given', () => {
    const db = gardenDb();

    const plant = createPlant(db, { nickname: 'Mystery fern', schedule: FERN_SCHEDULE });

    expect(listPlants(db)).toMatchObject([{ displayName: 'Mystery fern', scientificName: null }]);
    expect(getPlant(db, plant.id)).toMatchObject({ speciesId: null, ...FERN_SCHEDULE });
  });

  test('a plant without a species may leave care types it never needs unscheduled', () => {
    const db = gardenDb();

    const plant = createPlant(db, { nickname: 'Air plant', schedule: AIR_PLANT_SCHEDULE });

    expect(getPlant(db, plant.id)).toMatchObject(AIR_PLANT_SCHEDULE);
  });

  test('a Dormant-season interval needs a Growing-season one', () => {
    const db = gardenDb();
    const schedule = { ...AIR_PLANT_SCHEDULE, fertilizingDormantDays: 60 };

    expect(() => createPlant(db, { nickname: 'Air plant', schedule })).toThrow(/Growing-season/);

    expect(listPlants(db)).toEqual([]);
  });

  test('a plant with a species inherits its schedule rather than taking one at creation', () => {
    const db = gardenDb();

    expect(() => createPlant(db, { speciesId: MONSTERA, schedule: FERN_SCHEDULE })).toThrow(
      /inherits/,
    );

    expect(listPlants(db)).toEqual([]);
  });

  test('a species the catalog does not know is refused', () => {
    const db = gardenDb();

    expect(() => createPlant(db, { speciesId: 'Q1' })).toThrow(/species/i);

    expect(listPlants(db)).toEqual([]);
  });

  test('creation stamps created_at and updated_at from the core clock, with no tombstone', () => {
    const db = gardenDb();

    const { id } = createPlant(db, { speciesId: MONSTERA }, new Date('2026-09-22T07:30:00.000Z'));

    expect(getPlant(db, id)).toMatchObject({
      createdAt: '2026-09-22T07:30:00.000Z',
      updatedAt: '2026-09-22T07:30:00.000Z',
      deletedAt: null,
    });
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  test('"when did you last…" answers seed backdated Care Events, unanswered care types none', () => {
    const db = gardenDb();

    const plant = createPlant(
      db,
      { speciesId: MONSTERA, lastDone: { water: '2026-09-20', fertilize: '2026-09-01' } },
      NOON_SEP_22,
    );

    expect(listCareEvents(db, plant.id)).toMatchObject([
      { type: 'water', occurredOn: '2026-09-20' },
      { type: 'fertilize', occurredOn: '2026-09-01' },
    ]);
    for (const event of listCareEvents(db, plant.id)) {
      expect(event).toMatchObject({
        plantId: plant.id,
        createdAt: NOON_SEP_22.toISOString(),
        updatedAt: NOON_SEP_22.toISOString(),
        deletedAt: null,
      });
    }
  });

  test('a seeded repot records the Current Pot the plant was entered with', () => {
    const db = gardenDb();

    const plant = createPlant(
      db,
      { speciesId: MONSTERA, potSizeCm: 21, soil: 'Aroid mix', lastDone: { repot: '2026-03-01' } },
      NOON_SEP_22,
    );

    expect(listCareEvents(db, plant.id)).toMatchObject([
      { type: 'repot', occurredOn: '2026-03-01', potSizeCm: 21, soil: 'Aroid mix' },
    ]);
  });

  test('a "last done" day in the future is refused and nothing is created', () => {
    const db = gardenDb();

    expect(() =>
      createPlant(db, { speciesId: MONSTERA, lastDone: { water: '2026-09-23' } }, NOON_SEP_22),
    ).toThrow(/future/i);

    expect(listPlants(db)).toEqual([]);
  });

  test('a "last done" answer must be a real calendar day', () => {
    const db = gardenDb();

    expect(() =>
      createPlant(db, { speciesId: MONSTERA, lastDone: { water: '2026-02-30' } }, NOON_SEP_22),
    ).toThrow(/calendar day/i);

    expect(listPlants(db)).toEqual([]);
  });

  test('a schedule interval must be a whole positive number', () => {
    const db = gardenDb();
    const fern = (schedule: CareSchedule) => () =>
      createPlant(db, { nickname: 'Mystery fern', schedule });

    expect(fern({ ...FERN_SCHEDULE, wateringGrowingDays: 0 })).toThrow(/interval/i);
    expect(fern({ ...FERN_SCHEDULE, fertilizingDormantDays: 2.5 })).toThrow(/interval/i);

    expect(listPlants(db)).toEqual([]);
  });

  test('the Current Pot can be recorded at creation', () => {
    const db = gardenDb();

    const { id } = createPlant(db, { speciesId: MONSTERA, potSizeCm: 21, soil: ' Aroid mix ' });

    expect(getPlant(db, id)).toMatchObject({ potSizeCm: 21, soil: 'Aroid mix' });
  });

  test('a pot size must be positive', () => {
    const db = gardenDb();

    expect(() => createPlant(db, { speciesId: MONSTERA, potSizeCm: -3 })).toThrow(/pot size/i);

    expect(listPlants(db)).toEqual([]);
  });
});

describe('editing plants', () => {
  test('nickname and Current Pot are editable; only updated_at moves', () => {
    const db = gardenDb();
    const { id } = createPlant(db, { speciesId: MONSTERA }, new Date('2026-09-22T07:30:00.000Z'));

    updatePlant(
      db,
      id,
      { nickname: ' Big Monty ', potSizeCm: 21, soil: 'Aroid mix' },
      new Date('2026-09-23T08:00:00.000Z'),
    );

    expect(getPlant(db, id)).toMatchObject({
      nickname: 'Big Monty',
      potSizeCm: 21,
      soil: 'Aroid mix',
      createdAt: '2026-09-22T07:30:00.000Z',
      updatedAt: '2026-09-23T08:00:00.000Z',
    });
    expect(listPlants(db)).toMatchObject([{ displayName: 'Big Monty' }]);
  });

  test('a plant with a species may take, change and clear an Override per care type', () => {
    const db = gardenDb();
    const { id } = createPlant(db, { speciesId: MONSTERA });

    updatePlant(db, id, { wateringGrowingDays: 3, wateringDormantDays: null, repottingMonths: 12 });
    expect(getPlant(db, id)).toMatchObject({
      wateringGrowingDays: 3,
      wateringDormantDays: null,
      fertilizingGrowingDays: null,
      repottingMonths: 12,
    });

    updatePlant(db, id, { wateringGrowingDays: null, repottingMonths: null });
    expect(getPlant(db, id)).toMatchObject({ wateringGrowingDays: null, repottingMonths: null });
  });

  test('an Override keeps the schedule rules: whole positive intervals, Dormant only under Growing', () => {
    const db = gardenDb();
    const { id } = createPlant(db, { speciesId: MONSTERA });

    expect(() => updatePlant(db, id, { wateringDormantDays: 14 })).toThrow(/Growing-season/);
    expect(() => updatePlant(db, id, { wateringGrowingDays: 0 })).toThrow(/interval/i);
    expect(() => updatePlant(db, id, { potSizeCm: -1 })).toThrow(/pot size/i);

    expect(getPlant(db, id)).toMatchObject({
      wateringGrowingDays: null,
      wateringDormantDays: null,
    });
  });

  test('a plant without a species keeps a nickname and at least one care type', () => {
    const db = gardenDb();
    const { id } = createPlant(db, { nickname: 'Air plant', schedule: AIR_PLANT_SCHEDULE });

    expect(() => updatePlant(db, id, { nickname: '' })).toThrow(/nickname/i);
    expect(() => updatePlant(db, id, { wateringGrowingDays: null })).toThrow(/schedule/i);

    expect(getPlant(db, id)).toMatchObject({ nickname: 'Air plant', wateringGrowingDays: 7 });
  });

  test('an undefined patch entry leaves the field as it is', () => {
    const db = gardenDb();
    const { id } = createPlant(db, { speciesId: MONSTERA, nickname: 'Big Monty', potSizeCm: 21 });

    updatePlant(db, id, { nickname: undefined, potSizeCm: undefined, soil: 'Bark' });

    expect(getPlant(db, id)).toMatchObject({ nickname: 'Big Monty', potSizeCm: 21, soil: 'Bark' });
  });

  test('clearing an Override clears its Dormant interval too', () => {
    const db = gardenDb();
    const { id } = createPlant(db, { speciesId: MONSTERA });
    updatePlant(db, id, { wateringGrowingDays: 3, wateringDormantDays: 10 });

    updatePlant(db, id, { wateringGrowingDays: null });

    expect(getPlant(db, id)).toMatchObject({
      wateringGrowingDays: null,
      wateringDormantDays: null,
    });
  });

  test('a patch cannot touch timestamps or tombstones, whatever else it carries', () => {
    const db = gardenDb();
    const { id } = createPlant(db, { speciesId: MONSTERA }, new Date('2026-09-22T07:30:00.000Z'));
    const formState = {
      nickname: 'Big Monty',
      createdAt: '1999-01-01T00:00:00.000Z',
      deletedAt: '2000-01-01T00:00:00.000Z',
    };

    updatePlant(db, id, formState as PlantPatch, new Date('2026-09-23T08:00:00.000Z'));

    expect(getPlant(db, id)).toMatchObject({
      nickname: 'Big Monty',
      createdAt: '2026-09-22T07:30:00.000Z',
      updatedAt: '2026-09-23T08:00:00.000Z',
      deletedAt: null,
    });
  });

  test('editing an unknown plant is refused', () => {
    const db = gardenDb();

    expect(() => updatePlant(db, 'nope', { nickname: 'Ghost' })).toThrow(/plant/i);
  });
});

describe('archiving plants', () => {
  test('an Archived plant is stamped, still found by id and keeps its Care Log', () => {
    const db = gardenDb();
    const { id } = createPlant(
      db,
      { speciesId: MONSTERA, lastDone: { water: '2026-09-20' } },
      NOON_SEP_22,
    );

    archivePlant(db, id, new Date('2026-09-23T08:00:00.000Z'));

    expect(getPlant(db, id)).toMatchObject({
      archivedAt: '2026-09-23T08:00:00.000Z',
      updatedAt: '2026-09-23T08:00:00.000Z',
      deletedAt: null,
    });
    expect(listCareEvents(db, id)).toMatchObject([{ type: 'water', occurredOn: '2026-09-20' }]);
  });

  test('an Archived plant leaves the Garden list', () => {
    const db = gardenDb();
    const { id } = createPlant(db, { speciesId: MONSTERA, nickname: 'Window' });
    createPlant(db, { speciesId: POTHOS });

    archivePlant(db, id);

    expect(listPlants(db)).toMatchObject([{ displayName: 'Pothos' }]);
  });
});
