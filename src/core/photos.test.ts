import { MONSTERA, NOON_SEP_22, POTHOS, gardenDb, noon } from '../test/garden';
import { photoStore } from '../test/photos';
import { evaluateCare } from './care';
import { listPhotoRows, setPlantPhoto, type PhotoFiles } from './photos';
import { createPlant, listPlants } from './plants';

describe('plant photos', () => {
  test('a photo is filed under its row UUID, stamped by the core clock', () => {
    const db = gardenDb();
    const store = photoStore();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);

    const photo = setPlantPhoto(db, store.files, plant.id, 'file:///cache/pick.jpg', NOON_SEP_22);

    expect(photo).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
      plantId: plant.id,
      filename: `${photo.id}.jpg`,
      createdAt: NOON_SEP_22.toISOString(),
      updatedAt: NOON_SEP_22.toISOString(),
      deletedAt: null,
    });
    expect(store.stored()).toEqual({ [photo.filename]: 'file:///cache/pick.jpg' });
  });

  test('the Garden and Today show each plant with its photo, or with none', () => {
    const db = gardenDb();
    const store = photoStore();
    const monty = createPlant(db, { speciesId: MONSTERA, nickname: 'Monty' }, NOON_SEP_22);
    createPlant(db, { speciesId: POTHOS }, NOON_SEP_22);

    const { filename } = setPlantPhoto(db, store.files, monty.id, 'file:///cache/pick.jpg');

    expect(listPlants(db)).toMatchObject([
      { displayName: 'Monty', photo: filename },
      { displayName: 'Pothos', photo: null },
    ]);
    expect(evaluateCare(db, '2026-09-22')).toMatchObject([
      { displayName: 'Monty', photo: filename },
      { displayName: 'Pothos', photo: null },
    ]);
  });

  test('a replaced photo is Deleted as a tombstone and its file removed', () => {
    const db = gardenDb();
    const store = photoStore();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);
    const first = setPlantPhoto(db, store.files, plant.id, 'file:///cache/first.jpg', NOON_SEP_22);
    const later = noon(2026, 9, 23);

    const second = setPlantPhoto(db, store.files, plant.id, 'file:///cache/second.jpg', later);

    expect(listPhotoRows(db)).toEqual([
      { ...first, updatedAt: later.toISOString(), deletedAt: later.toISOString() },
      second,
    ]);
    expect(store.stored()).toEqual({ [second.filename]: 'file:///cache/second.jpg' });
    expect(listPlants(db)).toMatchObject([{ id: plant.id, photo: second.filename }]);
  });

  test("replacing one plant's photo leaves every other plant's photo alone", () => {
    const db = gardenDb();
    const store = photoStore();
    const monty = createPlant(db, { speciesId: MONSTERA, nickname: 'Monty' }, NOON_SEP_22);
    const pothos = createPlant(db, { speciesId: POTHOS }, NOON_SEP_22);
    setPlantPhoto(db, store.files, monty.id, 'file:///cache/monty.jpg', NOON_SEP_22);
    const kept = setPlantPhoto(db, store.files, pothos.id, 'file:///cache/pothos.jpg', NOON_SEP_22);

    const replaced = setPlantPhoto(db, store.files, monty.id, 'file:///cache/monty-2.jpg');

    expect(listPlants(db)).toMatchObject([
      { displayName: 'Monty', photo: replaced.filename },
      { displayName: 'Pothos', photo: kept.filename },
    ]);
    expect(store.stored()).toEqual({
      [kept.filename]: 'file:///cache/pothos.jpg',
      [replaced.filename]: 'file:///cache/monty-2.jpg',
    });
  });

  test('a photo for an unknown plant is refused and nothing is stored', () => {
    const db = gardenDb();
    const store = photoStore();

    expect(() => setPlantPhoto(db, store.files, 'nope', 'file:///cache/pick.jpg')).toThrow(
      /plant/i,
    );

    expect(store.stored()).toEqual({});
    expect(listPhotoRows(db)).toEqual([]);
  });

  test('a photo the store cannot take leaves the plant with the photo it had', () => {
    const db = gardenDb();
    const store = photoStore();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);
    const photo = setPlantPhoto(db, store.files, plant.id, 'file:///cache/first.jpg', NOON_SEP_22);
    const full: PhotoFiles = {
      ...store.files,
      store: () => {
        throw new Error('Disk full');
      },
    };

    expect(() => setPlantPhoto(db, full, plant.id, 'file:///cache/second.jpg')).toThrow(
      'Disk full',
    );

    expect(listPhotoRows(db)).toEqual([photo]);
    expect(store.stored()).toEqual({ [photo.filename]: 'file:///cache/first.jpg' });
  });

  test('an old file the store cannot remove still leaves the new photo in place', () => {
    const db = gardenDb();
    const store = photoStore();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);
    const first = setPlantPhoto(db, store.files, plant.id, 'file:///cache/first.jpg', NOON_SEP_22);
    const stuck: PhotoFiles = {
      ...store.files,
      remove: () => {
        throw new Error('Permission denied');
      },
    };

    const second = setPlantPhoto(db, stuck, plant.id, 'file:///cache/second.jpg');

    expect(listPlants(db)).toMatchObject([{ id: plant.id, photo: second.filename }]);
    expect(store.stored()).toEqual({
      [first.filename]: 'file:///cache/first.jpg',
      [second.filename]: 'file:///cache/second.jpg',
    });
  });
});
