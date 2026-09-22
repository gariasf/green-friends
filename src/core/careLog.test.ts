import bundled from '../../assets/species.json';
import { openTestDb } from '../test/db';
import { listCareEvents, logCareEvent } from './careLog';
import { createPlant, getPlant } from './plants';
import { seedSpecies } from './species';

const MONSTERA = 'Q161077';

/** Local noon, so the calendar day is the same in every timezone the tests run in. */
const NOON_SEP_22 = new Date(2026, 8, 22, 12);

function gardenDb() {
  const db = openTestDb();
  seedSpecies(db, bundled);
  return db;
}

describe('logging care', () => {
  test('a Care Event lands in the Care Log dated today, stamped by the core clock', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);

    logCareEvent(db, { plantId: plant.id, type: 'water' }, NOON_SEP_22);

    expect(listCareEvents(db, plant.id)).toEqual([
      {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        plantId: plant.id,
        type: 'water',
        occurredOn: '2026-09-22',
        note: null,
        potSizeCm: null,
        soil: null,
        createdAt: NOON_SEP_22.toISOString(),
        updatedAt: NOON_SEP_22.toISOString(),
        deletedAt: null,
      },
    ]);
  });

  test('a backdated event keeps the day it happened; the Care Log reads newest day first', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);

    logCareEvent(db, { plantId: plant.id, type: 'water', occurredOn: '2026-09-19' }, NOON_SEP_22);
    logCareEvent(
      db,
      { plantId: plant.id, type: 'fertilize', occurredOn: '2026-09-21' },
      NOON_SEP_22,
    );

    expect(listCareEvents(db, plant.id)).toMatchObject([
      { type: 'fertilize', occurredOn: '2026-09-21' },
      { type: 'water', occurredOn: '2026-09-19' },
    ]);
  });

  test('care cannot happen in the future, on a made-up day, or to an unknown plant', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);
    const log = (input: Parameters<typeof logCareEvent>[1]) => () =>
      logCareEvent(db, input, NOON_SEP_22);

    expect(log({ plantId: plant.id, type: 'water', occurredOn: '2026-09-23' })).toThrow(/future/i);
    expect(log({ plantId: plant.id, type: 'water', occurredOn: '2026-02-30' })).toThrow(
      /calendar day/i,
    );
    expect(log({ plantId: 'nope', type: 'water' })).toThrow(/plant/i);

    expect(listCareEvents(db, plant.id)).toEqual([]);
  });

  test('a Note needs text; only a repot carries a pot', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);

    expect(() => logCareEvent(db, { plantId: plant.id, type: 'note', note: '  ' })).toThrow(
      /text/i,
    );
    expect(() => logCareEvent(db, { plantId: plant.id, type: 'water', potSizeCm: 21 })).toThrow(
      /repot/i,
    );
    expect(() => logCareEvent(db, { plantId: plant.id, type: 'repot', potSizeCm: 0 })).toThrow(
      /pot size/i,
    );

    expect(listCareEvents(db, plant.id)).toEqual([]);
  });

  test('a Note is stored trimmed', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);

    logCareEvent(db, { plantId: plant.id, type: 'note', note: ' Thrips on two leaves ' });

    expect(listCareEvents(db, plant.id)).toMatchObject([
      { type: 'note', note: 'Thrips on two leaves' },
    ]);
  });

  test('a repot records the new pot and, being the newest repot, sets the Current Pot', () => {
    const db = gardenDb();
    const plant = createPlant(
      db,
      { speciesId: MONSTERA, potSizeCm: 17, soil: 'Peat' },
      NOON_SEP_22,
    );

    logCareEvent(
      db,
      { plantId: plant.id, type: 'repot', potSizeCm: 21, soil: 'Aroid mix' },
      NOON_SEP_22,
    );

    expect(listCareEvents(db, plant.id)).toMatchObject([
      { type: 'repot', potSizeCm: 21, soil: 'Aroid mix' },
    ]);
    expect(getPlant(db, plant.id)).toMatchObject({
      potSizeCm: 21,
      soil: 'Aroid mix',
      updatedAt: NOON_SEP_22.toISOString(),
    });
  });

  test('a repot logged for a day before the newest repot leaves the Current Pot alone', () => {
    const db = gardenDb();
    const plant = createPlant(
      db,
      { speciesId: MONSTERA, potSizeCm: 21, soil: 'Aroid mix', lastDone: { repot: '2026-03-01' } },
      NOON_SEP_22,
    );

    logCareEvent(
      db,
      { plantId: plant.id, type: 'repot', occurredOn: '2025-03-01', potSizeCm: 14, soil: 'Peat' },
      NOON_SEP_22,
    );

    expect(getPlant(db, plant.id)).toMatchObject({ potSizeCm: 21, soil: 'Aroid mix' });
  });

  test('a repot with only part of the pot given updates just that part', () => {
    const db = gardenDb();
    const plant = createPlant(
      db,
      { speciesId: MONSTERA, potSizeCm: 17, soil: 'Peat' },
      NOON_SEP_22,
    );

    logCareEvent(db, { plantId: plant.id, type: 'repot', potSizeCm: 21 }, NOON_SEP_22);
    expect(getPlant(db, plant.id)).toMatchObject({ potSizeCm: 21, soil: 'Peat' });

    logCareEvent(db, { plantId: plant.id, type: 'repot' }, NOON_SEP_22);
    expect(getPlant(db, plant.id)).toMatchObject({ potSizeCm: 21, soil: 'Peat' });
  });
});
