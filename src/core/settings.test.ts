import { openTestDb } from '../test/db';
import { MONSTERA, NOON_SEP_22, POTHOS, gardenDb } from '../test/garden';
import { photoStore } from '../test/photos';
import { listCareEventRows } from './careLog';
import { listPhotoRows, setPlantPhoto } from './photos';
import { createPlant, deletePlant, listPlantRows } from './plants';
import { eraseAllData, getSettings, updateSettings } from './settings';
import { listSpecies } from './species';

describe('settings', () => {
  test('a fresh database carries the default settings', () => {
    const db = openTestDb();

    expect(getSettings(db)).toMatchObject({
      growingStartMonth: 3,
      growingEndMonth: 10,
      digestTime: '09:00',
    });
  });

  test('updating the growing season is visible on the next read', () => {
    const db = openTestDb();

    updateSettings(db, { growingStartMonth: 10, growingEndMonth: 3 });

    expect(getSettings(db)).toMatchObject({
      growingStartMonth: 10,
      growingEndMonth: 3,
      digestTime: '09:00',
    });
  });

  test('a mutation stamps updatedAt as UTC ISO-8601 from the core clock', () => {
    const db = openTestDb();

    updateSettings(db, { growingEndMonth: 9 }, new Date('2026-09-22T07:30:00.000Z'));

    expect(getSettings(db).updatedAt).toBe('2026-09-22T07:30:00.000Z');
  });

  test('rejects a month outside 1-12 and leaves settings untouched', () => {
    const db = openTestDb();

    expect(() => updateSettings(db, { growingStartMonth: 13 })).toThrow(/1 to 12/);

    expect(getSettings(db)).toMatchObject({ growingStartMonth: 3 });
  });

  test('the digest time is kept as the local HH:MM it was set to', () => {
    const db = openTestDb();

    updateSettings(db, { digestTime: '07:30' });

    expect(getSettings(db)).toMatchObject({ digestTime: '07:30', growingStartMonth: 3 });
  });

  test('rejects a digest time that is not a real HH:MM and leaves settings untouched', () => {
    const db = openTestDb();

    for (const digestTime of ['7:30', '24:00', '09:60', 'noon', '']) {
      expect(() => updateSettings(db, { digestTime })).toThrow(/HH:MM/);
    }

    expect(getSettings(db).digestTime).toBe('09:00');
  });
});

describe('Erase all data', () => {
  test('leaves the database as at first launch, tombstones gone, the catalog kept', () => {
    const db = gardenDb();
    const store = photoStore();
    const plant = createPlant(
      db,
      { speciesId: MONSTERA, lastDone: { water: '2026-09-20' } },
      NOON_SEP_22,
    );
    setPlantPhoto(db, store.files, plant.id, 'file:///cache/pick.jpg');
    deletePlant(db, store.files, createPlant(db, { speciesId: POTHOS }).id);
    updateSettings(db, { growingStartMonth: 4, digestTime: '07:30' });

    eraseAllData(db, store.files);

    expect(listPlantRows(db)).toEqual([]);
    expect(listCareEventRows(db)).toEqual([]);
    expect(listPhotoRows(db)).toEqual([]);
    expect(getSettings(db)).toEqual(getSettings(openTestDb()));
    expect(listSpecies(db).map((species) => species.id)).toEqual([MONSTERA, POTHOS]);
  });

  test('removes every photo file', () => {
    const db = gardenDb();
    const store = photoStore();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);
    setPlantPhoto(db, store.files, plant.id, 'file:///cache/pick.jpg');

    eraseAllData(db, store.files);

    expect(store.stored()).toEqual({});
  });
});
