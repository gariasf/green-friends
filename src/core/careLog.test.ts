import { MONSTERA, NOON_SEP_22, gardenDb, noon } from '../test/garden';
import { listNeedsAttention } from './care';
import {
  deleteCareEvent,
  editCareEvent,
  getCareEvent,
  listCareEvents,
  logCareEvent,
  type CareEventPatch,
} from './careLog';
import { createPlant, getPlant } from './plants';

describe('logging care', () => {
  test('an event logged with no day is dated the local day, not the UTC one', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 20));

    // 23:30 UTC on the 21st is already the 22nd where the tests run (Pacific/Auckland).
    logCareEvent(db, { plantId: plant.id, type: 'water' }, new Date('2026-09-21T23:30:00.000Z'));

    expect(listCareEvents(db, plant.id)).toMatchObject([{ occurredOn: '2026-09-22' }]);
  });

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

describe('editing care', () => {
  test('moving a Care Event to another day re-derives due-ness at once', () => {
    const db = gardenDb();
    // Watered every 7 days: the watering logged on the 22nd is next Due on the 29th.
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 1));
    const watered = logCareEvent(db, { plantId: plant.id, type: 'water' }, NOON_SEP_22);
    expect(listNeedsAttention(db, '2026-09-27')).toEqual([]);

    editCareEvent(db, watered.id, { occurredOn: '2026-09-19' }, NOON_SEP_22);

    expect(listNeedsAttention(db, '2026-09-27')).toMatchObject([
      { id: plant.id, care: { water: { state: 'due', dueOn: '2026-09-26', daysOverdue: 1 } } },
    ]);
  });

  test("a Note's text and a repot's pot are editable, stored trimmed; only updated_at moves", () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 21));
    const note = logCareEvent(
      db,
      { plantId: plant.id, type: 'note', note: 'Thrips?' },
      noon(2026, 9, 21),
    );
    const repot = logCareEvent(
      db,
      { plantId: plant.id, type: 'repot', potSizeCm: 21, soil: 'Peat' },
      NOON_SEP_22,
    );
    const later = noon(2026, 9, 23);

    editCareEvent(db, note.id, { note: ' Thrips on two leaves ' }, later);
    editCareEvent(db, repot.id, { potSizeCm: 24, soil: ' Aroid mix ' }, later);

    expect(listCareEvents(db, plant.id)).toEqual([
      { ...repot, potSizeCm: 24, soil: 'Aroid mix', updatedAt: later.toISOString() },
      { ...note, note: 'Thrips on two leaves', updatedAt: later.toISOString() },
    ]);
  });

  test('an edit keeps the rules the Care Event was logged under; a refused edit changes nothing', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 20));
    const watered = logCareEvent(db, { plantId: plant.id, type: 'water' }, noon(2026, 9, 20));
    const note = logCareEvent(
      db,
      { plantId: plant.id, type: 'note', note: 'Thrips?' },
      noon(2026, 9, 21),
    );
    const repot = logCareEvent(db, { plantId: plant.id, type: 'repot' }, NOON_SEP_22);
    const edit = (id: string, patch: CareEventPatch) => () =>
      editCareEvent(db, id, patch, NOON_SEP_22);

    expect(edit(watered.id, { occurredOn: '2026-09-23' })).toThrow(/future/i);
    expect(edit(watered.id, { occurredOn: '2026-02-30' })).toThrow(/calendar day/i);
    expect(edit(note.id, { note: '  ' })).toThrow(/text/i);
    expect(edit(watered.id, { soil: 'Peat' })).toThrow(/repot/i);
    expect(edit(repot.id, { potSizeCm: 0 })).toThrow(/pot size/i);

    expect(listCareEvents(db, plant.id)).toEqual([repot, note, watered]);
  });

  test('editing a repot, even the newest, leaves the Current Pot as it is', () => {
    const db = gardenDb();
    const plant = createPlant(
      db,
      { speciesId: MONSTERA, potSizeCm: 17, soil: 'Peat' },
      NOON_SEP_22,
    );
    const repot = logCareEvent(
      db,
      { plantId: plant.id, type: 'repot', potSizeCm: 21, soil: 'Aroid mix' },
      NOON_SEP_22,
    );

    editCareEvent(db, repot.id, { potSizeCm: 24, soil: 'Bark' }, NOON_SEP_22);

    expect(getPlant(db, plant.id)).toMatchObject({ potSizeCm: 21, soil: 'Aroid mix' });
  });

  test('an edit cannot change the type, plant, timestamps or tombstone, whatever else it carries', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);
    const watered = logCareEvent(db, { plantId: plant.id, type: 'water' }, NOON_SEP_22);
    const formState = {
      occurredOn: '2026-09-21',
      type: 'fertilize',
      plantId: 'another plant',
      createdAt: '1999-01-01T00:00:00.000Z',
      deletedAt: '2000-01-01T00:00:00.000Z',
    };
    const later = noon(2026, 9, 23);

    editCareEvent(db, watered.id, formState as CareEventPatch, later);

    expect(listCareEvents(db, plant.id)).toEqual([
      { ...watered, occurredOn: '2026-09-21', updatedAt: later.toISOString() },
    ]);
  });

  test('only a live Care Event can be read by id or edited', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);
    const watered = logCareEvent(db, { plantId: plant.id, type: 'water' }, NOON_SEP_22);
    expect(getCareEvent(db, watered.id)).toEqual(watered);

    deleteCareEvent(db, watered.id, NOON_SEP_22);

    expect(() => getCareEvent(db, watered.id)).toThrow(/care event/i);
    expect(() => editCareEvent(db, watered.id, { occurredOn: '2026-09-21' })).toThrow(
      /care event/i,
    );
    expect(() => editCareEvent(db, 'nope', { occurredOn: '2026-09-21' })).toThrow(/care event/i);
    expect(listCareEvents(db, plant.id)).toEqual([]);
  });
});

