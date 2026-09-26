import index from '../../assets/species-index.json';
import {
  LIKELY_SCORE,
  MAYBE_SCORE,
  suggestSpecies,
  type IdentifyCandidate,
  type SpeciesIndex,
} from './identify';

const MONSTERA = 'Q161077';
const KALANCHOE_DELAGOENSIS = 'Q137831';
const ARISTALOE_ARISTATA = 'Q39719918';
const PEACE_LILY = 'Q761494';
const PHALAENOPSIS = 'Q133897';

const candidate = (name: string, score: number, gbif: number | null = null): IdentifyCandidate => ({
  name,
  genus: name.split(' ')[0],
  gbif,
  score,
});

const suggest = (...candidates: IdentifyCandidate[]) =>
  suggestSpecies(candidates, index as SpeciesIndex);

describe('suggestSpecies over the bundled name index', () => {
  it('matches by GBIF key before the name', () => {
    // Monstera deliciosa's GBIF key, under a name outside the catalog.
    expect(suggest(candidate('Quercus robur', 0.64, 2868241))).toEqual([
      { speciesId: MONSTERA, confidence: 'likely' },
    ]);
  });

  it('matches a GBIF synonym by name', () => {
    expect(suggest(candidate('Bryophyllum delagoense', 0.5))).toEqual([
      { speciesId: KALANCHOE_DELAGOENSIS, confidence: 'likely' },
    ]);
    expect(suggest(candidate('Aloe aristata', 0.5))).toEqual([
      { speciesId: ARISTALOE_ARISTATA, confidence: 'likely' },
    ]);
  });

  it('matches an alias where the taxonomies disagree', () => {
    expect(suggest(candidate('Spathiphyllum floribundum', 0.5))).toEqual([
      { speciesId: PEACE_LILY, confidence: 'likely' },
    ]);
  });

  it('matches a species of a genus-only Species by its genus', () => {
    expect(suggest(candidate('Phalaenopsis amabilis', 0.5, 999_999_999))).toEqual([
      { speciesId: PHALAENOPSIS, confidence: 'likely' },
    ]);
  });

  it('drops candidates outside the catalog', () => {
    expect(suggest(candidate('Quercus robur', 0.9), candidate('Monstera obliqua', 0.8))).toEqual(
      [],
    );
  });

  it('says likely from 0.3, maybe from 0.05, nothing below', () => {
    expect(suggest(candidate('Monstera deliciosa', LIKELY_SCORE))[0].confidence).toBe('likely');
    expect(suggest(candidate('Monstera deliciosa', 0.29))[0].confidence).toBe('maybe');
    expect(suggest(candidate('Monstera deliciosa', MAYBE_SCORE))[0].confidence).toBe('maybe');
    expect(suggest(candidate('Monstera deliciosa', 0.049))).toEqual([]);
  });

  it('gives at most 3 Suggestions, one per Species, best first', () => {
    const suggestions = suggest(
      candidate('Bryophyllum delagoense', 0.06),
      candidate('Monstera deliciosa', 0.2),
      candidate('Quercus robur', 0.4, 2868241),
      candidate('Spathiphyllum floribundum', 0.1),
      candidate('Phalaenopsis amabilis', 0.08),
    );
    expect(suggestions).toEqual([
      { speciesId: MONSTERA, confidence: 'likely' },
      { speciesId: PEACE_LILY, confidence: 'maybe' },
      { speciesId: PHALAENOPSIS, confidence: 'maybe' },
    ]);
  });
});
