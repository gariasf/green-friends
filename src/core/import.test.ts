import { sql } from 'drizzle-orm';
import { strFromU8, strToU8, unzipSync, zipSync, type Unzipped } from 'fflate';

import type { Db } from '../db/types';
import { emptyDb, openTestDb } from '../test/db';
import { MONSTERA, POTHOS, catalog, gardenDb, noon } from '../test/garden';
import { photoStore } from '../test/photos';
import {
  deleteCareEvent,
  editCareEvent,
  listCareEventRows,
  listCareEvents,
  logCareEvent,
} from './careLog';
import { evaluateCare } from './care';
import { shareExport } from './export';
import { importExport } from './import';
import { listPhotoRows, setPlantPhoto, type PhotoFiles } from './photos';
import {
  NO_SCHEDULE,
  archivePlant,
  createPlant,
  deletePlant,
  getDisplayName,
  getPlant,
  listPlantRows,
  listPlants,
  updatePlant,
} from './plants';
import { eraseAllData, getSettings, updateSettings } from './settings';
import { seedSpecies } from './species';

type Store = ReturnType<typeof photoStore>;

/** 08:00 on Sep 24 where the tests run (Auckland). */
const NOW = new Date(2026, 8, 24, 8);

/** The zip an Export of the Garden in `db` hands the share sheet. */
async function exportOf(db: Db, store: Store, now = NOW): Promise<Uint8Array> {
  const zips: Uint8Array[] = [];
  await shareExport(
    db,
    store.files,
    { share: async (_, zip) => void zips.push(zip) },
    '1.2.3',
    now,
  );
  return zips[0];
}

/** Imports `zip` into the Garden in `db`, bringing it forward in a fresh scratch database. */
function importInto(db: Db, store: Store, zip: Uint8Array, now = NOW): void {
  importExport(db, store.files, emptyDb(), zip, now);
}

/**
 * `zip` with its export.json and files as `edit` leaves them, or whatever `edit` returns instead:
 * an Export spoiled on its way.
 */
function spoiled(
  zip: Uint8Array,
  edit: (json: any, files: Unzipped) => Uint8Array | void,
): Uint8Array {
  const { 'export.json': bytes, ...files } = unzipSync(zip);
  const json = JSON.parse(strFromU8(bytes));
  return edit(json, files) ?? zipSync({ 'export.json': strToU8(JSON.stringify(json)), ...files });
}

/** Everything an Import may change: every row, tombstones included, and the photo files. */
function contents(db: Db, store: Store) {
  return {
    plants: listPlantRows(db),
    careEvents: listCareEventRows(db),
    photos: listPhotoRows(db),
    settings: getSettings(db),
    files: store.stored(),
  };
}

/**
 * A Garden with one of everything an Export carries: a Species plant with its Care Log (a
 * backdated watering, a Note, a repot, a Deleted feed) and a replaced photo, an Archived
 * species-less plant with an Override, a Deleted plant, and edited settings.
 */
function plantGarden(db: Db, store: Store) {
  const monty = createPlant(
    db,
    { speciesId: MONSTERA, nickname: 'Monty', potSizeCm: 14, lastDone: { water: '2026-09-18' } },
    noon(2026, 9, 20),
  );
  const plantId = monty.id;
  logCareEvent(db, { plantId, type: 'note', note: 'Spider mites' }, noon(2026, 9, 21));
  logCareEvent(db, { plantId, type: 'repot', potSizeCm: 17, soil: 'Bark' }, noon(2026, 9, 21));
  const fed = logCareEvent(db, { plantId, type: 'fertilize' }, noon(2026, 9, 21));
  deleteCareEvent(db, fed.id, noon(2026, 9, 22));
  setPlantPhoto(db, store.files, plantId, 'file:///cache/1.jpg', noon(2026, 9, 21));
  setPlantPhoto(db, store.files, plantId, 'file:///cache/2.jpg', noon(2026, 9, 22));
  updatePlant(db, plantId, { wateringGrowingDays: 5 }, noon(2026, 9, 22));
  const fern = createPlant(
    db,
    { nickname: 'Fern', schedule: { ...NO_SCHEDULE, wateringGrowingDays: 4 } },
    noon(2026, 9, 20),
  );
  archivePlant(db, fern.id, noon(2026, 9, 22));
  const pothos = createPlant(db, { speciesId: POTHOS }, noon(2026, 9, 20));
  setPlantPhoto(db, store.files, pothos.id, 'file:///cache/3.jpg', noon(2026, 9, 21));
  deletePlant(db, store.files, pothos.id, noon(2026, 9, 22));
  updateSettings(
    db,
    { growingStartMonth: 9, growingEndMonth: 4, digestTime: '07:00' },
    noon(2026, 9, 22),
  );
  return { monty, fern, pothos };
}

