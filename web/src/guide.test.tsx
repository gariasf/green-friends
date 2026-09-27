import { renderToStaticMarkup } from 'react-dom/server';
import initSqlJs from 'sql.js';
import { expect, test } from 'vitest';

import species from '../../assets/species.json';
import { logCareEvent } from '../../src/core/careLog';
import { buildExport } from '../../src/core/export';
import { NO_SCHEDULE, createPlant } from '../../src/core/plants';
import { seedSpecies, type SpeciesDataset } from '../../src/core/species';
import { openTestDb } from '../../src/test/db';
import { MONSTERA, noon } from '../../src/test/garden';
import { photoStore } from '../../src/test/photos';
import { openGarden } from './garden';
import type { PlantView } from './guide';
import { PlantDetail } from './screens';

/** A Snapshot's Garden: a Monstera watered once, a plant without a Species, one of unknown toxicity. */
async function snapshotGarden() {
  const db = openTestDb();
  seedSpecies(db, species as SpeciesDataset);
  const monty = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 20));
  logCareEvent(db, { plantId: monty.id, type: 'water', occurredOn: '2026-09-21' });
  const fern = createPlant(
    db,
    { nickname: 'Fern', schedule: { ...NO_SCHEDULE, wateringGrowingDays: 3 } },
    noon(2026, 9, 20),
  );
  const unknown = species.species.find((entry) => entry.toxicToPets === null)!;
  const other = createPlant(db, { speciesId: unknown.id }, noon(2026, 9, 20));
  const zip = buildExport(db, photoStore().files, '1.2.3', noon(2026, 9, 22));
  const garden = openGarden(await initSqlJs(), zip);
  const render = (id: string, view: PlantView = { page: 'plant' }) =>
    renderToStaticMarkup(
      <PlantDetail garden={garden} id={id} view={view} photoUrl={() => undefined} />,
    );
  return { render, monty: monty.id, fern: fern.id, other: other.id };
}

test("a Monstera's Care group opens its Care Guide, with its light step and direct sun", async () => {
  const { render, monty } = await snapshotGarden();

  const pane = render(monty);
  expect(pane).toContain('Bright indirect light');
  expect(pane).toContain(`href="#/plant/${monty}/guide"`);
  expect(pane).toContain(`href="#/plant/${monty}/symptoms"`);

  const guide = render(monty, { page: 'guide' });
  expect(guide).toContain('Tropical aroid');
  expect(guide).toContain('Morning sun');
  expect(guide).toContain('N-P-K roughly 3-1-2');
  expect(guide).toContain('nitrogen, phosphorus and potassium');
  expect(guide).toContain('Your schedule: every 7 days, every 14 days in the Dormant season');
  expect(guide).toContain('More on Wikipedia');
});

test('a Symptom lists its causes with the watering fact, and nothing to log', async () => {
  const { render, monty } = await snapshotGarden();

  expect(render(monty, { page: 'symptoms' })).toContain('Leaves and stems');
  const symptom = render(monty, { page: 'symptom', symptomId: 'brown-tips' });
  expect(symptom).toContain('tropical aroid');
  expect(symptom).toMatch(/Last watered [^<]+ ago\. Schedule: every 7 days/);
  expect(symptom).toContain('How to tell');
  expect(symptom).not.toContain('Log it as a Note');
});

test('a plant without a Species gets the nudge and the Symptoms; unknown toxicity, no badge', async () => {
  const { render, fern, other } = await snapshotGarden();

  const pane = render(fern);
  expect(pane).toContain('No Care Guide yet');
  expect(pane).toContain('Something wrong?');
  expect(render(other)).not.toMatch(/toxic to pets/i);
});
