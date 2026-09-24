import bundled from '../../assets/species.json';
import { openTestDb } from '../test/db';
import { createPlant, getPlant, updatePlant } from './plants';
import { getSettings, updateSettings } from './settings';
import {
  getSpecies,
  getSpeciesDatasetVersion,
  listSpecies,
  seedSpecies,
  type Species,
} from './species';

const monstera = (wateringGrowingDays: number): Species => ({
  id: 'Q161077',
  scientificName: 'Monstera deliciosa',
  colloquialName: 'Monstera',
  wateringGrowingDays,
  wateringDormantDays: 14,
  fertilizingGrowingDays: 30,
  fertilizingDormantDays: null,
  repottingMonths: 24,
  toxicToPets: true,
});

const pothos: Species = {
  id: 'Q161809',
  scientificName: 'Epipremnum aureum',
  colloquialName: 'Pothos',
  wateringGrowingDays: 7,
  wateringDormantDays: 14,
  fertilizingGrowingDays: 30,
  fertilizingDormantDays: null,
  repottingMonths: 24,
  toxicToPets: true,
};

describe('species catalog', () => {
  test('first launch seeds the bundled catalog into the empty one', () => {
    const db = openTestDb();
    expect(listSpecies(db)).toEqual([]);

    expect(seedSpecies(db, bundled)).toBe(true);

    const catalog = listSpecies(db);
    // Ticket #20 grows the catalog to roughly 300 common houseplants.
    expect(catalog.length).toBeGreaterThanOrEqual(290);
    expect(catalog).toContainEqual(monstera(7));
    // Pet toxicity is curated by hand for every Species.
    expect(catalog.filter((s) => s.toxicToPets === null)).toEqual([]);
    expect(getSpeciesDatasetVersion(db)).toBe(bundled.version);
  });

  test('a dataset at the seeded version is ignored, whatever its content', () => {
    const db = openTestDb();
    seedSpecies(db, { version: 1, species: [monstera(7)] });

    expect(seedSpecies(db, { version: 1, species: [monstera(9), pothos] })).toBe(false);

    expect(listSpecies(db)).toEqual([monstera(7)]);
  });

  test('an app update with a newer dataset reseeds the catalog and leaves user data alone', () => {
    const db = openTestDb();
    seedSpecies(db, { version: 1, species: [monstera(7)] });
    const settings = updateSettings(db, { growingStartMonth: 4 });
    const plant = createPlant(db, { speciesId: monstera(7).id });
    const other = createPlant(db, { speciesId: monstera(7).id });
    const overridden = updatePlant(db, other.id, { wateringGrowingDays: 3 });

    expect(seedSpecies(db, { version: 2, species: [monstera(9), pothos] })).toBe(true);

    expect(listSpecies(db)).toEqual([monstera(9), pothos]);
    expect(getSpeciesDatasetVersion(db)).toBe(2);
    expect(getSettings(db)).toEqual(settings);
    expect(getPlant(db, plant.id)).toEqual(plant);
    expect(getPlant(db, overridden.id)).toEqual(overridden);
  });

  test('an older dataset never replaces a newer catalog', () => {
    const db = openTestDb();
    seedSpecies(db, { version: 2, species: [monstera(9), pothos] });

    expect(seedSpecies(db, { version: 1, species: [monstera(7)] })).toBe(false);

    expect(listSpecies(db)).toEqual([monstera(9), pothos]);
    expect(getSpeciesDatasetVersion(db)).toBe(2);
  });

  test('a Species is found by its ID; one the catalog does not know is null', () => {
    const db = openTestDb();
    seedSpecies(db, { version: 1, species: [monstera(7), pothos] });

    expect(getSpecies(db, pothos.id)).toEqual(pothos);
    expect(getSpecies(db, 'Q1')).toBeNull();
  });
});
