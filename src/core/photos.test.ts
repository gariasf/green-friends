import { MONSTERA, NOON_SEP_22, POTHOS, gardenDb, noon } from '../test/garden';
import { photoStore } from '../test/photos';
import { evaluateCare } from './care';
import { framePosition, listPhotoRows, setPlantPhoto, type PhotoFiles } from './photos';
import { createPlant, listPlants } from './plants';

describe('plant photos', () => {
  test('a photo is filed under its row UUID, stamped by the core clock', () => {
    const db = gardenDb();
    const store = photoStore();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);

    const photo = setPlantPhoto(
      db,
      store.files,
      plant.id,
      'file:///cache/pick.jpg',
      null,
      NOON_SEP_22,
    );

    expect(photo).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
      plantId: plant.id,
      filename: `${photo.id}.jpg`,
      focusX: null,
      focusY: null,
      aspect: null,
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

  test('a photo keeps the Focal point it was given, and the Garden and Today frame on it', () => {
    const db = gardenDb();
    const store = photoStore();
    const monty = createPlant(db, { speciesId: MONSTERA, nickname: 'Monty' }, NOON_SEP_22);
    createPlant(db, { speciesId: POTHOS }, NOON_SEP_22);
    const focus = { x: 0.3, y: 0.25, aspect: 0.75 };

    const photo = setPlantPhoto(db, store.files, monty.id, 'file:///cache/pick.jpg', focus);

    expect(listPhotoRows(db)).toEqual([photo]);
    expect(photo).toMatchObject({ focusX: 0.3, focusY: 0.25, aspect: 0.75 });
    expect(listPlants(db)).toMatchObject([
      { displayName: 'Monty', focus },
      { displayName: 'Pothos', photo: null, focus: null },
    ]);
    expect(evaluateCare(db, '2026-09-22')).toMatchObject([
      { displayName: 'Monty', focus },
      { displayName: 'Pothos', focus: null },
    ]);
  });

  test('a photo given no point is framed on its centre everywhere', () => {
    const db = gardenDb();
    const store = photoStore();
    const monty = createPlant(db, { speciesId: MONSTERA, nickname: 'Monty' }, NOON_SEP_22);

    setPlantPhoto(db, store.files, monty.id, 'file:///cache/pick.jpg');

    expect(listPlants(db)).toMatchObject([{ displayName: 'Monty', focus: null }]);
    expect(evaluateCare(db, '2026-09-22')).toMatchObject([{ displayName: 'Monty', focus: null }]);
  });

  test('a replaced photo is Deleted as a tombstone and its file removed', () => {
    const db = gardenDb();
    const store = photoStore();
    const plant = createPlant(db, { speciesId: MONSTERA }, NOON_SEP_22);
    const first = setPlantPhoto(
      db,
      store.files,
      plant.id,
      'file:///cache/first.jpg',
      null,
      NOON_SEP_22,
    );
    const later = noon(2026, 9, 23);

    const second = setPlantPhoto(
      db,
      store.files,
      plant.id,
      'file:///cache/second.jpg',
      null,
      later,
    );

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
    setPlantPhoto(db, store.files, monty.id, 'file:///cache/monty.jpg', null, NOON_SEP_22);
    const kept = setPlantPhoto(
      db,
      store.files,
      pothos.id,
      'file:///cache/pothos.jpg',
      null,
      NOON_SEP_22,
    );

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
    const photo = setPlantPhoto(
      db,
      store.files,
      plant.id,
      'file:///cache/first.jpg',
      null,
      NOON_SEP_22,
    );
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
    const first = setPlantPhoto(
      db,
      store.files,
      plant.id,
      'file:///cache/first.jpg',
      null,
      NOON_SEP_22,
    );
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

describe('framing a photo on its Focal point', () => {
  test('a photo with no point is framed on its centre', () => {
    expect(framePosition(null, 1)).toEqual({ x: 0.5, y: 0.5 });
  });

  test('a wide photo in a square slides sideways to put the point in the middle', () => {
    // Twice as wide as the square: 0.6 of the way across sits mid-frame at 0.7 of the slack.
    expect(framePosition({ x: 0.6, y: 0.2, aspect: 2 }, 1)).toEqual({ x: 0.7, y: 0.5 });
    // Three times as wide: 0.4 across, 1.2 frame widths in, less half a frame, over 2 of slack.
    expect(framePosition({ x: 0.4, y: 0.9, aspect: 3 }, 1)).toEqual({ x: 0.35, y: 0.5 });
  });

  test('a tall photo in a wide frame slides up or down', () => {
    // A 3:4 photo in the Web view's 3:2 hero is twice the frame's height.
    expect(framePosition({ x: 0.9, y: 0.3, aspect: 0.75 }, 1.5)).toEqual({ x: 0.5, y: 0.1 });
  });

  test('a point near an edge takes the frame only as far as the edge', () => {
    expect(framePosition({ x: 0.1, y: 0.5, aspect: 2 }, 1)).toEqual({ x: 0, y: 0.5 });
    expect(framePosition({ x: 0.5, y: 0.95, aspect: 0.75 }, 1.5)).toEqual({ x: 0.5, y: 1 });
  });

  test("a photo of the frame's own shape has nothing to slide", () => {
    expect(framePosition({ x: 0.1, y: 0.9, aspect: 1.5 }, 1.5)).toEqual({ x: 0.5, y: 0.5 });
  });
});
