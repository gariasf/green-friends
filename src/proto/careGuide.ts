import { seasonOn } from '@/src/core/care';
import { listCareEvents } from '@/src/core/careLog';
import { getPlant, hasOverride, type CareType } from '@/src/core/plants';
import { getSettings } from '@/src/core/settings';
import { getSpecies } from '@/src/core/species';
import { db } from '@/src/db/client';
import { daysBetween } from '@/src/core/dates';
import { dateLabel, plural } from '@/src/ui/words';

import draft from './care-guide-draft.json';

/**
 * PROTOTYPE (Care Guide): a plant's Care Guide from the draft content, for the variants to show.
 * Never merged; the real reads come with the spec.
 */

export type Season = 'growing' | 'dormant';
type Seasonal = { growing: string; dormant: string };
export type Profile = {
  id: string;
  name: string;
  watering: Seasonal & { how: string };
  fertilizer: Seasonal & { type: string };
  light: string;
  soil: string;
  causes: Record<string, string[]>;
};
export type Cause = {
  name: string;
  tell: string;
  fix: string;
  fact?: 'watering' | 'fertilizing' | 'repotting' | 'season';
  petWarning?: boolean;
};
export type Symptom = { id: string; name: string; causes: string[] };

const profiles = draft.profiles as unknown as Profile[];
export const CAUSES = draft.causes as Record<string, Cause>;
export const SYMPTOMS = draft.symptoms as Symptom[];
const SPECIES = draft.species as Record<
  string,
  { profile: string; careNotes?: string; funFact: string; funFactSource: string }
>;

export type Guide = NonNullable<ReturnType<typeof readGuide>>;

/** The plant's Guide, or a Guide with no profile for a plant whose Species has none (or no Species). */
export function readGuide(plantId: string, today: string) {
  const row = getPlant(db, plantId);
  const species = row.speciesId ? getSpecies(db, row.speciesId) : null;
  const extra = row.speciesId ? SPECIES[row.speciesId] : undefined;
  const profile = profiles.find((candidate) => candidate.id === extra?.profile) ?? null;
  const settings = getSettings(db);
  const season = seasonOn(today, settings);
  const events = listCareEvents(db, plantId);
  const last = (type: CareType) => events.find((event) => event.type === type)?.occurredOn;

  const source = (type: CareType) => (hasOverride(row, type) || !species ? row : species);
  const water = source('water');
  const feed = source('fertilize');

  const seasonalLine = (growing: number | null, dormant: number | null) => {
    if (growing === null) return 'no schedule';
    const dormantPart = dormant === null ? 'paused in Dormant' : `every ${dormant} in Dormant`;
    return `every ${plural(growing, 'day')}, ${dormantPart}`;
  };

  return {
    profile,
    careNotes: extra?.careNotes ?? null,
    funFact: extra ? { text: extra.funFact, source: extra.funFactSource } : null,
    toxic: species?.toxicToPets ?? null,
    season: season.season as Season,
    seasonLine:
      season.season === 'dormant'
        ? `Dormant season, until ${dateLabel(season.resumesOn, today)}`
        : 'Growing season',
    schedule: {
      water: seasonalLine(water.wateringGrowingDays, water.wateringDormantDays),
      fertilize: seasonalLine(feed.fertilizingGrowingDays, feed.fertilizingDormantDays),
    },
    /** What the Care Log says beside a cause, without claiming it's the cause. */
    fact(kind: NonNullable<Cause['fact']>): string {
      if (kind === 'season') return this.seasonLine;
      const type: CareType =
        kind === 'watering' ? 'water' : kind === 'fertilizing' ? 'fertilize' : 'repot';
      const day = last(type);
      const done = { water: 'Last watered', fertilize: 'Last fed', repot: 'Last repotted' }[type];
      const ago = day === undefined ? null : daysBetween(day, today);
      const when =
        ago === null
          ? `${done}: never logged`
          : `${done} ${ago === 0 ? 'today' : ago === 1 ? 'yesterday' : `${ago} days ago`}`;
      if (type === 'repot') {
        return row.potSizeCm ? `${when}, in a ${row.potSizeCm} cm pot` : when;
      }
      return `${when}. Schedule: ${this.schedule[type]}`;
    },
    /** A symptom's causes, the profile's typical ones first. */
    causesOf(symptom: Symptom): string[] {
      const first = profile?.causes[symptom.id] ?? [];
      return [...first, ...symptom.causes.filter((cause) => !first.includes(cause))];
    },
  };
}