describe('Import', () => {
  test('into an empty install restores the whole Export: plants, Care Log, photos, settings', async () => {
    const [phone, phoneStore] = [gardenDb(), photoStore()];
    plantGarden(phone, phoneStore);
    const [fresh, freshStore] = [gardenDb(), photoStore()];

    importInto(fresh, freshStore, await exportOf(phone, phoneStore));

    expect(contents(fresh, freshStore)).toEqual(contents(phone, phoneStore));
  });

  test('after Erase all data, restores the Garden as it was at the Export', async () => {
    const [phone, phoneStore] = [gardenDb(), photoStore()];
    const { monty } = plantGarden(phone, phoneStore);
    const backup = await exportOf(phone, phoneStore);
    const then = contents(phone, phoneStore);
    updatePlant(phone, monty.id, { nickname: 'Big Monty' }, noon(2026, 9, 23));
    createPlant(phone, { speciesId: POTHOS }, noon(2026, 9, 23));

    eraseAllData(phone, phoneStore.files);
    importInto(phone, phoneStore, backup);

    expect(contents(phone, phoneStore)).toEqual(then);
  });

  test('leaves out of the photo folder every file in the zip no live photo names', async () => {
    const [phone, phoneStore] = [gardenDb(), photoStore()];
    plantGarden(phone, phoneStore);
    const zip = spoiled(await exportOf(phone, phoneStore), (json, files) => {
      const replaced = json.photos.find((photo: any) => photo.deleted_at !== null);
      files[`photos/${replaced.filename}`] = strToU8('file:///cache/1.jpg');
      files['photos/5f0c7c8e-3b1a-4d2e-9f6a-0b1c2d3e4f50.jpg'] = strToU8('stray');
      files['notes.txt'] = strToU8('hello');
    });
    const [fresh, freshStore] = [gardenDb(), photoStore()];

    importInto(fresh, freshStore, zip);

    expect(freshStore.stored()).toEqual(phoneStore.stored());
  });

  describe('merges row by row, the newer edit winning', () => {
    /** The phone's Garden, and a tablet restored from its Export. */
    async function phoneAndTablet() {
      const [phone, phoneStore] = [gardenDb(), photoStore()];
      const { monty } = plantGarden(phone, phoneStore);
      const [tablet, tabletStore] = [gardenDb(), photoStore()];
      importInto(tablet, tabletStore, await exportOf(phone, phoneStore));
      const note = listCareEvents(phone, monty.id).find((event) => event.type === 'note')!;
      return { phone, phoneStore, tablet, tabletStore, monty, note };
    }

    /** Edits every table a day after plantGarden's last write. */
    function editEverything(db: Db, store: Store, plantId: string, noteId: string) {
      updatePlant(db, plantId, { nickname: 'Big Monty' }, noon(2026, 9, 23));
      editCareEvent(db, noteId, { note: 'Mites gone' }, noon(2026, 9, 23));
      logCareEvent(db, { plantId, type: 'water' }, noon(2026, 9, 23));
      setPlantPhoto(db, store.files, plantId, 'file:///cache/4.jpg', noon(2026, 9, 23));
      updateSettings(db, { digestTime: '08:00' }, noon(2026, 9, 23));
    }

    test("an older Export never undoes this device's newer edits", async () => {
      const { phone, phoneStore, monty, note } = await phoneAndTablet();
      const backup = await exportOf(phone, phoneStore);
      editEverything(phone, phoneStore, monty.id, note.id);
      const before = contents(phone, phoneStore);

      importInto(phone, phoneStore, backup);

      expect(contents(phone, phoneStore)).toEqual(before);
    });

    test("a newer Export's edits replace this device's older rows", async () => {
      const { phone, phoneStore, tablet, tabletStore, monty, note } = await phoneAndTablet();
      editEverything(phone, phoneStore, monty.id, note.id);

      importInto(tablet, tabletStore, await exportOf(phone, phoneStore));

      expect(contents(tablet, tabletStore)).toEqual(contents(phone, phoneStore));
    });

    test("a newer Export's deletion beats older rows: the plant goes with its Care Log and photo", async () => {
      const { phone, phoneStore, tablet, tabletStore, monty } = await phoneAndTablet();
      deletePlant(phone, phoneStore.files, monty.id, noon(2026, 9, 23));

      importInto(tablet, tabletStore, await exportOf(phone, phoneStore));

      expect(contents(tablet, tabletStore)).toEqual(contents(phone, phoneStore));
    });

    test('an older Export never brings back what this device Deleted since', async () => {
      const { phone, phoneStore, monty } = await phoneAndTablet();
      const backup = await exportOf(phone, phoneStore);
      deletePlant(phone, phoneStore.files, monty.id, noon(2026, 9, 23));
      const before = contents(phone, phoneStore);

      importInto(phone, phoneStore, backup);

      expect(contents(phone, phoneStore)).toEqual(before);
    });

    test("an edit on this device newer than the Export's deletion survives it", async () => {
      const { phone, phoneStore, tablet, tabletStore, note } = await phoneAndTablet();
      deleteCareEvent(phone, note.id, noon(2026, 9, 23));
      editCareEvent(tablet, note.id, { note: 'Mites gone' }, new Date(2026, 8, 23, 18));

      importInto(tablet, tabletStore, await exportOf(phone, phoneStore));

      expect(listCareEventRows(tablet).find((event) => event.id === note.id)).toMatchObject({
        note: 'Mites gone',
        deletedAt: null,
      });
    });

    test('never rewrites the file of a photo live here: a photo row names one picture for good', async () => {
      const { phone, phoneStore, tablet, tabletStore } = await phoneAndTablet();
      const zip = spoiled(await exportOf(phone, phoneStore), (json, files) => {
        const live = json.photos.find((photo: any) => photo.deleted_at === null);
        live.updated_at = '2026-09-23T00:00:00.000Z';
        files[`photos/${live.filename}`] = strToU8('file:///cache/other.jpg');
      });
      const before = tabletStore.stored();

      importInto(tablet, tabletStore, zip);

      expect(tabletStore.stored()).toEqual(before);
    });

    test('a plant given a new photo on each device keeps the newer, as if it were taken last', async () => {
      const { phone, phoneStore, tablet, tabletStore, monty } = await phoneAndTablet();
      setPlantPhoto(phone, phoneStore.files, monty.id, 'file:///cache/4.jpg', noon(2026, 9, 23));
      const later = new Date(2026, 8, 23, 18);
      const newer = setPlantPhoto(
        tablet,
        tabletStore.files,
        monty.id,
        'file:///cache/5.jpg',
        later,
      );

      importInto(tablet, tabletStore, await exportOf(phone, phoneStore));

      expect(listPlants(tablet)).toEqual([
        expect.objectContaining({ id: monty.id, photo: newer.filename }),
      ]);
      expect(tabletStore.stored()).toEqual({ [newer.filename]: 'file:///cache/5.jpg' });
    });
  });

  describe('changes nothing when writing the Export fails', () => {
    test('a photo file that cannot be written: the files written before it go again', async () => {
      const [phone, phoneStore] = [gardenDb(), photoStore()];
      const { fern } = plantGarden(phone, phoneStore);
      setPlantPhoto(phone, phoneStore.files, fern.id, 'file:///cache/5.jpg', noon(2026, 9, 23));
      const zip = await exportOf(phone, phoneStore);
      const [fresh, freshStore] = [gardenDb(), photoStore()];
      const before = contents(fresh, freshStore);
      let writes = 0;
      const full: PhotoFiles = {
        ...freshStore.files,
        write(filename, bytes) {
          if (++writes === 2) throw new Error('No space left on device');
          freshStore.files.write(filename, bytes);
        },
      };

      expect(() => importExport(fresh, full, emptyDb(), zip, NOW)).toThrow(
        'No space left on device',
      );

      expect(contents(fresh, freshStore)).toEqual(before);
    });

    test('a row the database refuses: no row goes in, nor any photo file', async () => {
      const [phone, phoneStore] = [gardenDb(), photoStore()];
      plantGarden(phone, phoneStore);
      const zip = await exportOf(phone, phoneStore);
      const [fresh, freshStore] = [gardenDb(), photoStore()];
      const before = contents(fresh, freshStore);
      fresh.run(
        sql`CREATE TRIGGER full BEFORE INSERT ON care_events BEGIN SELECT RAISE(ABORT, 'database or disk is full'); END`,
      );

      expect(() => importInto(fresh, freshStore, zip)).toThrow('database or disk is full');

      expect(contents(fresh, freshStore)).toEqual(before);
    });
  });

  describe('takes an Export of any schema version up to its own', () => {
    test('one from a newer version of the app is refused, to import after an update', async () => {
      const [phone, phoneStore] = [gardenDb(), photoStore()];
      plantGarden(phone, phoneStore);
      const zip = spoiled(await exportOf(phone, phoneStore), (json) => {
        json.schema_version += 1;
      });
      const [fresh, freshStore] = [gardenDb(), photoStore()];
      const before = contents(fresh, freshStore);

      expect(() => importInto(fresh, freshStore, zip)).toThrow(
        'This export is from a newer version of Green Friends. Update the app to import it',
      );

      expect(contents(fresh, freshStore)).toEqual(before);
    });

    test('an older one comes forward through the migrations', async () => {
      const [phone, phoneStore] = [gardenDb(), photoStore()];
      plantGarden(phone, phoneStore);
      // Schema version 3: plants and their Care Log, before Archive (4) and photos (5).
      const v3 = spoiled(await exportOf(phone, phoneStore), (json, files) => {
        json.schema_version = 3;
        delete json.photos;
        for (const plant of json.plants) delete plant.archived_at;
        for (const path of Object.keys(files)) delete files[path];
      });
      const [fresh, freshStore] = [gardenDb(), photoStore()];

      importInto(fresh, freshStore, v3);

      expect(contents(fresh, freshStore)).toEqual({
        ...contents(phone, phoneStore),
        plants: listPlantRows(phone).map((plant) => ({ ...plant, archivedAt: null })),
        photos: [],
        files: {},
      });
    });
  });

  describe('keeps a Species this catalog lacks, which a newer one on the exporting device has', () => {
    /** A device still on the catalog before Pothos. */
    function olderCatalogDb() {
      const db = openTestDb();
      seedSpecies(db, { version: 1, species: [catalog.monstera] });
      return db;
    }

    /** A Pothos with no nickname, watered on its own Override, exported and imported where the catalog lacks Pothos. */
    async function driftedPothos() {
      const [phone, phoneStore] = [gardenDb(), photoStore()];
      const pothos = createPlant(phone, { speciesId: POTHOS }, noon(2026, 9, 20));
      updatePlant(phone, pothos.id, { wateringGrowingDays: 3 }, noon(2026, 9, 20));
      const [tablet, tabletStore] = [olderCatalogDb(), photoStore()];
      importInto(tablet, tabletStore, await exportOf(phone, phoneStore));
      return { pothos, tablet, tabletStore };
    }

    test("the plant keeps the reference and takes the snapshot's name as its nickname", async () => {
      const { pothos, tablet } = await driftedPothos();

      expect(getPlant(tablet, pothos.id)).toMatchObject({ speciesId: POTHOS, nickname: 'Pothos' });
    });

    test('its Care Schedule is its Overrides alone', async () => {
      const { tablet } = await driftedPothos();

      expect(evaluateCare(tablet, '2026-09-24')).toMatchObject([
        {
          displayName: 'Pothos',
          scientificName: null,
          care: {
            water: { state: 'due', dueOn: '2026-09-23', daysOverdue: 1 },
            fertilize: { state: 'unscheduled' },
            repot: { state: 'unscheduled' },
          },
        },
      ]);
    });

    test('it picks up the Species defaults once a later catalog ships the Species', async () => {
      const { tablet } = await driftedPothos();

      seedSpecies(tablet, { version: 2, species: Object.values(catalog) });

      expect(evaluateCare(tablet, '2026-09-24')[0].care.fertilize).toEqual({
        state: 'upcoming',
        dueOn: '2026-10-20',
      });
    });

    test('an Export made where the catalog lacks the Species imports on another device lacking it', async () => {
      const { pothos, tablet, tabletStore } = await driftedPothos();
      const [other, otherStore] = [olderCatalogDb(), photoStore()];

      importInto(other, otherStore, await exportOf(tablet, tabletStore));

      expect(getDisplayName(other, pothos.id)).toBe('Pothos');
    });

    test('a plant with no nickname and a Species neither the export nor the catalog names is refused', async () => {
      const [phone, phoneStore] = [gardenDb(), photoStore()];
      createPlant(phone, { speciesId: POTHOS }, noon(2026, 9, 20));
      const zip = spoiled(await exportOf(phone, phoneStore), (json) => {
        json.species_refs = [{ id: POTHOS, colloquial_name: null, scientific_name: null }];
      });
      const [tablet, tabletStore] = [olderCatalogDb(), photoStore()];

      expect(() => importInto(tablet, tabletStore, zip)).toThrow(
        'A plant without a known species needs a nickname',
      );
    });
  });

  describe('refuses, changing nothing, an Export it cannot import whole', () => {
    const NOT_AN_EXPORT = 'This file is not a Green Friends export';
    // plantGarden's rows in its Export.
    const livePhoto = (json: any) => json.photos.find((photo: any) => photo.deleted_at === null);
    const plantNamed = (json: any, nickname: string) =>
      json.plants.find((plant: any) => plant.nickname === nickname);
    const note = (json: any) => json.care_events.find((event: any) => event.type === 'note');
    /** Files the live photo under `filename`, in its row and in the zip. */
    const refile = (json: any, files: Unzipped, filename: string) => {
      const photo = livePhoto(json);
      files[`photos/${filename}`] = files[`photos/${photo.filename}`];
      photo.filename = filename;
    };
    test.each<[string, (json: any, files: Unzipped) => Uint8Array | void, string]>([
      ['a file that is no zip', () => strToU8('PK?'), NOT_AN_EXPORT],
      ['a zip without export.json', (_, files) => zipSync(files), NOT_AN_EXPORT],
      [
        'an export.json that is no JSON',
        (_, files) => zipSync({ 'export.json': strToU8('{"plants": ['), ...files }),
        NOT_AN_EXPORT,
      ],
      [
        'an export.json without a schema version',
        (json) => void delete json.schema_version,
        NOT_AN_EXPORT,
      ],
      [
        'an export.json without the plants',
        (json) => void delete json.plants,
        'This export is damaged. No plants',
      ],
      [
        'a plant whose Species the export does not name',
        (json) => void (json.species_refs = []),
        'which it does not name',
      ],
      [
        'a live photo without its file',
        (json, files) => void delete files[`photos/${livePhoto(json).filename}`],
        'This export is damaged. No file for photo',
      ],
      [
        'a plant with two live photos',
        (json, files) => {
          const replaced = json.photos.find(
            (photo: any) => photo.plant_id === livePhoto(json).plant_id && photo.deleted_at,
          );
          replaced.deleted_at = null;
          files[`photos/${replaced.filename}`] = strToU8('file:///cache/1.jpg');
        },
        'has two photos',
      ],
      [
        'a photo filed outside the photo folder',
        (json, files) => refile(json, files, `../${livePhoto(json).filename}`),
        "A photo's file must be named <its id>.jpg, not ../",
      ],
      [
        'a photo whose id is no UUID',
        (json, files) => {
          refile(json, files, '../../Documents/SQLite/green-friends.db.jpg');
          livePhoto(json).id = '../../Documents/SQLite/green-friends.db';
        },
        'Not a row id: ../../Documents',
      ],
      [
        'a plant with neither a nickname nor a Species',
        (json) => void (plantNamed(json, 'Fern').nickname = null),
        'A plant without a known species needs a nickname',
      ],
      [
        'a Care Event on no calendar day',
        (json) => void (note(json).occurred_on = '2026-02-30'),
        'Not a calendar day: 2026-02-30',
      ],
      [
        'a Care Event of no known type',
        (json) => void (note(json).type = 'prune'),
        'Not a Care Event type: prune',
      ],
      [
        'a Growing season starting in no month',
        (json) => void (json.settings[0].growing_start_month = 13),
        'Month must be an integer from 1 to 12, got 13',
      ],
      [
        'settings in a second row',
        (json) => void (json.settings[0].id = '5f0c7c8e-3b1a-4d2e-9f6a-0b1c2d3e4f50'),
        'Not the settings row: 5f0c7c8e',
      ],
      [
        'a time that is not UTC ISO-8601',
        (json) => void (plantNamed(json, 'Monty').updated_at = '2026-09-22'),
        'Not a UTC time: 2026-09-22',
      ],
      [
        'a column its schema version does not have',
        (json) => void (plantNamed(json, 'Monty').colour = 'green'),
        'has no column named colour',
      ],
      [
        'a row without a column that must be set',
        (json) => void delete plantNamed(json, 'Monty').created_at,
        'NOT NULL constraint failed: plants.created_at',
      ],
    ])('%s', async (_, edit, message) => {
      const [phone, phoneStore] = [gardenDb(), photoStore()];
      plantGarden(phone, phoneStore);
      const zip = spoiled(await exportOf(phone, phoneStore), edit);
      const [fresh, freshStore] = [gardenDb(), photoStore()];
      const before = contents(fresh, freshStore);

      expect(() => importInto(fresh, freshStore, zip)).toThrow(message);

      expect(contents(fresh, freshStore)).toEqual(before);
    });
  });
});
