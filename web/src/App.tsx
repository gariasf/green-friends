import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { useEffect, useMemo, useState } from 'react';

import { evaluateCare, needsAttention } from '../../src/core/care';
import { localDay } from '../../src/core/dates';
import { NewerExportError } from '../../src/core/import';
import { listPlants } from '../../src/core/plants';
import { plantsNeedYou, plural } from '../../src/ui/words';
import { openGarden, type Garden } from './garden';
import { AppMark } from './icons';
import { GardenList, PlantScreen, Today, type PhotoUrl } from './screens';
import { APP_PAIRING_LINK, keyFromFragment, toBase64url } from '../../src/core/sync';
import { loadSnapshot, storeKey, storedKey } from './snapshot';

type State =
  | { kind: 'loading' }
  | { kind: 'message'; title: string; line: string }
  | { kind: 'garden'; garden: Garden; takenAt: Date | null; pairKey: Uint8Array };

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
// ponytail: a key only in the link leaves the address bar at the first tab, so a reload there asks
// to pair again; keep it in sessionStorage if that ever matters.
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
        line: "Nothing has synced with this Pairing link, or Sync was reset since. Turn Sync on in Green Friends' Settings, or open the Pairing link it shows now.",
      };
    }
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    return {
      kind: 'garden',
      garden: openGarden(SQL, snapshot.zip),
      takenAt: snapshot.takenAt,
      pairKey: key,
    };
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

type Route = { tab: 'today' } | { tab: 'garden' } | { tab: 'plant'; id: string };

/** Where the fragment leads once a Pairing link's key has left it: `#/garden`, `#/plant/<id>`, else Today. */
function route(fragment: string): Route {
  const plant = /^#\/plant\/([\w-]+)$/.exec(fragment);
  if (plant) return { tab: 'plant', id: plant[1] };
  return fragment === '#/garden' ? { tab: 'garden' } : { tab: 'today' };
}

export function App() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [screen, setScreen] = useState(() => route(location.hash));
  useEffect(() => {
    void load().then(setState);
    const onHashChange = () => {
      // A Pairing link pasted into this tab changes only the fragment, which reloads nothing.
      if (keyFromFragment(location.hash)) {
        setState({ kind: 'loading' });
        void load().then(setState);
      }
      setScreen(route(location.hash));
    };
    addEventListener('hashchange', onHashChange);
    return () => removeEventListener('hashchange', onHashChange);
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
  return (
    <GardenView
      garden={state.garden}
      takenAt={state.takenAt}
      pairKey={state.pairKey}
      screen={screen}
    />
  );
}

const SYNCED = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/**
 * The Garden's screens in the shell (spec #41): a sidebar with the app's mark and name, Today and
 * Garden with their counts, and when the Snapshot was taken at its foot; below 60rem, a top bar.
 * Each plant has its own address.
 */
function GardenView({
  garden,
  takenAt,
  pairKey,
  screen,
}: {
  garden: Garden;
  takenAt: Date | null;
  pairKey: Uint8Array;
  screen: Route;
}) {
  const photoUrl = usePhotoUrls(garden);
  const { needYou, plants } = useMemo(
    () => ({
      needYou: evaluateCare(garden.db, localDay(new Date())).filter(needsAttention).length,
      plants: listPlants(garden.db).length,
    }),
    [garden],
  );
  // A new screen starts at its top, and a screen reader starts at its heading.
  useEffect(() => {
    scrollTo(0, 0);
    document.querySelector<HTMLElement>('main h1')?.focus();
  }, [screen]);

  return (
    <div className="shell">
      <header className="sidebar">
        <p className="brand">
          <AppMark />
          <span>Green Friends</span>
        </p>
        <nav aria-label="Screens">
          <a
            href="#/"
            aria-current={screen.tab === 'today' ? 'page' : undefined}
            aria-label={needYou > 0 ? `Today, ${plantsNeedYou(needYou)}` : undefined}
          >
            Today
            {needYou > 0 && <span className="count">{needYou}</span>}
          </a>
          <a
            href="#/garden"
            aria-current={screen.tab === 'today' ? undefined : 'page'}
            aria-label={`Garden, ${plural(plants, 'plant')}`}
          >
            Garden
            <span className="count quiet">{plants}</span>
          </a>
        </nav>
        {/* The Pairing link as the app takes it, for a phone to pair and restore from (#40). */}
        <a className="open-app" href={`${APP_PAIRING_LINK}#k=${toBase64url(pairKey)}`}>
          Open in Green Friends
        </a>
        {takenAt && <p className="synced">Synced {SYNCED.format(takenAt)}</p>}
      </header>
      <main className={`screen-${screen.tab}`}>
        {screen.tab === 'today' && <Today garden={garden} photoUrl={photoUrl} />}
        {screen.tab === 'garden' && <GardenList garden={garden} photoUrl={photoUrl} />}
        {screen.tab === 'plant' && (
          <PlantScreen garden={garden} id={screen.id} photoUrl={photoUrl} />
        )}
      </main>
    </div>
  );
}

/** Each plant's photo's address in this page, the Web view showing only plants in care. */
function usePhotoUrls(garden: Garden): PhotoUrl {
  return useMemo(() => {
    // ponytail: never revoked; the page holds one Garden for its whole life.
    const urls = new Map<string, string>();
    for (const { photo } of listPlants(garden.db)) {
      const bytes = photo && garden.photo(photo);
      // Unzipped by fflate into a plain ArrayBuffer, never a shared one.
      const blob = bytes && new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' });
      if (blob) urls.set(photo, URL.createObjectURL(blob));
    }
    return (filename) => (filename ? urls.get(filename) : undefined);
  }, [garden]);
}
