import bundled from '../../assets/species.json';
import { openTestDb } from '../test/db';
import { getSettings, updateSettings } from './settings';
import { getSpeciesDatasetVersion, listSpecies, seedSpecies, type Species } from './species';

const monstera = (wateringGrowingDays: number): Species => ({
  id: 'Q161077',
  scientificName: 'Monstera deliciosa',
  colloquialName: 'Monstera',
  wateringGrowingDays,
  wateringDormantDays: 14,
  fertilizingGrowingDays: 30,
  fertilizingDormantDays: null,
  repottingMonths: 24,
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
};

describe('species catalog', () => {
  test('first launch seeds the bundled starter set into the empty catalog', () => {
    const db = openTestDb();
    expect(listSpecies(db)).toEqual([]);

    expect(seedSpecies(db, bundled)).toBe(true);

    const catalog = listSpecies(db);
    // Ticket #10 scopes the starter set to roughly the top 50 houseplants; #20 grows it to ~300.
    expect(catalog.length).toBeGreaterThanOrEqual(50);
    expect(catalog).toContainEqual(monstera(7));
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

    expect(seedSpecies(db, { version: 2, species: [monstera(9), pothos] })).toBe(true);

    expect(listSpecies(db)).toEqual([monstera(9), pothos]);
    expect(getSpeciesDatasetVersion(db)).toBe(2);
    expect(getSettings(db)).toEqual(settings);
  });

  test('an older dataset never replaces a newer catalog', () => {
    const db = openTestDb();
    seedSpecies(db, { version: 2, species: [monstera(9), pothos] });

    expect(seedSpecies(db, { version: 1, species: [monstera(7)] })).toBe(false);

    expect(listSpecies(db)).toEqual([monstera(9), pothos]);
    expect(getSpeciesDatasetVersion(db)).toBe(2);
  });
});
