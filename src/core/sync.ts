import type { Db } from '../db/types';
import { buildExport } from './export';
import type { PhotoFiles } from './photos';

/**
 * Sync (CONTEXT.md, ADR-0006): the phone uploads its Export, encrypted, as a Snapshot to the blind
 * relay after each burst of writes. The app hands in the relay over fetch and the encryption over
 * expo-crypto, which core can't import; tests hand in fakes.
 */

/** The most the relay takes in one Snapshot (relay/src/index.ts). */
export const SNAPSHOT_CAP_BYTES = 25 * 1024 * 1024;

/**
 * A Snapshot is `iv | ciphertext | tag`, AES-256-GCM, as expo-crypto's combined form and WebCrypto
 * (the iv, then its output) both have it. In expo-crypto's AESSealedDataConfig shape.
 */
export const SNAPSHOT_LAYOUT = { ivLength: 12, tagLength: 16 } as const;

/** The relay (docs/agents/relay.md), injected so the core stays plain TypeScript. */
export type SyncRelay = {
  /** Stores `snapshot` as today's for `gardenId`; throws unless the relay took it. */
  put(gardenId: string, writeToken: string, snapshot: Uint8Array): Promise<void>;
};

/** What Sync needs from the key: where the Snapshots go, the right to write there, and a seal. */
export type SyncKeys = {
  gardenId: string;
  writeToken: string;
  /** Encrypts an Export into a Snapshot, in SNAPSHOT_LAYOUT. */
  seal(zip: Uint8Array): Promise<Uint8Array>;
};

/** Sync's state on this device; never Garden data, so never in an Export. */
export type SyncStatus = {
  on: boolean;
  /** When a Snapshot last reached the relay (ISO), or null for never. */
  syncedAt: string | null;
  /** Why the last upload didn't happen, until one does: too big, or the error. */
  problem: string | null;
  /** Whether writes since the last upload have yet to reach the relay. */
  unsynced: boolean;
};

export const SYNC_OFF: SyncStatus = { on: false, syncedAt: null, problem: null, unsynced: false };

export type Sync = {
  status(): SyncStatus;
  /** After a burst of writes: an upload once none follows for the delay. */
  afterWrites(): void;
  /** At launch and back in the foreground: an upload, if writes are still to reach the relay. */
  foreground(): void;
  /** An upload now, whether or not anything changed. */
  syncNow(): Promise<void>;
  turnOn(): Promise<void>;
  turnOff(): void;
};

/**
 * Sync's timing: uploads only while on, the delay after a burst of writes, one at a time, and again
 * after one that failed or was overtaken by writes. `status` is as the device last kept it, and
 * every change of it goes to `onStatus`.
 */
export function createSync({
  db,
  files,
  relay,
  keys,
  appVersion,
  status: initial,
  onStatus,
  delayMs = 2000,
  now = () => new Date(),
}: {
  db: Db;
  files: PhotoFiles;
  relay: SyncRelay;
  keys: () => Promise<SyncKeys>;
  appVersion: string;
  status: SyncStatus;
  onStatus: (status: SyncStatus) => void;
  delayMs?: number;
  now?: () => Date;
}): Sync {
  let status = initial;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue = Promise.resolve();

  const set = (patch: Partial<SyncStatus>) => {
    status = { ...status, ...patch };
    onStatus(status);
  };

  const upload = async () => {
    if (!status.on || !status.unsynced) return;
    // Cleared before the Export is built: a write from here on marks it unsynced again.
    set({ unsynced: false });
    try {
      const { gardenId, writeToken, seal } = await keys();
      const snapshot = await seal(buildExport(db, files, appVersion, now()));
      if (snapshot.length > SNAPSHOT_CAP_BYTES) {
        // Rounded up, so a Snapshot just over the cap never reads as 25.0 MB.
        const mb = (Math.ceil((snapshot.length / 1024 / 1024) * 10) / 10).toFixed(1);
        return set({ problem: `Too big to sync: ${mb} MB, over the 25 MB a Snapshot can hold` });
      }
      // Turned off while the Snapshot was being made: nothing leaves.
      if (!status.on) return;
      await relay.put(gardenId, writeToken, snapshot);
      set({ syncedAt: now().toISOString(), problem: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ unsynced: true, problem: `Could not sync: ${message}` });
    }
  };

  /** Uploads once the uploads before are done, so two never race. */
  const run = () => {
    clearTimeout(timer);
    queue = queue.then(upload);
    return queue;
  };

  return {
    status: () => status,
    afterWrites() {
      if (!status.on) return;
      if (!status.unsynced) set({ unsynced: true });
      clearTimeout(timer);
      timer = setTimeout(run, delayMs);
    },
    foreground() {
      if (status.on && status.unsynced) void run();
    },
    syncNow() {
      if (status.on) set({ unsynced: true });
      return run();
    },
    turnOn() {
      set({ on: true, unsynced: true });
      return run();
    },
    turnOff() {
      clearTimeout(timer);
      set({ on: false });
    },
  };
}

/**
 * The garden id, write token and AES-256 key, each SHA-256 over its label and then the key (spec
 * #35), so the phone and the Web view find the same Snapshots from the key alone.
 */
export async function deriveSyncKeys(
  key: Uint8Array,
  sha256: (bytes: Uint8Array<ArrayBuffer>) => Promise<Uint8Array<ArrayBuffer>>,
): Promise<{ gardenId: string; writeToken: string; encryptionKey: Uint8Array<ArrayBuffer> }> {
  const derive = (label: string) =>
    sha256(new Uint8Array([...new TextEncoder().encode(label), ...key]));
  const [garden, write, encryptionKey] = await Promise.all(
    ['gf-garden', 'gf-write', 'gf-enc'].map(derive),
  );
  return { gardenId: hex(garden), writeToken: hex(write), encryptionKey };
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Unpadded base64url, as a Pairing link carries the key after its `#k=`. */
export function toBase64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function fromBase64url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
