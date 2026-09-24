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
 *   references such as the ASPCA's toxic and non-toxic plant lists; none of them is imported. A
 *   species is toxic where such a reference lists it or a relative sharing its toxic principle, and
 *   non-toxic only where one lists it, or its whole genus or family, as non-toxic.
 * - No Perenual data: its terms forbid redistribution. Open Plantbook thresholds are not bundled
 *   because nothing in v1 reads them; openplantbook-coverage.ts runs the coverage spot-check.
 *
 * Invariants: QIDs unique and append-only (every ID ever committed in assets/species.json stays,
 * none is reused for another taxon), intervals are positive integers, a Dormant interval needs a
 * Growing one, every species states its pet toxicity, and the dataset version goes up whenever the
 * species content changes (the app reseeds on a higher version).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

import type { Species, SpeciesDataset } from '../../src/core/species';

const REPO_ROOT = new URL('../../', import.meta.url);
const CURATED_PATH = new URL('./curated.json', import.meta.url);
const OUTPUT_PATH = new URL('assets/species.json', REPO_ROOT);
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
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
];

type BundledDataset = SpeciesDataset & { sources: typeof SOURCES };

async function main(): Promise<void> {
  const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8')) as SpeciesDataset;
  failOn(validate(curated));

  const taxonNames = await fetchTaxonNames(curated.species.map((s) => s.id));
  failOn(
    curated.species.flatMap((s) => {
      const name = taxonNames.get(s.id);
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

  writeFileSync(OUTPUT_PATH, render(dataset));
  console.log(`Wrote ${dataset.species.length} species, dataset version ${dataset.version}`);
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
        if (typeof value !== 'boolean') problems.push(`${where}: ${key} must be true or false`);
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

/** Taxon name (P225) per QID, straight from Wikidata's SPARQL endpoint. */
async function fetchTaxonNames(ids: string[]): Promise<Map<string, string>> {
  const query = `SELECT ?item ?name WHERE {
    VALUES ?item { ${ids.map((id) => `wd:${id}`).join(' ')} }
    ?item wdt:P225 ?name .
  }`;
  const response = await fetch(`${SPARQL_ENDPOINT}?${new URLSearchParams({ query })}`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': USER_AGENT },
  });
  if (!response.ok) throw new Error(`Wikidata query failed: HTTP ${response.status}`);
  const body = (await response.json()) as {
    results: { bindings: { item: { value: string }; name: { value: string } }[] };
  };

  const names = new Map<string, string>();
  for (const { item, name } of body.results.bindings) {
    const id = item.value.slice(item.value.lastIndexOf('/') + 1);
    const known = names.get(id);
    if (known && known !== name.value) {
      throw new Error(`${id} carries several taxon names on Wikidata: ${known}, ${name.value}`);
    }
    names.set(id, name.value);
  }
  return names;
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
