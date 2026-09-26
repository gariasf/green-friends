import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import initSqlJs from 'sql.js';
import { expect, test } from 'vitest';

import species from '../../assets/species.json';
import { listNeedsAttention } from '../../src/core/care';
import { logCareEvent } from '../../src/core/careLog';
import { shiftDays } from '../../src/core/dates';
import { buildExport } from '../../src/core/export';
import { NewerExportError } from '../../src/core/import';
import { setPlantPhoto } from '../../src/core/photos';
import { NO_SCHEDULE, createPlant, listPlants } from '../../src/core/plants';
import { updateSettings } from '../../src/core/settings';
import { seedSpecies, type SpeciesDataset } from '../../src/core/species';
import { openTestDb } from '../../src/test/db';
import { MONSTERA, noon } from '../../src/test/garden';
import { photoStore } from '../../src/test/photos';
import { openGarden } from './garden';

/** A phone's Garden, with the bundled catalog the Web view seeds, and its Export. */
function phoneExport() {
  const db = openTestDb();
  seedSpecies(db, species as SpeciesDataset);
  const { files } = photoStore();
  const monty = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 20));
  createPlant(db, { speciesId: MONSTERA, nickname: 'Big Monty' }, noon(2026, 9, 20));
  createPlant(
    db,
    { nickname: 'Fern', schedule: { ...NO_SCHEDULE, wateringGrowingDays: 3 } },
    noon(2026, 9, 21),
  );
  setPlantPhoto(db, files, monty.id, 'file:///cache/monty.jpg', noon(2026, 9, 21));
  logCareEvent(
    db,
    { plantId: monty.id, type: 'water', occurredOn: '2026-09-21' },
    noon(2026, 9, 21),
  );
  // A season of the owner's own, which the Export carries and Needs Attention follows.
  updateSettings(db, { growingEndMonth: 9 }, noon(2026, 9, 21));
  return { db, plants: listPlants(db), zip: buildExport(db, files, '1.2.3', noon(2026, 9, 22)) };
}

test("an Export opened through sql.js lists the phone's plants, with their photos", async () => {
  const phone = phoneExport();

  const garden = openGarden(await initSqlJs(), phone.zip);

  expect(listPlants(garden.db)).toEqual(phone.plants);
  const [photo] = phone.plants.flatMap((plant) => plant.photo ?? []);
  expect(new TextDecoder().decode(garden.photo(photo))).toBe('file:///cache/monty.jpg');
});

test("the Web view's Today is the phone's, day after day", async () => {
  const phone = phoneExport();

  const garden = openGarden(await initSqlJs(), phone.zip);

  const days = Array.from({ length: 60 }, (_, index) => shiftDays('2026-09-22', index));
  expect(days.some((day) => listNeedsAttention(phone.db, day).length > 0)).toBe(true);
  for (const day of days) {
    expect(listNeedsAttention(garden.db, day)).toEqual(listNeedsAttention(phone.db, day));
  }
});

test('an Export from a newer Green Friends is refused as one', async () => {
  const { zip } = phoneExport();
  const archive = unzipSync(zip);
  const json = JSON.parse(strFromU8(archive['export.json']));
  archive['export.json'] = strToU8(JSON.stringify({ ...json, schema_version: 999 }));

  const SQL = await initSqlJs();

  expect(() => openGarden(SQL, zipSync(archive))).toThrow(NewerExportError);
});
