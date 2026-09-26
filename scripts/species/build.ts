/// <reference types="node" />
/**
 * Generates the bundled Species dataset, assets/species.json, from the curated care layer in
 * scripts/species/curated.json. Run with `npm run species:build` (Node 24 runs TypeScript directly).
 *
 * Sources and licensing (ticket #10, research #4, ADR-0004):
 * - Wikidata, CC0 1.0 (https://www.wikidata.org/wiki/Wikidata:Licensing). A Species ID is the
 *   Wikidata item ID (QID) of the taxon and its scientific name is that item's taxon name (P225).
 *   This script fetches the taxon name and checks it against the curated entry, so a wrong QID
 *   cannot ship.
 * - The curated care layer (colloquial names, watering / fertilizing / repotting defaults, pet
 *   toxicity) is hand-written in this repo. No open dataset of pet toxicity is licensed for
 *   commercial use (research #4), so it is curated per species and cross-checked against public
 *   references such as the ASPCA's toxic and non-toxic plant lists; none of them is imported. In
 *   order (#53): a species a reference lists (under any GBIF synonym) takes that value; else its
 *   genus's (a "spp." entry or an entry named for the genus); else toxic when a listed member of
 *   its own genus is, or a relative shares its toxic principle (Datura's tropane alkaloids for
 *   Brugmansia); else non-toxic when two or more members of its genus are listed and all are
 *   non-toxic, or when its former genus is listed non-toxic (Calathea for Goeppertia; a former
 *   genus never makes a species toxic, as "Aloe" synonyms would Haworthia). Anything else is
 *   unknown (null), which the app shows as no pet badge at all.
 * - GBIF Backbone Taxonomy, CC BY 4.0 (GBIF Secretariat, https://doi.org/10.15468/39omei). Only
 *   the name index, assets/species-index.json, draws on it: each Species' GBIF keys, accepted name
 *   and synonyms, so Identify (ADR-0007) can map Pl@ntNet's candidates to the catalog on the phone.
 *   Wikidata's GBIF taxon ID (P14607; P846 is retired) comes first, else GBIF's match on the P225
 *   name. Aliases in curated.json cover names where Pl@ntNet's taxonomy and GBIF's disagree.
 * - No Perenual data: its terms forbid redistribution. Open Plantbook thresholds are not bundled
 *   because nothing in v1 reads them; openplantbook-coverage.ts runs the coverage spot-check.
 *
 * Invariants: QIDs unique and append-only (every ID ever committed in assets/species.json stays,
 * none is reused for another taxon), intervals are positive integers, a Dormant interval needs a
 * Growing one, every species states its pet toxicity (true, false, or null for unknown), and the
 * dataset version goes up whenever the species content changes (the app reseeds on a higher
 * version).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

import type { SpeciesIndex } from '../../src/core/identify';
import type { Species, SpeciesDataset } from '../../src/core/species';

const REPO_ROOT = new URL('../../', import.meta.url);
const CURATED_PATH = new URL('./curated.json', import.meta.url);
const OUTPUT_PATH = new URL('assets/species.json', REPO_ROOT);
const INDEX_PATH = new URL('assets/species-index.json', REPO_ROOT);
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const GBIF_API = 'https://api.gbif.org/v1';
const USER_AGENT = 'green-friends-species-build/1.0 (https://github.com/gariasf/green-friends)';

/** Every Species column and how it is validated; the `satisfies` keeps this exhaustive. */
const FIELD_KINDS = {
  id: 'name',
  scientificName: 'name',
  colloquialName: 'name',
  wateringGrowingDays: 'interval',
  wateringDormantDays: 'interval',
  fertilizingGrowingDays: 'interval',
  fertilizingDormantDays: 'interval',
  repottingMonths: 'interval',
  toxicToPets: 'flag',
} satisfies Record<keyof Species, 'name' | 'interval' | 'flag'>;

