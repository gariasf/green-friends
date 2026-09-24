import { strFromU8, unzipSync } from 'fflate';

import { getSchemaVersion } from '../db/migrate';
import type { Db } from '../db/types';
import { MONSTERA, POTHOS, gardenDb, noon } from '../test/garden';
import { photoStore } from '../test/photos';
import { deleteCareEvent, listCareEvents, logCareEvent } from './careLog';
import { shareExport } from './export';
import { setPlantPhoto } from './photos';
import { NO_SCHEDULE, archivePlant, createPlant, deletePlant, updatePlant } from './plants';
import { updateSettings } from './settings';

/** 08:00 on Sep 24 where the tests run (Auckland, UTC+12): still Sep 23 in UTC. */
const NOW = new Date(2026, 8, 24, 8);

/**
 * Exports the Garden to a fake share sheet and opens the zip it was handed: export.json, parsed,
 * and every other file in it, as the text the fake photo store holds for a photo (its source).
 */
async function exportGarden(db: Db, files = photoStore().files, now = NOW) {
  const shared: { name: string; zip: Uint8Array }[] = [];
  const sheet = { share: async (name: string, zip: Uint8Array) => void shared.push({ name, zip }) };
  await shareExport(db, files, sheet, '1.2.3', now);
  expect(shared).toHaveLength(1);
  const [{ name, zip }] = shared;
  const { 'export.json': json, ...others } = unzipSync(zip);
  return {
    name,
    json: JSON.parse(strFromU8(json)),
    files: Object.fromEntries(
      Object.entries(others).map(([path, bytes]) => [path, strFromU8(bytes)]),
    ),
  };
}

