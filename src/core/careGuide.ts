import type { Db } from '../db/types';
import { effectiveSchedule, plantSeasonOn, type SeasonOn } from './care';
import { listCareEvents } from './careLog';
import { getPlant, type CareType, type Plant } from './plants';
import { getSpecies } from './species';

/**
 * Care Guides (ADR-0008, spec #48): how to water, feed, place and pot a plant, from its Species'
 * Care Profile, and the Symptoms with their causes. The text is `assets/care-guides.json`, which
 * the caller passes in (as `suggestSpecies` takes the name index), so core stays independent of
 * the bundle. The words around it (schedule and fact lines) live in `src/ui/words.ts`.
 */

/** The shared light scale every profile is placed on, dimmest first. */
export const CARE_GUIDES_LIGHT = {
  level: ['low', 'medium', 'bright-indirect', 'direct'],
  directSun: ['none', 'morning', 'some', 'all-day'],
} as const;

type Seasonal = { growing: string; dormant: string };

export type CareProfile = {
  id: string;
  name: string;
  watering: Seasonal & { how: string };
  fertilizer: Seasonal & { type: string };
  /**
   * Where it goes. `text` names window directions for the northern hemisphere; a balcony profile
   * reads the same fields as outdoor exposure (direct + all-day is full sun).
   * ponytail: northern hemisphere only; flip south and north from the device's region if it matters.
   */
  light: {
    level: (typeof CARE_GUIDES_LIGHT.level)[number];
    directSun: (typeof CARE_GUIDES_LIGHT.directSun)[number];
    text: string;
  };
  soil: string;
  /** Per Symptom id, this profile's typical causes, which come first. */
  causes: Record<string, string[]>;
};

/** What the Care Log can say beside a cause. */
export type FactKind = 'watering' | 'fertilizing' | 'repotting' | 'season';

export type Cause = { name: string; tell: string; fix: string; fact?: FactKind; petWarning?: true };

export type Symptom = { id: string; name: string; kind: 'plant' | 'pest'; causes: string[] };

export type CareGuides = {
  profiles: CareProfile[];
  causes: Record<string, Cause>;
  symptoms: Symptom[];
  /** Keyed by Species QID. `funFactSource` is a Wikipedia article URL. */
  species: Record<
    string,
    { profile: string; careNotes?: string; funFact: string; funFactSource: string }
  >;
};

/** A seasonal interval in days; a null Dormant one is Paused, a null Growing one no schedule. */
export type SeasonalSchedule = { growing: number | null; dormant: number | null };

export type CareGuide = {
  profile: CareProfile;
  careNotes: string | null;
  funFact: { text: string; source: string };
  season: SeasonOn;
  /** The effective schedule (ADR-0003): the Override where set, else the Species default. */
  schedule: { water: SeasonalSchedule; fertilize: SeasonalSchedule };
};

/** A plant's Care Guide on `today`; null without a Species, or when its Species has no profile. */
export function readCareGuide(
  db: Db,
  plantId: string,
  today: string,
  guides: CareGuides,
): CareGuide | null {
  const plant = getPlant(db, plantId);
  const entry = plant.speciesId ? guides.species[plant.speciesId] : undefined;
  const profile = guides.profiles.find((candidate) => candidate.id === entry?.profile);
  if (!entry || !profile) return null;
  return {
    profile,
    careNotes: entry.careNotes ?? null,
    funFact: { text: entry.funFact, source: entry.funFactSource },
    season: plantSeasonOn(db, plant.speciesId, today),
    schedule: scheduleOf(db, plant),
  };
}

/** A Symptom's causes: the profile's typical ones first, the rest in the Symptom's order. */
export function symptomCauses(symptom: Symptom, profile: CareProfile | null): string[] {
  const first = profile?.causes[symptom.id] ?? [];
  return [...first, ...symptom.causes.filter((cause) => !first.includes(cause))];
}

/** What the Care Log says beside a cause, never claiming it is the cause. */
export type CauseFact =
  | {
      kind: 'watering' | 'fertilizing';
      lastOn: string | null;
      schedule: SeasonalSchedule;
      /** Today's Season, which says whether the Dormant interval applies at all. */
      season: SeasonOn;
    }
  | { kind: 'repotting'; lastOn: string | null; potSizeCm: number | null }
  | { kind: 'season'; season: SeasonOn };

const FACT_TYPE = { watering: 'water', fertilizing: 'fertilize', repotting: 'repot' } as const;

/** The Care Log's fact of `kind` for a plant on `today`, with or without a Species. */
export function causeFact(db: Db, plantId: string, kind: FactKind, today: string): CauseFact {
  const plant = getPlant(db, plantId);
  if (kind === 'season') return { kind, season: plantSeasonOn(db, plant.speciesId, today) };
  const type: CareType = FACT_TYPE[kind];
  // Newest first.
  const lastOn =
    listCareEvents(db, plantId).find((event) => event.type === type)?.occurredOn ?? null;
  if (kind === 'repotting') return { kind, lastOn, potSizeCm: plant.potSizeCm };
  const schedule = scheduleOf(db, plant);
  return {
    kind,
    lastOn,
    schedule: kind === 'watering' ? schedule.water : schedule.fertilize,
    season: plantSeasonOn(db, plant.speciesId, today),
  };
}

function scheduleOf(db: Db, plant: Plant): CareGuide['schedule'] {
  const species = plant.speciesId ? getSpecies(db, plant.speciesId) : null;
  const schedule = effectiveSchedule(plant, species);
  return {
    water: { growing: schedule.wateringGrowingDays, dormant: schedule.wateringDormantDays },
    fertilize: {
      growing: schedule.fertilizingGrowingDays,
      dormant: schedule.fertilizingDormantDays,
    },
  };
}