const SOURCES = [
  {
    name: 'Wikidata',
    license: 'CC0 1.0',
    url: 'https://www.wikidata.org/',
    usedFor: 'Species IDs (item QIDs) and scientific names (taxon name, P225)',
  },
  {
    name: 'Green Friends curated care layer',
    url: 'https://github.com/gariasf/green-friends/blob/main/scripts/species/curated.json',
    usedFor: 'Colloquial names, care defaults and pet toxicity',
  },
  {
    name: 'GBIF Backbone Taxonomy (GBIF Secretariat)',
    license: 'CC BY 4.0',
    url: 'https://doi.org/10.15468/39omei',
    usedFor: 'Taxon keys, accepted names and synonyms in the name index (species-index.json)',
  },
];

type BundledDataset = SpeciesDataset & { sources: typeof SOURCES };
/** curated.json: the dataset plus Identify's aliases, a Pl@ntNet or GBIF name → QID. */
type Curated = SpeciesDataset & { aliases: Record<string, string> };

async function main(): Promise<void> {
  const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8')) as Curated;
  failOn(validate(curated));

  const taxa = await fetchTaxa(curated.species.map((s) => s.id));
  failOn(
    curated.species.flatMap((s) => {
      const name = taxa.get(s.id)?.name;
      if (name === s.scientificName) return [];
      return [
        `${s.id}: Wikidata taxon name is ${name ?? 'missing'}, curated says ${s.scientificName}`,
      ];
    }),
  );

  const dataset: BundledDataset = {
    version: curated.version,
    sources: SOURCES,
    species: [...curated.species].sort((a, b) =>
      a.scientificName.localeCompare(b.scientificName, 'en'),
    ),
  };
  const shipped = readShipped();
  if (shipped) failOn(checkAgainstShipped(dataset, shipped));

  const index = await buildIndex(dataset.species, taxa, curated.aliases);

  writeFileSync(OUTPUT_PATH, render(dataset));
  writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 1)}\n`);
  console.log(`Wrote ${dataset.species.length} species, dataset version ${dataset.version}`);
  console.log(
    `Wrote the name index: ${Object.keys(index.names).length} names, ${Object.keys(index.gbif).length} GBIF keys`,
  );
}

/**
 * Identify's name index (ADR-0007): every name and GBIF key a Species goes by → its QID. A Species'
 * own names and keys (curated, accepted, its name's match) beat another's synonyms; a name or key
 * two Species claim alike fails the build, naming both QIDs: an alias names the one a name belongs
 * to, and a GBIF key clash has no such way out, since aliases are names.
 */
async function buildIndex(
  species: Species[],
  taxa: Map<string, Taxon>,
  aliases: Record<string, string>,
): Promise<SpeciesIndex> {
  const ids = new Set(species.map((s) => s.id));
  const unknown = Object.entries(aliases).filter(([, id]) => !ids.has(id));
  failOn(unknown.map(([name, id]) => `alias ${name}: ${id} is not in the catalog`));
  const settled = new Map(Object.entries(aliases).map(([name, id]) => [foldName(name), id]));

  // Each key keeps only its strongest claims: 0 for a Species' own, 1 for a synonym.
  type Claims = Map<string, { strength: number; ids: Set<string> }>;
  const claims = { names: new Map() as Claims, gbif: new Map() as Claims };
  const claim = (kind: keyof typeof claims, key: string, id: string, strength: number) => {
    const known = claims[kind].get(key);
    if (known && known.strength < strength) return;
    if (known?.strength === strength) known.ids.add(id);
    else claims[kind].set(key, { strength, ids: new Set([id]) });
  };

  const found = await mapLimit(species, 8, (s) =>
    gbifNames(s.scientificName, taxa.get(s.id)?.gbif),
  );
  species.forEach((s, i) => {
    const { own, synonyms } = found[i];
    if (own.keys.length === 0) console.warn(`${s.id} (${s.scientificName}): no GBIF match`);
    for (const [strength, gbifTaxa] of [own, synonyms].entries()) {
      for (const key of gbifTaxa.keys) claim('gbif', String(key), s.id, strength);
      for (const name of gbifTaxa.names) claim('names', foldName(name), s.id, strength);
    }
    claim('names', foldName(s.scientificName), s.id, 0);
  });

  const problems: string[] = [];
  const settle = (kind: keyof typeof claims): Record<string, string> =>
    Object.fromEntries(
      [...claims[kind]]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .flatMap(([key, { ids }]): [string, string][] => {
          if (ids.size === 1) return [[key, [...ids][0]]];
          const what = kind === 'names' ? 'name' : 'GBIF key';
          problems.push(`${what} ${key} maps to ${[...ids].sort().join(' and ')}: add an alias`);
          return [];
        }),
    );
  // An alias is the last word on its name, whatever else claims it.
  for (const [name, id] of settled) claims.names.set(name, { strength: -1, ids: new Set([id]) });
  const index = { names: settle('names'), gbif: settle('gbif') };
  failOn(problems);
  return index;
}

type GbifTaxa = { keys: number[]; names: string[] };

/**
 * A Species' GBIF keys and the names they carry: its own (its name's match and the accepted taxon,
 * Wikidata's key first) and the accepted taxon's synonyms.
 */
async function gbifNames(
  name: string,
  wikidataKey: number | undefined,
): Promise<{ own: GbifTaxa; synonyms: GbifTaxa }> {
  const match = await gbif<{ usageKey?: number; acceptedUsageKey?: number }>(
    `/species/match?${new URLSearchParams({ name, kingdom: 'Plantae', strict: 'true' })}`,
  );
  const acceptedKey = wikidataKey ?? match.acceptedUsageKey ?? match.usageKey;
  if (acceptedKey === undefined) {
    return { own: { keys: [], names: [] }, synonyms: { keys: [], names: [] } };
  }
  const accepted = await gbif<{ key: number; canonicalName?: string }>(`/species/${acceptedKey}`);
  const synonyms = await gbif<{ results: { key: number; canonicalName?: string }[] }>(
    `/species/${acceptedKey}/synonyms?limit=1000`,
  );
  const names = (taxa: { canonicalName?: string }[]) =>
    taxa.flatMap((t) => (t.canonicalName ? [t.canonicalName] : []));
  return {
    own: {
      keys: [accepted.key, ...(match.usageKey ? [match.usageKey] : [])],
      names: names([accepted]),
    },
    synonyms: { keys: synonyms.results.map((t) => t.key), names: names(synonyms.results) },
  };
}

async function gbif<T>(path: string): Promise<T> {
  const response = await fetch(`${GBIF_API}${path}`, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`GBIF ${path} failed: HTTP ${response.status}`);
  return (await response.json()) as T;
}

/** `run` over each item, `limit` at a time, results in order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await run(items[i]);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

/** A name as the index keys it; keep in step with `foldName` in src/core/identify.ts. */
function foldName(name: string): string {
  return name.toLowerCase().replace(/×/g, ' ').replace(/\s+/g, ' ').trim();
}

function validate({ version, species }: SpeciesDataset): string[] {
  const problems: string[] = [];
  if (!Number.isInteger(version) || version < 1) {
    problems.push(`version must be a positive integer, got ${version}`);
  }
  if (species.length === 0) problems.push('species must not be empty');

  const seen = new Map<string, string>();
  for (const s of species) {
    const where = `${s.id} (${s.scientificName})`;
    for (const key of Object.keys(s)) {
      if (!(key in FIELD_KINDS)) problems.push(`${where}: unknown field ${key}`);
    }
    if (!/^Q[1-9]\d*$/.test(s.id)) problems.push(`${where}: id must be a Wikidata QID`);
    for (const [key, kind] of Object.entries(FIELD_KINDS) as [keyof Species, string][]) {
      const value: unknown = s[key];
      if (kind === 'name') {
        if (typeof value !== 'string' || !value.trim()) {
          problems.push(`${where}: ${key} must be a non-empty string`);
          continue;
        }
        const other = seen.get(`${key}:${value}`);
        if (other) problems.push(`${where}: ${key} duplicates ${other}`);
        seen.set(`${key}:${value}`, s.id);
      } else if (kind === 'flag') {
        if (value !== null && typeof value !== 'boolean') {
          problems.push(`${where}: ${key} must be true, false or null (unknown)`);
        }
      } else if (
        value !== null &&
        !(typeof value === 'number' && Number.isInteger(value) && value > 0)
      ) {
        problems.push(`${where}: ${key} must be null or a positive integer, got ${value}`);
      }
    }
    for (const care of ['watering', 'fertilizing'] as const) {
      if (s[`${care}DormantDays`] !== null && s[`${care}GrowingDays`] === null) {
        problems.push(`${where}: a ${care} Dormant interval needs a Growing interval`);
      }
    }
  }
  return problems;
}

type Taxon = { name: string; gbif?: number };

/** Taxon name (P225) and GBIF taxon ID (P14607) per QID, straight from Wikidata's SPARQL endpoint. */
async function fetchTaxa(ids: string[]): Promise<Map<string, Taxon>> {
  const query = `SELECT ?item ?name ?gbif WHERE {
    VALUES ?item { ${ids.map((id) => `wd:${id}`).join(' ')} }
    ?item wdt:P225 ?name .
    OPTIONAL { ?item wdt:P14607 ?gbif }
  }`;
  const response = await fetch(`${SPARQL_ENDPOINT}?${new URLSearchParams({ query })}`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`Wikidata query failed: HTTP ${response.status}`);
  const body = (await response.json()) as {
    results: {
      bindings: { item: { value: string }; name: { value: string }; gbif?: { value: string } }[];
    };
  };

  const taxa = new Map<string, Taxon>();
  for (const { item, name, gbif } of body.results.bindings) {
    const id = item.value.slice(item.value.lastIndexOf('/') + 1);
    const known = taxa.get(id);
    if (known && known.name !== name.value) {
      throw new Error(
        `${id} carries several taxon names on Wikidata: ${known.name}, ${name.value}`,
      );
    }
    const key = gbif ? Number(gbif.value) : undefined;
    if (known?.gbif !== undefined && key !== undefined && known.gbif !== key) {
      throw new Error(`${id} carries several GBIF taxon IDs on Wikidata: ${known.gbif}, ${key}`);
    }
    taxa.set(id, { name: name.value, gbif: known?.gbif ?? key });
  }
  return taxa;
}

/**
 * The dataset committed at HEAD is what has shipped; reading it from git means a deleted or
 * hand-edited working copy cannot slip an ID removal past the checks.
 */
function readShipped(): SpeciesDataset | undefined {
  try {
    const json = execFileSync('git', ['show', 'HEAD:assets/species.json'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return JSON.parse(json) as SpeciesDataset;
  } catch {
    console.warn(
      'No assets/species.json committed at HEAD: skipping the append-only and version checks',
    );
    return undefined;
  }
}

function checkAgainstShipped(next: SpeciesDataset, shipped: SpeciesDataset): string[] {
  const ids = new Set(next.species.map((s) => s.id));
  const problems = shipped.species
    .filter((s) => !ids.has(s.id))
    .map((s) => `${s.id} (${s.scientificName}) has shipped; Species IDs are append-only`);

  const changed = JSON.stringify(next.species) !== JSON.stringify(shipped.species);
  if (next.version < shipped.version) {
    problems.push(`version ${next.version} is below the shipped ${shipped.version}`);
  } else if (changed && next.version === shipped.version) {
    problems.push(`species changed: bump "version" in curated.json above ${shipped.version}`);
  }
  return problems;
}

/** One species per line, like curated.json, so diffs read as one row per taxon. */
function render({ species, ...header }: BundledDataset): string {
  const rows = species.map((s) => `    ${JSON.stringify(s)}`).join(',\n');
  // The pretty-printed header ends in "\n}"; cut those two characters and append the species array.
  return `${JSON.stringify(header, null, 2).slice(0, -2)},\n  "species": [\n${rows}\n  ]\n}\n`;
}

function failOn(problems: string[]): void {
  if (problems.length === 0) return;
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
