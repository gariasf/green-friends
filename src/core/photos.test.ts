import { MONSTERA, NOON_SEP_22, POTHOS, gardenDb, noon } from '../test/garden';
import { evaluateCare } from './care';
import { listPhotoRows, setPlantPhoto, type PhotoFiles } from './photos';
import { createPlant, listPlants } from './plants';

/** A fake photo store: which prepared JPEG was moved in under which filename. */
function photoStore() {
  const stored = new Map<string, string>();
  const files: PhotoFiles = {
    store: (source, filename) => void stored.set(filename, source),
    remove: (filename) => void stored.delete(filename),
  };
  return { files, stored: () => Object.fromEntries(stored) };
}

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

  test('replacing the photo tombstones the old row and removes its file', () => {
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
});