describe('Export', () => {
  test('is one zip named for the local day it was made, export.json alone for an empty Garden', async () => {
    const db = gardenDb();

    const { name, files } = await exportGarden(db);

    expect(name).toBe('green-friends-2026-09-24.zip');
    expect(files).toEqual({});
  });

  test('export.json opens with the schema version, the time of export and the app version', async () => {
    const db = gardenDb();

    const { json } = await exportGarden(db);

    expect(json).toMatchObject({
      schema_version: getSchemaVersion(db),
      exported_at: '2026-09-23T20:00:00.000Z',
      app_version: '1.2.3',
    });
  });

  test('carries every plant verbatim under its column names, Archived and Deleted ones too', async () => {
    const db = gardenDb();
    const store = photoStore();
    const monty = createPlant(
      db,
      { speciesId: MONSTERA, nickname: 'Monty', potSizeCm: 14, soil: 'Aroid mix' },
      noon(2026, 9, 20),
    );
    updatePlant(db, monty.id, { wateringGrowingDays: 5 }, noon(2026, 9, 23));
    const fern = createPlant(
      db,
      {
        nickname: 'Fern',
        schedule: { ...NO_SCHEDULE, wateringGrowingDays: 4, wateringDormantDays: 7 },
      },
      noon(2026, 9, 21),
    );
    archivePlant(db, fern.id, noon(2026, 9, 23));
    const pothos = createPlant(db, { speciesId: POTHOS }, noon(2026, 9, 22));
    deletePlant(db, store.files, pothos.id, noon(2026, 9, 23));

    const { json } = await exportGarden(db, store.files);

    // Local noon in Auckland is midnight UTC.
    expect(json.plants).toEqual([
      {
        id: monty.id,
        species_id: 'Q161077',
        nickname: 'Monty',
        pot_size_cm: 14,
        soil: 'Aroid mix',
        watering_growing_days: 5,
        watering_dormant_days: null,
        fertilizing_growing_days: null,
        fertilizing_dormant_days: null,
        repotting_months: null,
        created_at: '2026-09-20T00:00:00.000Z',
        updated_at: '2026-09-23T00:00:00.000Z',
        archived_at: null,
        deleted_at: null,
      },
      {
        id: fern.id,
        species_id: null,
        nickname: 'Fern',
        pot_size_cm: null,
        soil: null,
        watering_growing_days: 4,
        watering_dormant_days: 7,
        fertilizing_growing_days: null,
        fertilizing_dormant_days: null,
        repotting_months: null,
        created_at: '2026-09-21T00:00:00.000Z',
        updated_at: '2026-09-23T00:00:00.000Z',
        archived_at: '2026-09-23T00:00:00.000Z',
        deleted_at: null,
      },
      {
        id: pothos.id,
        species_id: 'Q161809',
        nickname: null,
        pot_size_cm: null,
        soil: null,
        watering_growing_days: null,
        watering_dormant_days: null,
        fertilizing_growing_days: null,
        fertilizing_dormant_days: null,
        repotting_months: null,
        created_at: '2026-09-22T00:00:00.000Z',
        updated_at: '2026-09-23T00:00:00.000Z',
        archived_at: null,
        deleted_at: '2026-09-23T00:00:00.000Z',
      },
    ]);
  });

  test('carries the whole Care Log verbatim: notes, repot pots and Deleted events too', async () => {
    const db = gardenDb();
    const monty = createPlant(
      db,
      { speciesId: MONSTERA, lastDone: { water: '2026-09-18' } },
      noon(2026, 9, 20),
    );
    const [water] = listCareEvents(db, monty.id);
    const plantId = monty.id;
    const note = logCareEvent(
      db,
      { plantId, type: 'note', note: 'Spider mites under the leaves' },
      noon(2026, 9, 21),
    );
    const repot = logCareEvent(
      db,
      { plantId, type: 'repot', potSizeCm: 17, soil: 'Bark mix' },
      noon(2026, 9, 22),
    );
    const fed = logCareEvent(db, { plantId, type: 'fertilize' }, noon(2026, 9, 23));
    deleteCareEvent(db, fed.id, new Date(2026, 8, 23, 18));

    const { json } = await exportGarden(db);

    expect(json.care_events).toEqual([
      {
        id: water.id,
        plant_id: plantId,
        type: 'water',
        occurred_on: '2026-09-18',
        note: null,
        pot_size_cm: null,
        soil: null,
        created_at: '2026-09-20T00:00:00.000Z',
        updated_at: '2026-09-20T00:00:00.000Z',
        deleted_at: null,
      },
      {
        id: note.id,
        plant_id: plantId,
        type: 'note',
        occurred_on: '2026-09-21',
        note: 'Spider mites under the leaves',
        pot_size_cm: null,
        soil: null,
        created_at: '2026-09-21T00:00:00.000Z',
        updated_at: '2026-09-21T00:00:00.000Z',
        deleted_at: null,
      },
      {
        id: repot.id,
        plant_id: plantId,
        type: 'repot',
        occurred_on: '2026-09-22',
        note: null,
        pot_size_cm: 17,
        soil: 'Bark mix',
        created_at: '2026-09-22T00:00:00.000Z',
        updated_at: '2026-09-22T00:00:00.000Z',
        deleted_at: null,
      },
      {
        id: fed.id,
        plant_id: plantId,
        type: 'fertilize',
        occurred_on: '2026-09-23',
        note: null,
        pot_size_cm: null,
        soil: null,
        created_at: '2026-09-23T00:00:00.000Z',
        updated_at: '2026-09-23T06:00:00.000Z',
        deleted_at: '2026-09-23T06:00:00.000Z',
      },
    ]);
  });

  test('carries every photo row, replaced ones too, and the file of each live one', async () => {
    const db = gardenDb();
    const { files } = photoStore();
    const monty = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 20));
    const first = setPlantPhoto(db, files, monty.id, 'file:///cache/1.jpg', noon(2026, 9, 21));
    const second = setPlantPhoto(db, files, monty.id, 'file:///cache/2.jpg', noon(2026, 9, 22));
    const pothos = createPlant(db, { speciesId: POTHOS }, noon(2026, 9, 20));
    const kept = setPlantPhoto(db, files, pothos.id, 'file:///cache/3.jpg', noon(2026, 9, 23));
    archivePlant(db, pothos.id, noon(2026, 9, 23));

    const zipped = await exportGarden(db, files);

    expect(zipped.json.photos).toEqual([
      {
        id: first.id,
        plant_id: monty.id,
        filename: `${first.id}.jpg`,
        created_at: '2026-09-21T00:00:00.000Z',
        updated_at: '2026-09-22T00:00:00.000Z',
        deleted_at: '2026-09-22T00:00:00.000Z',
      },
      {
        id: second.id,
        plant_id: monty.id,
        filename: `${second.id}.jpg`,
        created_at: '2026-09-22T00:00:00.000Z',
        updated_at: '2026-09-22T00:00:00.000Z',
        deleted_at: null,
      },
      {
        id: kept.id,
        plant_id: pothos.id,
        filename: `${kept.id}.jpg`,
        created_at: '2026-09-23T00:00:00.000Z',
        updated_at: '2026-09-23T00:00:00.000Z',
        deleted_at: null,
      },
    ]);
    expect(zipped.files).toEqual({
      [`photos/${second.id}.jpg`]: 'file:///cache/2.jpg',
      [`photos/${kept.id}.jpg`]: 'file:///cache/3.jpg',
    });
  });

  test('carries the settings verbatim: the Season months and the digest time', async () => {
    const db = gardenDb();
    updateSettings(
      db,
      { growingStartMonth: 9, growingEndMonth: 4, digestTime: '07:00' },
      noon(2026, 9, 22),
    );

    const { json } = await exportGarden(db);

    expect(json.settings).toEqual([
      {
        id: '00000000-0000-0000-0000-000000000001',
        growing_start_month: 9,
        growing_end_month: 4,
        digest_time: '07:00',
        created_at: '1970-01-01T00:00:00.000Z',
        updated_at: '2026-09-22T00:00:00.000Z',
        deleted_at: null,
      },
    ]);
  });

  test("snapshots the names of each Species a plant refers to, once, a Deleted plant's too", async () => {
    const db = gardenDb();
    const store = photoStore();
    createPlant(db, { speciesId: MONSTERA, nickname: 'Monty' });
    createPlant(db, { speciesId: MONSTERA });
    createPlant(db, { nickname: 'Fern', schedule: { ...NO_SCHEDULE, wateringGrowingDays: 4 } });
    deletePlant(db, store.files, createPlant(db, { speciesId: POTHOS }).id);

    const { json } = await exportGarden(db, store.files);

    expect(json.species_refs).toEqual([
      { id: 'Q161077', colloquial_name: 'Monstera', scientific_name: 'Monstera deliciosa' },
      { id: 'Q161809', colloquial_name: 'Pothos', scientific_name: 'Epipremnum aureum' },
    ]);
  });

  test('never carries the Species catalog, nor the pending notifications', async () => {
    const db = gardenDb();
    createPlant(db, { speciesId: MONSTERA });

    const { json } = await exportGarden(db);

    expect(Object.keys(json)).toEqual([
      'schema_version',
      'exported_at',
      'app_version',
      'plants',
      'care_events',
      'photos',
      'settings',
      'species_refs',
    ]);
    // Pothos is in the catalog, but no plant refers to it.
    expect(json.species_refs).toMatchObject([{ id: MONSTERA }]);
  });

  test('fails and shares nothing when a live photo is missing from the folder', async () => {
    const db = gardenDb();
    const store = photoStore();
    const monty = createPlant(db, { speciesId: MONSTERA });
    const photo = setPlantPhoto(db, store.files, monty.id, 'file:///cache/1.jpg');
    store.files.remove(photo.filename);
    const shared: string[] = [];
    const sheet = { share: async (name: string) => void shared.push(name) };

    // An Export without the file would be refused by Import (ADR-0002).
    await expect(shareExport(db, store.files, sheet, '1.2.3', NOW)).rejects.toThrow(photo.filename);

    expect(shared).toEqual([]);
  });
});
