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

/** 08:00 on Sep 24 where the tests run (Auckland). */
const NOW = new Date(2026, 8, 24, 8);

/** One install of the app: its database and its photo folder. */
type Device = { db: Db; store: ReturnType<typeof photoStore> };

/** A device as after first launch, with the pinned catalog, unless given another database. */
function device(db: Db = gardenDb()): Device {
  return { db, store: photoStore() };
}

/** The zip an Export of the device's Garden hands the share sheet. */
async function exportOf({ db, store }: Device, now = NOW): Promise<Uint8Array> {
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

/** Imports `zip` into the device's Garden, bringing it forward in a fresh scratch database. */
function importInto({ db, store }: Device, zip: Uint8Array, files = store.files): void {
  importExport(db, files, emptyDb(), zip, NOW);
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

/** Everything an Import may change on a device: every row, tombstones included, and the photo files. */
function contents({ db, store }: Device) {
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
function plantGarden({ db, store }: Device) {
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

/** The phone's Garden, and a tablet restored from its Export. */
async function phoneAndTablet() {
  const phone = device();
  const garden = plantGarden(phone);
  const tablet = device();
  importInto(tablet, await exportOf(phone));
  const note = listCareEvents(phone.db, garden.monty.id).find((event) => event.type === 'note')!;
  return { phone, tablet, ...garden, note };
}

/**
 * A tablet restored from the phone, which then gave Fern a photo, planted Ivy with a photo and a
 * watering, and moved the digest: the phone's Export now would change the tablet in every table.
 */
async function tabletBehindPhone() {
  const { phone, tablet, fern } = await phoneAndTablet();
  const later = noon(2026, 9, 23);
  setPlantPhoto(phone.db, phone.store.files, fern.id, 'file:///cache/fern.jpg', later);
  const ivy = createPlant(
    phone.db,
    { nickname: 'Ivy', schedule: { ...NO_SCHEDULE, wateringGrowingDays: 5 } },
    later,
  );
  setPlantPhoto(phone.db, phone.store.files, ivy.id, 'file:///cache/ivy.jpg', later);
  logCareEvent(phone.db, { plantId: ivy.id, type: 'water' }, later);
  updateSettings(phone.db, { digestTime: '08:00' }, later);
  return { phone, tablet };
}

describe('Import', () => {
  test('into an empty install restores the whole Export: plants, Care Log, photos, settings', async () => {
    const phone = device();
    plantGarden(phone);
    const fresh = device();

    importInto(fresh, await exportOf(phone));

    expect(contents(fresh)).toEqual(contents(phone));
  });

  test('after Erase all data, restores the Garden as it was at the Export', async () => {
    const phone = device();
    const { monty } = plantGarden(phone);
    const backup = await exportOf(phone);
    const then = contents(phone);
    updatePlant(phone.db, monty.id, { nickname: 'Big Monty' }, noon(2026, 9, 23));
    createPlant(phone.db, { speciesId: POTHOS }, noon(2026, 9, 23));

    eraseAllData(phone.db, phone.store.files);
    importInto(phone, backup);

    expect(contents(phone)).toEqual(then);
  });

  test('leaves out of the photo folder every file in the zip no live photo names', async () => {
    const phone = device();
    plantGarden(phone);
    const zip = spoiled(await exportOf(phone), (json, files) => {
      const replaced = json.photos.find((photo: any) => photo.deleted_at !== null);
      files[`photos/${replaced.filename}`] = strToU8('file:///cache/1.jpg');
      files['photos/5f0c7c8e-3b1a-4d2e-9f6a-0b1c2d3e4f50.jpg'] = strToU8('stray');
      files['notes.txt'] = strToU8('hello');
    });
    const fresh = device();

    importInto(fresh, zip);

    expect(fresh.store.stored()).toEqual(phone.store.stored());
  });

  test('keeps a Care Event on a day still to come here, from an Export made in a timezone ahead', async () => {
    const phone = device();
    plantGarden(phone);
    const zip = spoiled(await exportOf(phone), (json) => {
      json.care_events.find((event: any) => event.type === 'note').occurred_on = '2026-09-25';
    });
    const fresh = device();

    importInto(fresh, zip);

    expect(listCareEventRows(fresh.db)).toContainEqual(
      expect.objectContaining({ type: 'note', occurredOn: '2026-09-25' }),
    );
  });

  describe('merges row by row, the newer edit winning', () => {
    /** Edits every table a day after plantGarden's last write. */
    function editEverything({ db, store }: Device, plantId: string, noteId: string) {
      updatePlant(db, plantId, { nickname: 'Big Monty' }, noon(2026, 9, 23));
      editCareEvent(db, noteId, { note: 'Mites gone' }, noon(2026, 9, 23));
      logCareEvent(db, { plantId, type: 'water' }, noon(2026, 9, 23));
      setPlantPhoto(db, store.files, plantId, 'file:///cache/4.jpg', noon(2026, 9, 23));
      updateSettings(db, { digestTime: '08:00' }, noon(2026, 9, 23));
    }

    test("an older Export never undoes this device's newer edits", async () => {
      const { phone, monty, note } = await phoneAndTablet();
      const backup = await exportOf(phone);
      editEverything(phone, monty.id, note.id);
      const before = contents(phone);

      importInto(phone, backup);

      expect(contents(phone)).toEqual(before);
    });

    test("a newer Export's edits replace this device's older rows", async () => {
      const { phone, tablet, monty, note } = await phoneAndTablet();
      editEverything(phone, monty.id, note.id);

      importInto(tablet, await exportOf(phone));

      expect(contents(tablet)).toEqual(contents(phone));
    });

    test("a newer Export's deletion beats older rows: the plant goes with its Care Log and photo", async () => {
      const { phone, tablet, monty } = await phoneAndTablet();
      deletePlant(phone.db, phone.store.files, monty.id, noon(2026, 9, 23));

      importInto(tablet, await exportOf(phone));

      expect(contents(tablet)).toEqual(contents(phone));
    });

    test('an older Export never brings back what this device Deleted since', async () => {
      const { phone, monty } = await phoneAndTablet();
      const backup = await exportOf(phone);
      deletePlant(phone.db, phone.store.files, monty.id, noon(2026, 9, 23));
      const before = contents(phone);

      importInto(phone, backup);

      expect(contents(phone)).toEqual(before);
    });

    test("an edit on this device newer than the Export's deletion survives it", async () => {
      const { phone, tablet, note } = await phoneAndTablet();
      deleteCareEvent(phone.db, note.id, noon(2026, 9, 23));
      editCareEvent(tablet.db, note.id, { note: 'Mites gone' }, new Date(2026, 8, 23, 18));

      importInto(tablet, await exportOf(phone));

      expect(listCareEventRows(tablet.db)).toContainEqual(
        expect.objectContaining({ id: note.id, note: 'Mites gone', deletedAt: null }),
      );
    });

    test('never rewrites the file of a photo live here: a photo row names one picture for good', async () => {
      const { phone, tablet } = await phoneAndTablet();
      const zip = spoiled(await exportOf(phone), (json, files) => {
        const live = json.photos.find((photo: any) => photo.deleted_at === null);
        live.updated_at = '2026-09-23T00:00:00.000Z';
        files[`photos/${live.filename}`] = strToU8('file:///cache/other.jpg');
      });
      const before = tablet.store.stored();

      importInto(tablet, zip);

      expect(tablet.store.stored()).toEqual(before);
    });

    test('a plant given a new photo on each device keeps the newer, as if it were taken last', async () => {
      const { phone, tablet, monty } = await phoneAndTablet();
      setPlantPhoto(
        phone.db,
        phone.store.files,
        monty.id,
        'file:///cache/4.jpg',
        noon(2026, 9, 23),
      );
      const later = new Date(2026, 8, 23, 18);
      const newer = setPlantPhoto(
        tablet.db,
        tablet.store.files,
        monty.id,
        'file:///cache/5.jpg',
        later,
      );

      importInto(tablet, await exportOf(phone));

      expect(listPlants(tablet.db)).toEqual([
        expect.objectContaining({ id: monty.id, photo: newer.filename }),
      ]);
      expect(tablet.store.stored()).toEqual({ [newer.filename]: 'file:///cache/5.jpg' });
    });
  });

  describe('changes nothing when writing the Export fails', () => {
    test('a photo file that fails partway: the files written before it and its part go again', async () => {
      const { phone, tablet } = await tabletBehindPhone();
      const zip = await exportOf(phone);
      const before = contents(tablet);
      let writes = 0;
      const full: PhotoFiles = {
        ...tablet.store.files,
        write(filename, bytes) {
          if (++writes < 2) return tablet.store.files.write(filename, bytes);
          tablet.store.files.write(filename, bytes.slice(0, 4));
          throw new Error('No space left on device');
        },
      };

      expect(() => importInto(tablet, zip, full)).toThrow('No space left on device');

      expect(contents(tablet)).toEqual(before);
    });

    test('a row the database refuses: no row goes in, nor any photo file', async () => {
      const { phone, tablet } = await tabletBehindPhone();
      const zip = await exportOf(phone);
      const before = contents(tablet);
      // The photos go in after the plants and their Care Log, in the same transaction.
      tablet.db.run(
        sql`CREATE TRIGGER full BEFORE INSERT ON photos BEGIN SELECT RAISE(ABORT, 'database or disk is full'); END`,
      );

      expect(() => importInto(tablet, zip)).toThrow('database or disk is full');

      expect(contents(tablet)).toEqual(before);
    });
  });

  describe('takes an Export of any schema version up to its own', () => {
    test('one from a newer version of the app is refused, to import after an update', async () => {
      const { phone, tablet } = await tabletBehindPhone();
      const zip = spoiled(await exportOf(phone), (json) => {
        json.schema_version += 1;
      });
      const before = contents(tablet);

      expect(() => importInto(tablet, zip)).toThrow(
        'This export is from a newer version of Green Friends. Update the app to import it',
      );

      expect(contents(tablet)).toEqual(before);
    });

    test('an older one comes forward through the migrations', async () => {
      const phone = device();
      plantGarden(phone);
      // Schema version 3: plants and their Care Log, before Archive (4) and photos (5).
      const v3 = spoiled(await exportOf(phone), (json, files) => {
        json.schema_version = 3;
        delete json.photos;
        for (const plant of json.plants) delete plant.archived_at;
        for (const path of Object.keys(files)) delete files[path];
      });
      const fresh = device();

      importInto(fresh, v3);

      expect(contents(fresh)).toEqual({
        ...contents(phone),
        plants: listPlantRows(phone.db).map((plant) => ({ ...plant, archivedAt: null })),
        photos: [],
        files: {},
      });
    });
  });

  describe('keeps a Species this catalog lacks, which a newer one on the exporting device has', () => {
    /** A device still on the catalog before Pothos. */
    function olderCatalogDevice(): Device {
      const db = openTestDb();
      seedSpecies(db, { version: 1, species: [catalog.monstera] });
      return device(db);
    }

    /** A Pothos with no nickname, watered on its own Override, imported where the catalog lacks Pothos. */
    async function driftedPothos() {
      const phone = device();
      const pothos = createPlant(phone.db, { speciesId: POTHOS }, noon(2026, 9, 20));
      updatePlant(phone.db, pothos.id, { wateringGrowingDays: 3 }, noon(2026, 9, 20));
      const tablet = olderCatalogDevice();
      importInto(tablet, await exportOf(phone));
      return { pothos, tablet };
    }

    test("the plant keeps the reference and takes the snapshot's name as its nickname", async () => {
      const { pothos, tablet } = await driftedPothos();

      expect(getPlant(tablet.db, pothos.id)).toMatchObject({
        speciesId: POTHOS,
        nickname: 'Pothos',
      });
    });

    test('its Care Schedule is its Overrides alone', async () => {
      const { tablet } = await driftedPothos();

      expect(evaluateCare(tablet.db, '2026-09-24')).toMatchObject([
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

      seedSpecies(tablet.db, { version: 2, species: Object.values(catalog) });

      expect(evaluateCare(tablet.db, '2026-09-24')[0].care.fertilize).toEqual({
        state: 'upcoming',
        dueOn: '2026-10-20',
      });
    });

    test('an Export made where the catalog lacks the Species imports on another device lacking it', async () => {
      const { pothos, tablet } = await driftedPothos();
      const other = olderCatalogDevice();

      importInto(other, await exportOf(tablet));

      expect(getDisplayName(other.db, pothos.id)).toBe('Pothos');
    });

    test('a plant with no nickname and a Species neither the export nor the catalog names is refused', async () => {
      const phone = device();
      createPlant(phone.db, { speciesId: POTHOS }, noon(2026, 9, 20));
      const zip = spoiled(await exportOf(phone), (json) => {
        json.species_refs = [{ id: POTHOS, colloquial_name: null, scientific_name: null }];
      });
      const tablet = olderCatalogDevice();

      expect(() => importInto(tablet, zip)).toThrow(
        'A plant without a known species needs a nickname',
      );
    });
  });

  describe('refuses, changing nothing, an Export it cannot import whole', () => {
    const NOT_AN_EXPORT = 'This file is not a Green Friends export';
    // Rows of tabletBehindPhone's Export.
    const livePhoto = (json: any) => json.photos.find((photo: any) => photo.deleted_at === null);
    const plantNamed = (json: any, nickname: string) =>
      json.plants.find((plant: any) => plant.nickname === nickname);
    const note = (json: any) => json.care_events.find((event: any) => event.type === 'note');
    /** Files the first live photo under `filename`, in its row and in the zip. */
    const refile = (json: any, files: Unzipped, filename: string) => {
      const photo = livePhoto(json);
      files[`photos/${filename}`] = files[`photos/${photo.filename}`];
      photo.filename = filename;
    };
    test.each<[string, (json: any, files: Unzipped) => Uint8Array | void, string | RegExp]>([
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
        'a nickname of nothing but spaces',
        (json) => void (plantNamed(json, 'Monty').nickname = '   '),
        'Nickname must not be blank or have spaces around it',
      ],
      [
        'a Note of nothing but spaces',
        (json) => void (note(json).note = '   '),
        'Note must not be blank or have spaces around it',
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
        'settings in a row of their own',
        (json) => void (json.settings[0].id = '5f0c7c8e-3b1a-4d2e-9f6a-0b1c2d3e4f50'),
        'Settings must be one row',
      ],
      ['no settings', (json) => void (json.settings = []), 'Settings must be one row'],
      [
        'a time that is not UTC ISO-8601',
        (json) => void (plantNamed(json, 'Monty').updated_at = '2026-09-22'),
        'Not a UTC time: 2026-09-22',
      ],
      [
        'a column its schema version does not have',
        (json) => void (plantNamed(json, 'Monty').colour = 'green'),
        /^This export is damaged\. .*colour/,
      ],
      [
        'a row without a column that must be set',
        (json) => void delete plantNamed(json, 'Monty').created_at,
        /^This export is damaged\. .*created_at/,
      ],
    ])('%s', async (_, edit, message) => {
      const { phone, tablet } = await tabletBehindPhone();
      const zip = spoiled(await exportOf(phone), edit);
      const before = contents(tablet);

      expect(() => importInto(tablet, zip)).toThrow(message);

      expect(contents(tablet)).toEqual(before);
    });
  });
});
