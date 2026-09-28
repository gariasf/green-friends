import { renderToStaticMarkup } from 'react-dom/server';
import initSqlJs from 'sql.js';
import { afterEach, expect, test, vi } from 'vitest';

import species from '../../assets/species.json';
import { logCareEvent } from '../../src/core/careLog';
import { buildExport } from '../../src/core/export';
import { NO_SCHEDULE, createPlant } from '../../src/core/plants';
import { updateSettings, type SettingsPatch } from '../../src/core/settings';
import { seedSpecies, type SpeciesDataset } from '../../src/core/species';
import { openTestDb } from '../../src/test/db';
import { MONSTERA, noon } from '../../src/test/garden';
import { photoStore } from '../../src/test/photos';
import { openGarden } from './garden';
import type { PlantView } from './guide';
import { PlantDetail } from './screens';

/** A Snapshot's Garden: a Monstera watered once, a plant without a Species, one of unknown toxicity. */
async function snapshotGarden(settings: SettingsPatch = {}) {
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
  updateSettings(db, settings, noon(2026, 9, 22));
  const zip = buildExport(db, photoStore().files, '1.2.3', noon(2026, 9, 22));
  const garden = openGarden(await initSqlJs(), zip);
  const render = (id: string, view: PlantView = { page: 'plant' }) =>
    renderToStaticMarkup(
      <PlantDetail garden={garden} id={id} view={view} photoUrl={() => undefined} />,
    );
  return { render, monty: monty.id, fern: fern.id, other: other.id };
}

/** Today, in the browser, is `day`. */
function todayIs(day: Date) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(day);
}

afterEach(() => vi.useRealTimers());

test("a Monstera's page carries its Care Guide, both Seasons side by side with its advice only", async () => {
  todayIs(noon(2026, 9, 28));
  const { render, monty } = await snapshotGarden();

  const page = render(monty);
  expect(page).toMatch(
    /<th scope="col" class="now"><strong>Growing<\/strong><span class="quiet">Mar – Oct<\/span><span class="now-pill">Now<\/span><\/th><th scope="col"><strong>Dormant<\/strong><span class="quiet">Nov – Feb<\/span><\/th>/,
  );
  expect(page).toMatch(/<th scope="row">(?:(?!<\/th>).)*Fertilize<\/th>/);
  expect(page).not.toContain('Feed</th>');
  // The intervals are the Care card's alone: this Season's, never the Dormant one's.
  expect(page).toContain('Every 7\u00a0days');
  expect(page).not.toContain('Every 14\u00a0days');
  expect(page).not.toContain('aria-pressed');
  expect(page).toContain('Tropical aroid');
  expect(page).toContain('Morning sun');
  expect(page).toContain('N-P-K roughly 3-1-2');
  expect(page).toContain('nitrogen, phosphorus and potassium');
  expect(page).toContain('More on Wikipedia');
  expect(page).toContain('id="care-guide"');
  expect(page).toContain(`href="#/plant/${monty}/symptoms"`);
  // The Care card: the interval in today's Season, and whose schedule.
  expect(page).toContain('Every 24\u00a0months');
  expect(page).toContain('Species schedule');
});

test("in December the Dormant column is Now's", async () => {
  todayIs(noon(2026, 12, 15));
  const { render, monty } = await snapshotGarden();

  expect(render(monty)).toMatch(
    /<th scope="col"><strong>Growing<\/strong>[^]*?<th scope="col" class="now"><strong>Dormant<\/strong><span class="quiet">Nov – Feb<\/span><span class="now-pill">Now/,
  );
});

test('a garden Growing all year has no Dormant column, and nothing to mark Now', async () => {
  const { render, monty } = await snapshotGarden({ growingStartMonth: 1, growingEndMonth: 12 });

  const page = render(monty);
  expect(page).toContain('<strong>Growing</strong><span class="quiet">all year</span></th>');
  expect(page).not.toContain('Dormant</strong>');
  expect(page).not.toContain('now-pill');
});

test('a Symptom lists its causes with the watering fact, and nothing to log', async () => {
  const { render, monty } = await snapshotGarden();

  expect(render(monty, { page: 'symptoms' })).toContain('Leaves and stems');
  const symptom = render(monty, { page: 'symptom', symptomId: 'brown-tips' });
  expect(symptom).toContain('tropical aroid');
  expect(symptom).toMatch(/Last watered [^<]+ ago\. Schedule: every 7\u00a0days/);
  expect(symptom).toContain(
    '<th scope="col">Cause</th><th scope="col">How to tell</th><th scope="col">What to do</th>',
  );
  expect(symptom).not.toContain('Log it as a Note');
});

test('a plant without a Species gets the nudge and the Symptoms; unknown toxicity, no badge', async () => {
  const { render, fern, other } = await snapshotGarden();

  const pane = render(fern);
  expect(pane).toContain('No Care Guide yet');
  expect(pane).toContain('Something wrong?');
  expect(render(other)).not.toMatch(/toxic to pets/i);
});
