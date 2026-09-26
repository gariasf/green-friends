/**
 * Identify (CONTEXT.md, ADR-0007): the relay sends a photo to Pl@ntNet and returns its candidates,
 * which the phone maps to catalog Species through the name index the species build writes. The app
 * implements the relay over fetch (src/ui/useIdentify.ts); suggestSpecies is plain and tested on
 * the real index.
 */

/** One Pl@ntNet candidate, as the relay's `POST /identify` returns them (docs/agents/relay.md). */
export type IdentifyCandidate = {
  /** Scientific name without author. */
  name: string;
  genus: string;
  /** GBIF taxon key, or null when Pl@ntNet has none. */
  gbif: number | null;
  score: number;
};

/** The relay's Identify route, injected so the core stays plain TypeScript. */
export type IdentifyRelay = {
  /** Pl@ntNet's candidates for a JPEG, best first; [] for a photo that isn't a plant. */
  identify(jpeg: Uint8Array): Promise<IdentifyCandidate[]>;
};

/** assets/species-index.json: folded names and GBIF keys → the Species ID they belong to. */
export type SpeciesIndex = { names: Record<string, string>; gbif: Record<string, string> };

export type Confidence = 'likely' | 'maybe';

export type Suggestion = { speciesId: string; confidence: Confidence };

// ponytail: thresholds from 131 test photos (ADR-0007); tune them after real use.
/** Below this score a candidate is no Suggestion at all. */
export const MAYBE_SCORE = 0.05;
/** From this score a Suggestion is "likely". */
export const LIKELY_SCORE = 0.3;
export const MAX_SUGGESTIONS = 3;

/**
 * Up to three Suggestions from Pl@ntNet's candidates: each candidate matches a Species by its GBIF
 * key, else its name, else its genus (for genus-only Species such as Phalaenopsis). Candidates
 * outside the catalog or below MAYBE_SCORE are dropped, and a Species keeps its best-scoring hit.
 */
export function suggestSpecies(candidates: IdentifyCandidate[], index: SpeciesIndex): Suggestion[] {
  const suggestions = new Map<string, Suggestion & { score: number }>();
  for (const c of candidates) {
    if (c.score < MAYBE_SCORE) continue;
    const speciesId =
      (c.gbif !== null ? index.gbif[String(c.gbif)] : undefined) ??
      index.names[foldName(c.name)] ??
      index.names[foldName(c.genus)];
    const known = speciesId ? suggestions.get(speciesId) : undefined;
    if (!speciesId || (known && known.score >= c.score)) continue;
    suggestions.set(speciesId, {
      speciesId,
      confidence: c.score >= LIKELY_SCORE ? 'likely' : 'maybe',
      score: c.score,
    });
  }
  return [...suggestions.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ speciesId, confidence }) => ({ speciesId, confidence }));
}

/** A name as the index keys it; keep in step with `foldName` in scripts/species/build.ts. */
function foldName(name: string): string {
  return name.toLowerCase().replace(/×/g, ' ').replace(/\s+/g, ' ').trim();
}
