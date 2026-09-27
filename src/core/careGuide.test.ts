import bundled from '../../assets/care-guides.json';
import catalogFile from '../../assets/species.json';
import { MONSTERA, POTHOS, gardenDb, noon } from '../test/garden';
import {
  CARE_GUIDES_LIGHT,
  causeFact,
  readCareGuide,
  symptomCauses,
  type CareGuides,
} from './careGuide';
import { logCareEvent } from './careLog';
import { createPlant, updatePlant } from './plants';
import { updateSettings } from './settings';

// The rules below check what the cast takes on trust.
const guides = bundled as unknown as CareGuides;

describe('the bundled care-guides.json (ADR-0008)', () => {
  const causeIds = new Set(Object.keys(guides.causes));
  const symptoms = new Map(guides.symptoms.map((symptom) => [symptom.id, symptom]));
  const profileIds = new Set(guides.profiles.map((profile) => profile.id));

  test('every reference resolves, and a profile only reorders a Symptom’s causes', () => {
    for (const symptom of guides.symptoms) {
      expect(symptom.causes.filter((id) => !causeIds.has(id))).toEqual([]);
    }
    for (const profile of guides.profiles) {
      for (const [symptomId, causes] of Object.entries(profile.causes)) {
        expect(symptoms.has(symptomId)).toBe(true);
        expect(causes.filter((id) => !symptoms.get(symptomId)?.causes.includes(id))).toEqual([]);
      }
    }
    for (const entry of Object.values(guides.species)) {
      expect(profileIds).toContain(entry.profile);
    }
  });

  test('no profile or care notes state days, weeks or months: the Care Schedule says how often', () => {
    const interval = /\b(day|week|month|year|daily|weekly|monthly)s?\b/i;
    const texts = [
      ...guides.profiles.flatMap(({ name, watering, fertilizer, light, soil }) => [
        name,
        ...Object.values(watering),
        ...Object.values(fertilizer),
        light.text,
        soil,
      ]),
      ...Object.values(guides.species).map((entry) => entry.careNotes ?? ''),
    ];
    expect(texts.filter((text) => interval.test(text))).toEqual([]);
  });

  test('every fertiliser names its N-P-K, which the Fertiliser card explains', () => {
    const types = guides.profiles.map(({ fertilizer }) => fertilizer.type);
    const named = (type: string) =>
      /\(N-P-K roughly \d-\d-\d/.test(type) || type === 'No fertiliser';
    expect(types.filter((type) => !named(type))).toEqual([]);
  });

  test('every Fun fact links to its Wikipedia article', () => {
    for (const entry of Object.values(guides.species)) {
      expect(entry.funFactSource).toMatch(/^https:\/\/en\.wikipedia\.org\/wiki\/\S+$/);
      expect(entry.funFact.trim()).not.toBe('');
    }
  });

  test('every QID is in the Species catalog', () => {
    const catalog = new Set(catalogFile.species.map((species) => species.id));
    expect(Object.keys(guides.species).filter((qid) => !catalog.has(qid))).toEqual([]);
  });

  test('every profile’s light is on the shared scale', () => {
    for (const { light } of guides.profiles) {
      expect(CARE_GUIDES_LIGHT.level).toContain(light.level);
      expect(CARE_GUIDES_LIGHT.directSun).toContain(light.directSun);
      expect(light.text.trim()).not.toBe('');
    }
  });

  test('every catalog Species has a profile', () => {
    const missing = catalogFile.species.filter((species) => !(species.id in guides.species));
    expect(missing.map((species) => species.id)).toEqual([]);
  });
});

describe('readCareGuide', () => {
  test('the Species’ profile, care notes and Fun fact, with its default schedule', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 1));

    const guide = readCareGuide(db, plant.id, '2026-09-22', guides);

    expect(guide).toMatchObject({
      profile: { id: 'tropical-aroid', name: 'Tropical aroid' },
      careNotes: expect.stringContaining('moss pole'),
      funFact: {
        text: expect.stringContaining('Deliciosa'),
        source: 'https://en.wikipedia.org/wiki/Monstera_deliciosa',
      },
      schedule: {
        water: { growing: 7, dormant: 14 },
        fertilize: { growing: 30, dormant: null },
      },
    });
  });

  test('an Override replaces the Species default, care type by care type', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 1));
    updatePlant(db, plant.id, { wateringGrowingDays: 5, wateringDormantDays: null });

    expect(readCareGuide(db, plant.id, '2026-09-22', guides)?.schedule).toEqual({
      water: { growing: 5, dormant: null },
      fertilize: { growing: 30, dormant: null },
    });
  });

  test('null without a Species, or for a Species with no profile yet', () => {
    const db = gardenDb();
    const nameless = createPlant(db, {
      nickname: 'Mystery',
      schedule: {
        wateringGrowingDays: 7,
        wateringDormantDays: null,
        fertilizingGrowingDays: null,
        fertilizingDormantDays: null,
        repottingMonths: null,
      },
    });
    const pothos = createPlant(db, { speciesId: POTHOS });
    const noProfile: CareGuides = { ...guides, species: {} };

    expect(readCareGuide(db, nameless.id, '2026-09-22', guides)).toBeNull();
    expect(readCareGuide(db, pothos.id, '2026-09-22', noProfile)).toBeNull();
  });

  test('the Season follows the growing-month settings', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 1));

    updateSettings(db, { growingStartMonth: 3, growingEndMonth: 10 });
    expect(readCareGuide(db, plant.id, '2026-09-22', guides)?.season).toEqual({
      season: 'growing',
      startsOn: '2026-03-01',
    });

    updateSettings(db, { growingStartMonth: 3, growingEndMonth: 8 });
    expect(readCareGuide(db, plant.id, '2026-09-22', guides)?.season).toEqual({
      season: 'dormant',
      startsOn: '2026-09-01',
      resumesOn: '2027-03-01',
    });
  });
});

