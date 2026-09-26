import { expect, test } from 'vitest';

import { RELAY_URL, fromBase64url } from '../../src/core/sync';
import fixture from '../../src/test/snapshot-fixture.json';
import { keyFromFragment, loadSnapshot } from './snapshot';

const bytes = (base64: string) => Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

test("the latest Snapshot, the app's own (sealed on Hermes), opens with the key alone, dated by the relay", async () => {
  const asked: string[] = [];
  const relay = async (url: string) => {
    asked.push(url);
    return new Response(bytes(fixture.hermes.snapshot), {
      headers: { 'Last-Modified': 'Sat, 26 Sep 2026 10:06:31 GMT' },
    });
  };

  const snapshot = await loadSnapshot(fromBase64url(fixture.key), relay);

  expect(asked).toEqual([`${RELAY_URL}/gardens/${fixture.gardenId}`]);
  expect(new TextDecoder().decode(snapshot?.zip)).toBe(fixture.hermes.plaintext);
  expect(snapshot?.takenAt).toEqual(new Date('2026-09-26T10:06:31Z'));
});

test('a garden the relay has no Snapshot for is none', async () => {
  const relay = async () => new Response(null, { status: 404 });

  expect(await loadSnapshot(fromBase64url(fixture.key), relay)).toBeNull();
});

test('a Pairing link carries a 32-byte key after #k=, and nothing else is one', () => {
  expect(keyFromFragment(`#k=${fixture.key}`)).toEqual(fromBase64url(fixture.key));
  expect(keyFromFragment('')).toBeNull();
  expect(keyFromFragment('#k=AAEC')).toBeNull();
  expect(keyFromFragment('#k=not base64!')).toBeNull();
});
