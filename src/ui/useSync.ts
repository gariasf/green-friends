import Constants from 'expo-constants';
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  CryptoDigestAlgorithm,
  digest,
  getRandomBytes,
} from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useSyncExternalStore } from 'react';
import { Alert, AppState } from 'react-native';

import { localDay } from '@/src/core/dates';
import { isGardenEmpty } from '@/src/core/plants';
import {
  APP_PAIRING_LINK,
  RELAY_URL,
  SNAPSHOT_LAYOUT,
  SYNC_OFF,
  createSync,
  deriveSyncKeys,
  fromBase64url,
  keyFromFragment,
  toBase64url,
  type SyncKeys,
  type SyncRelay,
  type SyncStatus,
} from '@/src/core/sync';
import { db, withScratchDb } from '@/src/db/client';
import { alertError } from '@/src/ui/Form';
import { photoFiles } from '@/src/ui/Photo';
import { useAfterWrites } from '@/src/ui/useAfterWrites';
import { dateLabel } from '@/src/ui/words';

/** The Web view (web/), whose origin the relay lets read. */
const WEB_VIEW = 'https://green-friends.gariasf.workers.dev';

/**
 * Sync's key, in the keychain on this device only: never in an iCloud backup nor on a new phone,
 * which restores from a saved Pairing link instead (ADR-0006).
 */
const KEY_ITEM = 'sync-key';
const KEYCHAIN = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

/** The Pairing link as last made, until the key changes: read from the keychain once. */
let link: string | null = null;

/**
 * Sync's status beside the Garden, not in it: a file, so an Export never carries it and writing it
 * fires no database change, and gone with the app, so a reinstall starts with Sync off.
 */
const statusFile = new File(Paths.document, 'sync.json');

/**
 * The status as last kept, or Sync off. Off, too, where the status came back without the key: an
 * iCloud or new-phone restore brings Documents/ back but never the key, and Sync under a new key
 * would leave the saved Pairing link behind without a word. A file cut short reads as off as well.
 */
function storedStatus(): SyncStatus {
  try {
    if (!statusFile.exists || SecureStore.getItem(KEY_ITEM, KEYCHAIN) === null) return SYNC_OFF;
    return { ...SYNC_OFF, ...JSON.parse(statusFile.textSync()) };
  } catch {
    return SYNC_OFF;
  }
}

/** The key, made the first time Sync needs one. */
function syncKey(): Uint8Array {
  const stored = SecureStore.getItem(KEY_ITEM, KEYCHAIN);
  if (stored !== null) return fromBase64url(stored);
  return keepKey(newKey());
}

/** A new random key, 32 bytes as spec #35 has it. */
function newKey(): Uint8Array {
  return getRandomBytes(32);
}

/** Keeps `key` as Sync's, in place of any before it. */
function keepKey(key: Uint8Array): Uint8Array {
  SecureStore.setItem(KEY_ITEM, toBase64url(key), KEYCHAIN);
  link = null;
  return key;
}

async function keys(): Promise<SyncKeys> {
  const sha256 = async (bytes: Uint8Array<ArrayBuffer>) =>
    new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, bytes));
  const { gardenId, writeToken, encryptionKey } = await deriveSyncKeys(syncKey(), sha256);
  const aes = await AESEncryptionKey.import(encryptionKey);
  // A fresh 12-byte iv each time, and CryptoKit's combined form is iv | ciphertext | tag.
  return {
    gardenId,
    writeToken,
    seal: async (zip) => (await aesEncryptAsync(zip, aes)).combined(),
    open: (snapshot) => aesDecryptAsync(AESSealedData.fromCombined(snapshot, SNAPSHOT_LAYOUT), aes),
  };
}

const relay: SyncRelay = {
  async put(gardenId, writeToken, snapshot) {
    const response = await fetch(`${RELAY_URL}/gardens/${gardenId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${writeToken}` },
      // Sealed by expo-crypto into a plain ArrayBuffer, never a shared one.
      body: snapshot as Uint8Array<ArrayBuffer>,
    });
    if (!response.ok) throw new Error(`The relay refused the Snapshot (HTTP ${response.status})`);
  },
  async days(gardenId) {
    return (await read(`/gardens/${gardenId}/snapshots`)).json();
  },
  async get(gardenId, day) {
    return new Uint8Array(
      await (await read(`/gardens/${gardenId}/snapshots/${day}`)).arrayBuffer(),
    );
  },
  async remove(gardenId, writeToken) {
    const response = await fetch(`${RELAY_URL}/gardens/${gardenId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${writeToken}` },
    });
    if (!response.ok) throw new Error(`The relay refused the delete (HTTP ${response.status})`);
  },
};