describe('symptomCauses', () => {
  const drooping = guides.symptoms.find((symptom) => symptom.id === 'drooping')!;
  const profile = (id: string) => guides.profiles.find((candidate) => candidate.id === id)!;

  test('the profile’s typical causes first, the rest in the Symptom’s order', () => {
    expect(drooping.causes).toEqual(['underwatering', 'overwatering', 'root-rot', 'cold']);
    expect(symptomCauses(drooping, profile('succulent'))).toEqual([
      'overwatering',
      'underwatering',
      'root-rot',
      'cold',
    ]);
    expect(symptomCauses(drooping, profile('tropical-aroid'))).toEqual([
      'underwatering',
      'root-rot',
      'overwatering',
      'cold',
    ]);
  });

  test('the Symptom’s own order without a profile', () => {
    expect(symptomCauses(drooping, null)).toEqual(drooping.causes);
  });
});

describe('causeFact', () => {
  test('watering and fertilizing: when last logged, and the effective schedule', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 1));
    logCareEvent(db, { plantId: plant.id, type: 'water', occurredOn: '2026-09-16' });

    expect(causeFact(db, plant.id, 'watering', '2026-09-22')).toEqual({
      kind: 'watering',
      lastOn: '2026-09-16',
      schedule: { growing: 7, dormant: 14 },
    });
    expect(causeFact(db, plant.id, 'fertilizing', '2026-09-22')).toEqual({
      kind: 'fertilizing',
      lastOn: null,
      schedule: { growing: 30, dormant: null },
    });
  });

  test('repotting: when last repotted, and the Current Pot', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 1));
    expect(causeFact(db, plant.id, 'repotting', '2026-09-22')).toEqual({
      kind: 'repotting',
      lastOn: null,
      potSizeCm: null,
    });

    logCareEvent(db, { plantId: plant.id, type: 'repot', occurredOn: '2026-09-10', potSizeCm: 17 });
    expect(causeFact(db, plant.id, 'repotting', '2026-09-22')).toEqual({
      kind: 'repotting',
      lastOn: '2026-09-10',
      potSizeCm: 17,
    });
  });

  test('season: today’s Season, and when Growing resumes', () => {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA }, noon(2026, 9, 1));
    updateSettings(db, { growingStartMonth: 3, growingEndMonth: 8 });

    expect(causeFact(db, plant.id, 'season', '2026-09-22')).toEqual({
      kind: 'season',
      season: { season: 'dormant', startsOn: '2026-09-01', resumesOn: '2027-03-01' },
    });
  });
});
