import bundled from '../../assets/species.json';
import { openTestDb } from '../test/db';
import { createPlant, getPlant, updatePlant } from './plants';
import { getSettings, updateSettings } from './settings';
import {
  getSpecies,
  getSpeciesDatasetVersion,
  listSpecies,
  searchSpecies,
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

describe('searching the catalog', () => {
  const colloquialNames = (found: Species[]) => found.map((s) => s.colloquialName);
  /** A catalog of Pothos-like Species under these names, `[colloquial, scientific]`. */
  const catalogOf = (...names: [string, string][]) => {
    const db = openTestDb();
    seedSpecies(db, {
      version: 1,
      species: names.map(([colloquialName, scientificName], index) => ({
        ...pothos,
        id: `Q${index + 1}`,
        colloquialName,
        scientificName,
      })),
    });
    return db;
  };

  test('names starting with the search come first, then names with a word starting with it, then scientific names with one, then names containing it anywhere', () => {
    const db = catalogOf(
      ['Lemon tree', 'Citrus × limon'],
      ['Mini monstera', 'Rhaphidophora tetrasperma'],
      ['Money tree', 'Pachira aquatica'],
      ['Mother of thousands', 'Kalanchoe daigremontiana'],
      ['Swiss cheese plant', 'Monstera deliciosa'],
    );

    expect(colloquialNames(searchSpecies(db, 'mon'))).toEqual([
      'Money tree',
      'Mini monstera',
      'Swiss cheese plant',
      'Lemon tree',
      'Mother of thousands',
    ]);
  });

  test('within each, shorter names come first, and names of one length alphabetically', () => {
    const db = catalogOf(
      ['Monstera standleyana', 'Monstera standleyana'],
      ['Monkey tail', 'Cleistocactus colademononis'],
      ['Money plant', 'Epipremnum aureum'],
      ['Money tree', 'Pachira aquatica'],
      ['Monstera', 'Monstera deliciosa'],
    );

    expect(colloquialNames(searchSpecies(db, 'mon'))).toEqual([
      'Monstera',
      'Money tree',
      'Money plant',
      'Monkey tail',
      'Monstera standleyana',
    ]);
  });

  test('every match is found, not only the first 8', () => {
    const ferns = Array.from({ length: 10 }, (_, index): [string, string] => [
      `Fern ${index}`,
      `Filix ${index}`,
    ]);

    expect(searchSpecies(catalogOf(...ferns), 'fern')).toHaveLength(10);
  });

  test('a search ignores case and the spaces around it; a blank one finds nothing', () => {
    const db = catalogOf(['Money tree', 'Pachira aquatica'], ['Pothos', 'Epipremnum aureum']);

    expect(colloquialNames(searchSpecies(db, '  MONEY '))).toEqual(['Money tree']);
    expect(searchSpecies(db, '   ')).toEqual([]);
  });

  test('hyphens and × part words as spaces do, and apostrophes are left out', () => {
    const db = catalogOf(
      ["Bird's nest fern", 'Asplenium nidus'],
      ['Calamondin', 'Citrus ×microcarpa'],
      ['Fiddle-leaf fig', 'Ficus lyrata'],
      ['Heartleaf fern', 'Hemionitis arifolia'],
      ['Lemon tree', 'Citrus × limon'],
    );
    const search = (query: string) => colloquialNames(searchSpecies(db, query));

    expect(search('leaf')).toEqual(['Fiddle-leaf fig', 'Heartleaf fern']);
    expect(search('fiddle leaf')).toEqual(['Fiddle-leaf fig']);
    expect(search('citrus microcarpa')).toEqual(['Calamondin']);
    expect(search('citrus limon')).toEqual(['Lemon tree']);
    expect(search('birds nest')).toEqual(["Bird's nest fern"]);
    // iOS's keyboard types a curly apostrophe.
    expect(search('bird\u2019s nest')).toEqual(["Bird's nest fern"]);
  });

  test('"mon" finds Monstera first, and Calamondin only after every name with a word starting "mon"', () => {
    const db = openTestDb();
    seedSpecies(db, bundled);

    const found = colloquialNames(searchSpecies(db, 'mon'));

    expect(found[0]).toBe('Monstera');
    expect(found.indexOf('Calamondin')).toBeGreaterThan(found.indexOf('Mini monstera'));
    expect(found.indexOf('Calamondin')).toBeGreaterThan(found.indexOf('Chinese money plant'));
  });
});