/** A read from the relay; throws unless it answered with what was asked for. */
async function read(path: string): Promise<Response> {
  const response = await fetch(`${RELAY_URL}${path}`);
  if (!response.ok) throw new Error(`The relay answered HTTP ${response.status}`);
  return response;
}

const listeners = new Set<() => void>();

/** The app's Sync, one for the whole app, as `db` is. */
export const sync = createSync({
  db,
  files: photoFiles,
  relay,
  keys,
  appVersion: Constants.expoConfig?.version ?? 'unknown',
  status: storedStatus(),
  onStatus(status) {
    statusFile.write(JSON.stringify(status));
    listeners.forEach((listener) => listener());
  },
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Sync's status, for Settings to show. */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, sync.status);
}

/** The Pairing link: the Web view, with the key after its `#`, which browsers never send. */
export function pairingLink(): string {
  return (link ??= `${WEB_VIEW}/#k=${toBase64url(syncKey())}`);
}

/** Reset sync: deletes every Snapshot on the relay, then makes a new key and uploads under it. */
export function resetSync(): Promise<void> {
  return sync.reset(() => void keepKey(newKey()));
}

/** Imports the relay's Snapshot of `day`, as Import does an Export. */
export function restoreSnapshot(day: string): Promise<void> {
  return sync.restore(day, withScratchDb);
}

/**
 * A relay day (UTC, as the relay dates its Snapshots) as a date ("Thu, Sep 24"): near midnight it
 * can be a day off the phone's own calendar, so never Today or Yesterday.
 */
export function snapshotLabel(day: string): string {
  return dateLabel(day, localDay(new Date()), 'short');
}

/** An alert asking `title`, resolving to whether `action` was chosen over Cancel. */
function ask(title: string, message: string, action: string): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: action, onPress: () => resolve(true) },
    ]),
  );
}

/**
 * A Pairing link opened on this phone (`greenfriends://pair#k=…`, from the Web view's Open in Green
 * Friends): Sync takes its key and turns on, offering an empty Garden the latest Snapshot. A Garden
 * with plants that syncs under another key is asked first, since it then replaces the opened one's
 * Snapshot of today.
 */
async function pair(key: Uint8Array): Promise<void> {
  const stored = SecureStore.getItem(KEY_ITEM, KEYCHAIN);
  if (stored !== null && stored !== toBase64url(key) && !isGardenEmpty(db)) {
    const replace = await ask(
      'Replace the Pairing link?',
      "This iPhone syncs under another Pairing link. From now on it syncs under the one you opened: this iPhone's Garden replaces that link's Snapshot of today, and the other link's Snapshots stop being updated.",
      'Replace',
    );
    if (!replace) return;
  }
  let restored = false;
  await sync.pair(
    () => void keepKey(key),
    async (day) =>
      (restored = await ask(
        `Restore your Garden from ${snapshotLabel(day)}?`,
        'Its plants, Care Logs and photos come back from the Snapshot Sync kept that day.',
        'Restore',
      )),
    withScratchDb,
  );
  if (restored) Alert.alert('Garden restored');
}

/** A link opened in the app, taken as a Pairing link if it is one. */
function openLink(url: string | null): void {
  if (!url?.startsWith(APP_PAIRING_LINK)) return;
  const key = keyFromFragment(url.slice(url.indexOf('#')));
  if (!key) return Alert.alert('This Pairing link is damaged', 'Open it again from the Web view.');
  pair(key).catch((error) => alertError('Could not pair', error));
}

/**
 * Takes the Pairing links opened in the app, and keeps the Snapshot on the relay up to date while
 * Sync is on, from the root layout: the moments the Daily Digests are planned again (useDigests),
 * after every burst of writes, at launch and back in the foreground.
 */
export function useSync(): void {
  useAfterWrites(sync.afterWrites);
  useEffect(() => {
    void Linking.getInitialURL().then(openLink);
    const links = Linking.addEventListener('url', ({ url }) => openLink(url));
    return () => links.remove();
  }, []);
  useEffect(() => {
    sync.foreground();
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync.foreground();
    });
    return () => foreground.remove();
  }, []);
}