describe('deleting care', () => {
  test('deleting the Care Event just logged puts the plant back where it was', () => {
    const db = gardenDb();
    // Watered every 7 days from its creation on Sep 1: Due Sep 8, 14 days Overdue on the 22nd.
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 1));
    const watered = logCareEvent(db, { plantId: plant.id, type: 'water' }, NOON_SEP_22);
    expect(listNeedsAttention(db, '2026-09-22')).toEqual([]);

    deleteCareEvent(db, watered.id, NOON_SEP_22);

    expect(listNeedsAttention(db, '2026-09-22')).toMatchObject([
      { id: plant.id, care: { water: { state: 'due', dueOn: '2026-09-08', daysOverdue: 14 } } },
    ]);
  });

  test('a deleted Care Event leaves the Care Log as a tombstone stamped by the core clock', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);
    const watered = logCareEvent(db, { plantId: plant.id, type: 'water' }, NOON_SEP_22);
    const later = noon(2026, 9, 23);

    expect(deleteCareEvent(db, watered.id, later)).toEqual({
      ...watered,
      updatedAt: later.toISOString(),
      deletedAt: later.toISOString(),
    });
    expect(listCareEvents(db, plant.id)).toEqual([]);
  });

  test('deleting a repot leaves the Current Pot as it is', () => {
    const db = gardenDb();
    const plant = createPlant(
      db,
      { speciesId: MONSTERA, potSizeCm: 17, soil: 'Peat' },
      NOON_SEP_22,
    );
    const repot = logCareEvent(
      db,
      { plantId: plant.id, type: 'repot', potSizeCm: 21, soil: 'Aroid mix' },
      NOON_SEP_22,
    );

    deleteCareEvent(db, repot.id, NOON_SEP_22);

    expect(getPlant(db, plant.id)).toMatchObject({ potSizeCm: 21, soil: 'Aroid mix' });
  });

  test('only a live Care Event can be deleted', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);
    const watered = logCareEvent(db, { plantId: plant.id, type: 'water' }, NOON_SEP_22);
    deleteCareEvent(db, watered.id, NOON_SEP_22);

    expect(() => deleteCareEvent(db, watered.id)).toThrow(/care event/i);
    expect(() => deleteCareEvent(db, 'nope')).toThrow(/care event/i);
  });
});
