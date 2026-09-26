import Constants from 'expo-constants';
import {
  AESEncryptionKey,
  aesEncryptAsync,
  CryptoDigestAlgorithm,
  digest,
  getRandomBytes,
} from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import {
  SYNC_OFF,
  createSync,
  deriveSyncKeys,
  fromBase64url,
  toBase64url,
  type SyncKeys,
  type SyncRelay,
  type SyncStatus,
} from '@/src/core/sync';
import { db } from '@/src/db/client';
import { photoFiles } from '@/src/ui/Photo';
import { useAfterWrites } from '@/src/ui/useAfterWrites';

/** The blind relay (docs/agents/relay.md) and the Web view, whose origin it lets read. */
const RELAY = 'https://green-friends-relay.gariasf.workers.dev';
const WEB_VIEW = 'https://green-friends.pages.dev';

/**
 * Sync's key, in the keychain on this device only: never in an iCloud backup nor on a new phone,
 * which restores from a saved Pairing link instead (ADR-0006).
 */
const KEY_ITEM = 'sync-key';
const KEYCHAIN = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

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
  const key = getRandomBytes(32);
  SecureStore.setItem(KEY_ITEM, toBase64url(key), KEYCHAIN);
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
  };
}

const relay: SyncRelay = {
  async put(gardenId, writeToken, snapshot) {
    const response = await fetch(`${RELAY}/gardens/${gardenId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${writeToken}` },
      // Sealed by expo-crypto into a plain ArrayBuffer, never a shared one.
      body: snapshot as Uint8Array<ArrayBuffer>,
    });
    if (!response.ok) throw new Error(`The relay refused the Snapshot (HTTP ${response.status})`);
  },
};

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
  return `${WEB_VIEW}/#k=${toBase64url(syncKey())}`;
}

/**
 * Keeps the Snapshot on the relay up to date while Sync is on, from the root layout: the moments
 * the Daily Digests are planned again (useDigests), after every burst of writes, at launch and back
 * in the foreground.
 */
export function useSync(): void {
  useAfterWrites(sync.afterWrites);
  useEffect(() => {
    sync.foreground();
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync.foreground();
    });
    return () => foreground.remove();
  }, []);
}
