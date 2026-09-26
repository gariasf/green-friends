import { strFromU8, unzipSync } from 'fflate';
import { webcrypto } from 'node:crypto';

import fixture from '../test/snapshot-fixture.json';
import { MONSTERA, gardenDb } from '../test/garden';
import { photoStore } from '../test/photos';
import { createPlant } from './plants';
import {
  SNAPSHOT_CAP_BYTES,
  SNAPSHOT_LAYOUT,
  SYNC_OFF,
  createSync,
  deriveSyncKeys,
  fromBase64url,
  toBase64url,
  type SyncKeys,
  type SyncStatus,
} from './sync';

const { subtle } = webcrypto;

const sha256 = async (bytes: Uint8Array<ArrayBuffer>) =>
  new Uint8Array(await subtle.digest('SHA-256', bytes));

const DELAY = 2000;

/** 08:00 on Sep 24 where the tests run (Auckland, UTC+12). */
const NOW = new Date(2026, 8, 24, 8);

/**
 * A Sync over a fake relay, whose puts land in `puts` (the Snapshot unzipped, since the fake seal
 * hands over the Export as it is) or fail while `failing` is set.
 */
function sync(status: Partial<SyncStatus> = {}, seal: SyncKeys['seal'] = async (zip) => zip) {
  const db = gardenDb();
  const puts: { gardenId: string; token: string; plants: unknown[] }[] = [];
  const statuses: SyncStatus[] = [];
  const relay = {
    failing: false,
    /** Runs while a put is on its way, once. */
    during: undefined as (() => void) | undefined,
    async put(gardenId: string, token: string, snapshot: Uint8Array) {
      if (relay.failing) throw new Error('Network request failed');
      const json = JSON.parse(strFromU8(unzipSync(snapshot)['export.json']));
      puts.push({ gardenId, token, plants: json.plants });
      const during = relay.during;
      relay.during = undefined;
      during?.();
    },
  };
  const syncer = createSync({
    db,
    files: photoStore().files,
    relay,
    keys: async () => ({ gardenId: 'garden', writeToken: 'token', seal }),
    appVersion: '1.2.3',
    status: { ...SYNC_OFF, ...status },
    onStatus: (next) => void statuses.push(next),
    delayMs: DELAY,
    now: () => NOW,
  });
  return { db, relay, puts, statuses, syncer };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('Sync', () => {
  test('uploads the Export once after a burst of writes, the delay after the last', async () => {
    const { db, puts, syncer } = sync({ on: true });
    createPlant(db, { speciesId: MONSTERA, nickname: 'Monty' });

    syncer.afterWrites();
    await jest.advanceTimersByTimeAsync(DELAY - 1);
    syncer.afterWrites();
    await jest.advanceTimersByTimeAsync(DELAY - 1);
    expect(puts).toHaveLength(0);
    await jest.advanceTimersByTimeAsync(1);

    expect(puts).toEqual([
      {
        gardenId: 'garden',
        token: 'token',
        plants: [expect.objectContaining({ nickname: 'Monty' })],
      },
    ]);
    expect(syncer.status()).toEqual({
      on: true,
      syncedAt: '2026-09-23T20:00:00.000Z',
      problem: null,
      unsynced: false,
    });
  });

  test('with Sync off, uploads nothing, whatever happens', async () => {
    const { puts, syncer } = sync({ unsynced: true });

    syncer.afterWrites();
    syncer.foreground();
    await syncer.syncNow();
    await jest.advanceTimersByTimeAsync(DELAY);

    expect(puts).toHaveLength(0);
  });

  test('turning Sync on uploads straight away, and turning it off stops a waiting upload', async () => {
    const { puts, syncer } = sync();

    await syncer.turnOn();
    expect(puts).toHaveLength(1);
    syncer.afterWrites();
    syncer.turnOff();
    await jest.advanceTimersByTimeAsync(DELAY);

    expect(puts).toHaveLength(1);
    expect(syncer.status()).toMatchObject({ on: false });
  });

  test('turned off while the Snapshot is being made, sends nothing', async () => {
    let turnOff = () => {};
    const { puts, syncer } = sync({ on: true }, async (zip) => {
      turnOff();
      return zip;
    });
    turnOff = syncer.turnOff;

    await syncer.syncNow();

    expect(puts).toHaveLength(0);
    expect(syncer.status()).toMatchObject({ on: false, syncedAt: null });
  });

  test('back in the foreground, uploads only what has not reached the relay', async () => {
    const { puts, syncer } = sync({ on: true });

    syncer.foreground();
    await jest.advanceTimersByTimeAsync(0);
    expect(puts).toHaveLength(0);

    syncer.afterWrites();
    syncer.foreground();
    await jest.advanceTimersByTimeAsync(0);
    expect(puts).toHaveLength(1);
    // The waiting upload went out early; the delay brings no second one.
    await jest.advanceTimersByTimeAsync(DELAY);
    expect(puts).toHaveLength(1);
  });

  test('keeps a failed upload unsynced, with its error, until one gets through', async () => {
    const { relay, puts, syncer } = sync({ on: true, syncedAt: '2026-09-20T00:00:00.000Z' });
    relay.failing = true;

    await syncer.syncNow();
    expect(syncer.status()).toEqual({
      on: true,
      syncedAt: '2026-09-20T00:00:00.000Z',
      problem: 'Could not sync: Network request failed',
      unsynced: true,
    });

    relay.failing = false;
    syncer.foreground();
    await jest.advanceTimersByTimeAsync(0);
    expect(puts).toHaveLength(1);
    expect(syncer.status()).toMatchObject({ problem: null, unsynced: false });
  });

  test('a write during an upload brings another upload after it', async () => {
    const { db, relay, puts, syncer } = sync({ on: true });
    relay.during = () => {
      createPlant(db, { speciesId: MONSTERA, nickname: 'Monty' });
      syncer.afterWrites();
    };

    await syncer.syncNow();
    await jest.advanceTimersByTimeAsync(DELAY);

    expect(puts.map((put) => put.plants.length)).toEqual([0, 1]);
  });

  test('tells a Snapshot over the relay cap apart, uploading nothing, and retries after the next write', async () => {
    let size = SNAPSHOT_CAP_BYTES + 1;
    const { puts, syncer } = sync({ on: true }, async (zip) =>
      size > SNAPSHOT_CAP_BYTES ? new Uint8Array(size) : zip,
    );

    await syncer.syncNow();
    expect(puts).toHaveLength(0);
    expect(syncer.status()).toMatchObject({
      problem: 'Too big to sync: 25.1 MB, over the 25 MB a Snapshot can hold',
      unsynced: false,
    });

    size = SNAPSHOT_CAP_BYTES;
    syncer.afterWrites();
    await jest.advanceTimersByTimeAsync(DELAY);
    expect(puts).toHaveLength(1);
  });

  test('hands every change of status to be kept on the device', async () => {
    const { statuses, syncer } = sync();

    await syncer.turnOn();

    expect(statuses.at(-1)).toEqual(syncer.status());
    expect(statuses[0]).toMatchObject({ on: true, unsynced: true });
  });
});

describe('Sync keys and Snapshots', () => {
  test('derive the garden id, write token and AES key from SHA-256 over a label and the key', async () => {
    const keys = await deriveSyncKeys(fromBase64url(fixture.key), sha256);

    expect(keys.gardenId).toBe(fixture.gardenId);
    expect(keys.writeToken).toBe(fixture.writeToken);
    expect(keys.encryptionKey).toEqual(
      await sha256(
        new Uint8Array([...new TextEncoder().encode('gf-enc'), ...fromBase64url(fixture.key)]),
      ),
    );
  });

  test("a Snapshot sealed by WebCrypto opens with the app's layout: iv, then ciphertext and tag", async () => {
    const { encryptionKey } = await deriveSyncKeys(fromBase64url(fixture.key), sha256);
    const aes = await subtle.importKey('raw', encryptionKey, 'AES-GCM', false, [
      'encrypt',
      'decrypt',
    ]);
    const snapshot = Uint8Array.from(Buffer.from(fixture.snapshot, 'base64'));
    const iv = snapshot.slice(0, SNAPSHOT_LAYOUT.ivLength);

    const opened = await subtle.decrypt({ name: 'AES-GCM', iv }, aes, snapshot.slice(iv.length));
    const resealed = await subtle.encrypt({ name: 'AES-GCM', iv }, aes, opened);

    expect(new TextDecoder().decode(opened)).toBe(fixture.plaintext);
    expect(new Uint8Array([...iv, ...new Uint8Array(resealed)])).toEqual(snapshot);
    expect(snapshot.length).toBe(
      SNAPSHOT_LAYOUT.ivLength + fixture.plaintext.length + SNAPSHOT_LAYOUT.tagLength,
    );
  });

  test('a Snapshot the app sealed (expo-crypto on Hermes, iOS simulator) opens with WebCrypto', async () => {
    const { encryptionKey } = await deriveSyncKeys(fromBase64url(fixture.key), sha256);
    const aes = await subtle.importKey('raw', encryptionKey, 'AES-GCM', false, ['decrypt']);
    const snapshot = Uint8Array.from(Buffer.from(fixture.hermes.snapshot, 'base64'));
    const iv = snapshot.slice(0, SNAPSHOT_LAYOUT.ivLength);

    const opened = await subtle.decrypt({ name: 'AES-GCM', iv }, aes, snapshot.slice(iv.length));

    expect(new TextDecoder().decode(opened)).toBe(fixture.hermes.plaintext);
  });

  test('keys travel as unpadded base64url, as a Pairing link carries them', () => {
    const key = fromBase64url(fixture.key);

    expect(key).toEqual(Uint8Array.from({ length: 32 }, (_, i) => i));
    expect(toBase64url(key)).toBe(fixture.key);
    expect(toBase64url(new Uint8Array([0xfb, 0xff]))).toBe('-_8');
  });
});
