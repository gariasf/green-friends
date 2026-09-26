import { strFromU8, unzipSync } from 'fflate';
import { webcrypto } from 'node:crypto';

import fixture from '../test/snapshot-fixture.json';
import { emptyDb } from '../test/db';
import { MONSTERA, gardenDb } from '../test/garden';
import { photoStore } from '../test/photos';
import { logCareEvent, listCareEventRows } from './careLog';
import { buildExport } from './export';
import { importExport } from './import';
import { createPlant, listPlantRows } from './plants';
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
 * hands over the Export as it is) or fail while `failing` is set. The relay's Snapshots by day are
 * in `snapshots`, and every call to it, and every new key, in `calls`, in order.
 */
function sync(status: Partial<SyncStatus> = {}, seal: SyncKeys['seal'] = async (zip) => zip) {
  const db = gardenDb();
  const puts: { gardenId: string; token: string; plants: unknown[] }[] = [];
  const statuses: SyncStatus[] = [];
  const calls: string[] = [];
  const key = { gardenId: 'garden', writeToken: 'token' };
  const relay = {
    failing: false,
    /** Runs while a put is on its way, once. */
    during: undefined as (() => void) | undefined,
    snapshots: new Map<string, Uint8Array>(),
    async put(gardenId: string, token: string, snapshot: Uint8Array) {
      calls.push(`put ${gardenId}`);
      if (relay.failing) throw new Error('Network request failed');
      const json = JSON.parse(strFromU8(unzipSync(snapshot)['export.json']));
      puts.push({ gardenId, token, plants: json.plants });
      const during = relay.during;
      relay.during = undefined;
      during?.();
    },
    async days(gardenId: string) {
      calls.push(`days ${gardenId}`);
      return [...relay.snapshots.keys()];
    },
    async get(gardenId: string, day: string) {
      calls.push(`get ${gardenId} ${day}`);
      const snapshot = relay.snapshots.get(day);
      if (!snapshot) throw new Error(`No Snapshot on ${day}`);
      return snapshot;
    },
    async remove(gardenId: string, token: string) {
      calls.push(`remove ${gardenId} ${token}`);
      if (relay.failing) throw new Error('Network request failed');
      relay.snapshots.clear();
    },
  };
  /** Makes a new key, as Reset sync does, and notes it in `calls`. */
  const newKey = () => {
    calls.push('new key');
    Object.assign(key, { gardenId: 'garden2', writeToken: 'token2' });
  };
  const syncer = createSync({
    db,
    files: photoStore().files,
    relay,
    // The fake seal sends the Export as it is, and so the fake open takes it back.
    keys: async () => ({ ...key, seal, open: async (snapshot) => snapshot }),
    appVersion: '1.2.3',
    status: { ...SYNC_OFF, ...status },
    onStatus: (next) => void statuses.push(next),
    delayMs: DELAY,
    now: () => NOW,
  });
  return { db, relay, puts, statuses, calls, newKey, syncer };
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

describe('Restore from sync', () => {
  /** A phone's Garden: a plant with a Care Event, and its Export. */
  function phone() {
    const db = gardenDb();
    const plant = createPlant(db, { speciesId: MONSTERA, nickname: 'Monty' }, NOW);
    logCareEvent(db, { plantId: plant.id, type: 'water', occurredOn: '2026-09-23' }, NOW);
    return { db, zip: buildExport(db, photoStore().files, '1.2.3', NOW) };
  }

  test("lists the relay's days for this garden", async () => {
    const { relay, syncer } = sync();
    relay.snapshots.set('2026-09-22', new Uint8Array());
    relay.snapshots.set('2026-09-23', new Uint8Array());

    expect(await syncer.days()).toEqual(['2026-09-22', '2026-09-23']);
  });

  test('restoring a Snapshot equals importing its Export', async () => {
    const { zip } = phone();
    const { db, relay, calls, syncer } = sync();
    relay.snapshots.set('2026-09-23', zip);
    const imported = gardenDb();
    importExport(imported, photoStore().files, emptyDb(), zip);

    await syncer.restore('2026-09-23', (run) => run(emptyDb()));

    expect(calls).toEqual(['get garden 2026-09-23']);
    expect(listPlantRows(db)).toEqual(listPlantRows(imported));
    expect(listCareEventRows(db)).toEqual(listCareEventRows(imported));
    expect(listPlantRows(db)).toEqual([expect.objectContaining({ nickname: 'Monty' })]);
  });
});

describe('Pairing a phone', () => {
  const noOffer = async () => false;

  test('an empty Garden is offered the latest Snapshot, restores it and turns Sync on without uploading', async () => {
    const source = gardenDb();
    createPlant(source, { speciesId: MONSTERA, nickname: 'Monty' }, NOW);
    const { db, relay, calls, newKey, syncer } = sync();
    relay.snapshots.set('2026-09-22', new Uint8Array());
    relay.snapshots.set('2026-09-23', buildExport(source, photoStore().files, '1.2.3', NOW));
    const offered: string[] = [];

    await syncer.pair(
      newKey,
      async (day) => offered.push(day) > 0,
      (run) => run(emptyDb()),
    );
    await jest.advanceTimersByTimeAsync(DELAY);

    expect(offered).toEqual(['2026-09-23']);
    expect(listPlantRows(db)).toEqual([expect.objectContaining({ nickname: 'Monty' })]);
    expect(calls).toEqual(['new key', 'days garden2', 'get garden2 2026-09-23']);
    expect(syncer.status()).toMatchObject({ on: true });
  });

  test("an empty Garden that declines the restore uploads nothing, so today's Snapshot stays", async () => {
    const { relay, calls, newKey, syncer } = sync();
    relay.snapshots.set('2026-09-23', new Uint8Array());

    await syncer.pair(newKey, noOffer, (run) => run(emptyDb()));
    await jest.advanceTimersByTimeAsync(DELAY);

    expect(calls).toEqual(['new key', 'days garden2']);
    expect(syncer.status()).toMatchObject({ on: true });
  });

  test('a Garden with plants is offered nothing and uploads under the new key', async () => {
    const { db, calls, newKey, syncer } = sync();
    createPlant(db, { speciesId: MONSTERA, nickname: 'Monty' });

    await syncer.pair(newKey, noOffer, (run) => run(emptyDb()));

    expect(calls).toEqual(['new key', 'put garden2']);
  });

  test('turns Sync on even when the restore fails', async () => {
    const { relay, newKey, syncer } = sync();
    relay.snapshots.set('2026-09-23', new Uint8Array([1, 2, 3]));

    await expect(
      syncer.pair(
        newKey,
        async () => true,
        (run) => run(emptyDb()),
      ),
    ).rejects.toThrow();

    expect(syncer.status()).toMatchObject({ on: true });
  });

  test('keeps the new key only after an upload on its way', async () => {
    const { db, calls, newKey, syncer } = sync({ on: true });
    createPlant(db, { speciesId: MONSTERA, nickname: 'Monty' });

    void syncer.syncNow();
    await syncer.pair(newKey, noOffer, (run) => run(emptyDb()));

    expect(calls).toEqual(['put garden', 'new key', 'put garden2']);
  });
});

describe('Reset sync', () => {
  test('deletes the garden on the relay before the new key is kept, then uploads under it', async () => {
    const { relay, calls, newKey, syncer } = sync({
      on: true,
      syncedAt: '2026-09-20T00:00:00.000Z',
    });
    relay.snapshots.set('2026-09-23', new Uint8Array());

    await syncer.reset(newKey);
    await jest.advanceTimersByTimeAsync(0);

    expect(calls).toEqual(['remove garden token', 'new key', 'put garden2']);
    expect(relay.snapshots.size).toBe(0);
    expect(syncer.status()).toMatchObject({ syncedAt: '2026-09-23T20:00:00.000Z', problem: null });
  });

  test('waits for an upload on its way, so none lands under the old key after the delete', async () => {
    const { calls, newKey, syncer } = sync({ on: true });

    void syncer.syncNow();
    await syncer.reset(newKey);
    await jest.advanceTimersByTimeAsync(0);

    expect(calls).toEqual(['put garden', 'remove garden token', 'new key', 'put garden2']);
  });

  test('keeps the key when the relay refuses the delete', async () => {
    const { relay, calls, newKey, syncer } = sync({ on: true });
    relay.failing = true;

    await expect(syncer.reset(newKey)).rejects.toThrow('Network request failed');

    expect(calls).toEqual(['remove garden token']);
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
