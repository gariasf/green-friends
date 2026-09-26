import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { useEffect, useMemo, useState } from 'react';

import { NewerExportError } from '../../src/core/import';
import { listPlants } from '../../src/core/plants';
import { openGarden, type Garden } from './garden';
import { keyFromFragment, loadSnapshot, storeKey, storedKey } from './snapshot';

type State =
  | { kind: 'loading' }
  | { kind: 'message'; title: string; line: string }
  | { kind: 'garden'; garden: Garden; takenAt: Date | null };

const UNPAIRED = {
  kind: 'message',
  title: 'Not paired yet',
  line: "Open the Pairing link from Green Friends' Settings on your phone.",
} as const;

/**
 * The key from a Pairing link just opened, kept and cleared from the address bar, or the one kept
 * before. A browser that won't keep it (a private window) keeps the link as it is instead, so a
 * reload still finds the key.
 */
async function pairingKey(): Promise<Uint8Array | undefined> {
  const fromLink = keyFromFragment(location.hash);
  if (!fromLink) return storedKey().catch(() => undefined);
  try {
    await storeKey(fromLink);
    history.replaceState(null, '', location.pathname + location.search);
  } catch {
    // Kept in the link only.
  }
  return fromLink;
}

async function load(): Promise<State> {
  const key = await pairingKey();
  if (!key) return UNPAIRED;
  try {
    const snapshot = await loadSnapshot(key);
    if (!snapshot) {
      return {
        kind: 'message',
        title: 'No Garden found',
        line: "Nothing has synced with this Pairing link. Turn Sync on in Green Friends' Settings, or open the link it shows now.",
      };
    }
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    return { kind: 'garden', garden: openGarden(SQL, snapshot.zip), takenAt: snapshot.takenAt };
  } catch (error) {
    if (error instanceof NewerExportError) {
      return {
        kind: 'message',
        title: 'Update needed',
        line: 'Your phone has a newer Green Friends. This page needs an update.',
      };
    }
    const reason = error instanceof Error ? error.message : String(error);
    return { kind: 'message', title: 'Could not open your Garden', line: reason };
  }
}

export function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    void load().then(setState);
    // A Pairing link pasted into this tab changes only the fragment, which reloads nothing.
    const paired = () => {
      if (!keyFromFragment(location.hash)) return;
      setState({ kind: 'loading' });
      void load().then(setState);
    };
    addEventListener('hashchange', paired);
    return () => removeEventListener('hashchange', paired);
  }, []);

  if (state.kind === 'loading') return <main aria-busy="true" />;
  if (state.kind === 'message') {
    return (
      <main className="message">
        <h1>{state.title}</h1>
        <p>{state.line}</p>
      </main>
    );
  }
  return <GardenList garden={state.garden} takenAt={state.takenAt} />;
}

const SYNCED = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** Every live plant by Display Name, with its photo and scientific name, as the phone's Garden. */
function GardenList({ garden, takenAt }: { garden: Garden; takenAt: Date | null }) {
  const plants = useMemo(() => listPlants(garden.db), [garden]);
  // ponytail: never revoked; the page holds one Garden for its whole life.
  const photos = useMemo(() => {
    const urls = new Map<string, string>();
    for (const { photo } of plants) {
      const bytes = photo && garden.photo(photo);
      // Unzipped by fflate into a plain ArrayBuffer, never a shared one.
      const blob = bytes && new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' });
      if (blob) urls.set(photo, URL.createObjectURL(blob));
    }
    return urls;
  }, [garden, plants]);

  return (
    <main>
      <h1>Garden</h1>
      {takenAt && <p className="synced">Synced {SYNCED.format(takenAt)}</p>}
      {plants.length === 0 ? (
        <p>No plants yet.</p>
      ) : (
        <ul className="plants">
          {plants.map((plant) => {
            const url = plant.photo && photos.get(plant.photo);
            return (
              <li key={plant.id}>
                {/* Decorative beside the plant's name, as on the phone. */}
                {url ? <img src={url} alt="" /> : <span className="no-photo" />}
                <span>
                  <span className="name">{plant.displayName}</span>
                  {plant.scientificName && plant.scientificName !== plant.displayName && (
                    <span className="scientific">{plant.scientificName}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
