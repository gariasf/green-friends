import { env, exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

const BASE = 'https://relay.test';
const TOKEN = 'write-token';

let next = 0;
/** A fresh 64-hex garden id per test, so no test sees another's Snapshots. */
function gardenId(): string {
  next += 1;
  return next.toString(16).padStart(64, '0');
}

function relay(path: string, init?: RequestInit): Promise<Response> {
  return exports.default.fetch(new Request(BASE + path, init));
}

function put(
  id: string,
  body: BodyInit,
  token: string | null = TOKEN,
  appToken: string | null = env.APP_TOKEN,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
    ...(appToken === null ? {} : { 'X-App-Token': appToken }),
  };
  return relay(`/gardens/${id}`, { method: 'PUT', headers, body });
}

function del(id: string, token: string | null = TOKEN): Promise<Response> {
  const headers: Record<string, string> =
    token === null ? {} : { Authorization: `Bearer ${token}` };
  return relay(`/gardens/${id}`, { method: 'DELETE', headers });
}

function utcDay(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

describe('the relay', () => {
  it('stores a Snapshot on the first PUT and serves it back with its date', async () => {
    const id = gardenId();
    expect((await put(id, 'sealed-1')).status).toBe(204);

    const res = await relay(`/gardens/${id}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('sealed-1');
    expect(new Date(res.headers.get('Last-Modified')!).getTime()).toBeGreaterThan(0);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(env.ALLOWED_ORIGIN);
  });

  it('lets only the token that claimed a garden write to it', async () => {
    const id = gardenId();
    await put(id, 'sealed-1');

    expect((await put(id, 'forged', null)).status).toBe(401);
    expect((await put(id, 'forged', 'other-token')).status).toBe(403);
    expect((await del(id, null)).status).toBe(401);
    expect((await del(id, 'other-token')).status).toBe(403);
    expect(await (await relay(`/gardens/${id}`)).text()).toBe('sealed-1');
  });

  it('lets only the app create or write a garden', async () => {
    const id = gardenId();

    expect((await put(id, 'squatter', 'their-token', null)).status).toBe(403);
    expect((await put(id, 'squatter', 'their-token', 'guessed')).status).toBe(403);
    expect((await relay(`/gardens/${id}`)).status).toBe(404);
    expect(await env.SNAPSHOTS.get(`${id}/token`)).toBeNull();

    await put(id, 'sealed-1');
    expect((await put(id, 'forged', TOKEN, null)).status).toBe(403);
    expect(await (await relay(`/gardens/${id}`)).text()).toBe('sealed-1');
  });

  it('never stores the token itself', async () => {
    const id = gardenId();
    await put(id, 'sealed-1');

    const listed = await env.SNAPSHOTS.list({ prefix: `${id}/` });
    for (const { key } of listed.objects) {
      expect(await (await env.SNAPSHOTS.get(key))!.text()).not.toContain(TOKEN);
    }
  });

  it('refuses a body over 25 MB', async () => {
    const id = gardenId();
    const res = await put(id, new Uint8Array(25 * 1024 * 1024 + 1));

    expect(res.status).toBe(413);
    expect((await relay(`/gardens/${id}`)).status).toBe(404);
  });

  it('accepts a body of exactly 25 MB', async () => {
    const id = gardenId();
    expect((await put(id, new Uint8Array(25 * 1024 * 1024))).status).toBe(204);
  });

  it('refuses a body without a Content-Length, whose size it can’t check before reading', async () => {
    const id = gardenId();
    const chunked = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('sealed'));
        controller.close();
      },
    });

    expect((await put(id, chunked)).status).toBe(411);
    expect((await relay(`/gardens/${id}`)).status).toBe(404);
  });

  it('replaces the day’s Snapshot on a second PUT the same day', async () => {
    const id = gardenId();
    await put(id, 'morning');
    await put(id, 'evening');

    expect(await (await relay(`/gardens/${id}/snapshots`)).json()).toEqual([utcDay(0)]);
    expect(await (await relay(`/gardens/${id}`)).text()).toBe('evening');
  });

  it('keeps only the last 7 days of Snapshots, pruning on each PUT', async () => {
    const id = gardenId();
    await put(id, 'claim');
    for (const daysAgo of [10, 7, 6, 3]) {
      await env.SNAPSHOTS.put(`${id}/${utcDay(daysAgo)}`, `sealed-${daysAgo}`);
    }

    await put(id, 'today');

    expect(await (await relay(`/gardens/${id}/snapshots`)).json()).toEqual([
      utcDay(6),
      utcDay(3),
      utcDay(0),
    ]);
  });

  it('serves the latest Snapshot, and any listed day', async () => {
    const id = gardenId();
    await put(id, 'today');
    await env.SNAPSHOTS.put(`${id}/${utcDay(2)}`, 'two days ago');

    expect(await (await relay(`/gardens/${id}`)).text()).toBe('today');
    const day = await relay(`/gardens/${id}/snapshots/${utcDay(2)}`);
    expect(day.status).toBe(200);
    expect(await day.text()).toBe('two days ago');
    expect((await relay(`/gardens/${id}/snapshots/${utcDay(1)}`)).status).toBe(404);
  });

  it('finds nothing for a garden that never synced', async () => {
    const id = gardenId();

    expect((await relay(`/gardens/${id}`)).status).toBe(404);
    expect(await (await relay(`/gardens/${id}/snapshots`)).json()).toEqual([]);
  });

  it('removes everything on DELETE, so a new token can claim the id', async () => {
    const id = gardenId();
    await put(id, 'sealed-1');
    await env.SNAPSHOTS.put(`${id}/${utcDay(2)}`, 'two days ago');

    expect((await del(id)).status).toBe(204);

    expect((await relay(`/gardens/${id}`)).status).toBe(404);
    expect(await (await relay(`/gardens/${id}/snapshots`)).json()).toEqual([]);
    expect((await put(id, 'fresh', 'new-token')).status).toBe(204);
  });

  it('turns away a client IP past 60 requests a minute', async () => {
    const id = gardenId();
    const fromOneIp = () =>
      relay(`/gardens/${id}`, { headers: { 'CF-Connecting-IP': '203.0.113.7' } });
    for (let i = 0; i < 60; i++) expect((await fromOneIp()).status).toBe(404);

    expect((await fromOneIp()).status).toBe(429);
  });

  it('answers 404 to anything that isn’t a garden route', async () => {
    expect((await relay('/gardens/not-hex')).status).toBe(404);
    expect((await relay(`/gardens/${gardenId()}/snapshots/yesterday`)).status).toBe(404);
    expect((await relay('/')).status).toBe(404);
  });
});
