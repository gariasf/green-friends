/// <reference types="node" />
/**
 * Spot-checks Open Plantbook coverage of the curated Species list (ticket #10; caveat 1 of the
 * species research, #4). Open Plantbook only answers with registered API credentials, generated
 * in its web UI under API keys (https://open.plantbook.io/apikey/), so this runs by hand:
 *
 *   OPENPLANTBOOK_CLIENT_ID=… OPENPLANTBOOK_CLIENT_SECRET=… npm run species:coverage
 *
 * Prints one line per species and a coverage total to paste into the ticket. Nothing from
 * Open Plantbook is written anywhere: v1 has no consumer for its thresholds.
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';

import type { SpeciesDataset } from '../../src/core/species';

const API = 'https://open.plantbook.io/api/v1';

type Hit = { pid: string; display_pid: string; alias: string | null };

async function main(): Promise<void> {
  const clientId = process.env.OPENPLANTBOOK_CLIENT_ID;
  const clientSecret = process.env.OPENPLANTBOOK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error(
      'Set OPENPLANTBOOK_CLIENT_ID and OPENPLANTBOOK_CLIENT_SECRET (https://open.plantbook.io/apikey/).',
    );
    process.exit(1);
  }
  const token = await fetchToken(clientId, clientSecret);
  const { species } = JSON.parse(
    readFileSync(new URL('./curated.json', import.meta.url), 'utf8'),
  ) as SpeciesDataset;

  let exact = 0;
  for (const { scientificName } of species) {
    const hits = await search(token, scientificName);
    const match = hits.find(
      (hit) => hit.display_pid.toLowerCase() === scientificName.toLowerCase(),
    );
    if (match) {
      exact++;
      console.log(`exact  ${scientificName} → ${match.pid}`);
    } else if (hits.length > 0) {
      console.log(`near   ${scientificName} → ${hits.map((hit) => hit.pid).join(', ')}`);
    } else {
      console.log(`MISS   ${scientificName}`);
    }
  }
  console.log(`\n${exact}/${species.length} species have an exact Open Plantbook entry`);
}

async function fetchToken(clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch(`${API}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!response.ok) throw new Error(`Open Plantbook token request failed: HTTP ${response.status}`);
  const { access_token } = (await response.json()) as { access_token: string };
  return access_token;
}

async function search(token: string, name: string): Promise<Hit[]> {
  const params = new URLSearchParams({ alias: name, userplant: 'false', limit: '5' });
  const response = await fetch(`${API}/plant/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok)
    throw new Error(`Open Plantbook search failed for ${name}: HTTP ${response.status}`);
  const { results } = (await response.json()) as { results: Hit[] };
  return results;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
