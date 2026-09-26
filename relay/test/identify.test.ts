import { env, exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';

const PHOTO = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

const monstera = {
  score: 0.64,
  species: {
    scientificNameWithoutAuthor: 'Monstera deliciosa',
    genus: { scientificNameWithoutAuthor: 'Monstera' },
  },
  gbif: { id: '2868241' },
};
const noGbif = {
  score: 0.07,
  species: {
    scientificNameWithoutAuthor: 'Rhaphidophora tetrasperma',
    genus: { scientificNameWithoutAuthor: 'Rhaphidophora' },
  },
};

/**
 * Pl@ntNet answering `answer()` to whatever the Worker sends; returns the spy to inspect the call.
 * The Response is made inside the Worker's request, since a body can't cross requests.
 */
function plantNet(answer: () => Response) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => answer());
}

function identify(body: BodyInit = PHOTO, method = 'POST'): Promise<Response> {
  return exports.default.fetch(
    new Request('https://relay.test/identify', {
      method,
      headers: { 'Content-Type': 'image/jpeg' },
      body: method === 'POST' ? body : undefined,
    }),
  );
}

/** Everything a client sees of a response, to check the key is nowhere in it. */
async function seen(res: Response): Promise<string> {
  return [...res.headers].flat().join('\n') + (await res.text());
}

afterEach(() => vi.restoreAllMocks());

describe('POST /identify', () => {
  it('forwards the photo to Pl@ntNet and answers its candidates', async () => {
    const upstream = plantNet(() =>
      Response.json({ results: [monstera, noGbif], remainingIdentificationRequests: 420 }),
    );

    const res = await identify();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { name: 'Monstera deliciosa', genus: 'Monstera', gbif: 2868241, score: 0.64 },
      { name: 'Rhaphidophora tetrasperma', genus: 'Rhaphidophora', gbif: null, score: 0.07 },
    ]);
    const [url, init] = upstream.mock.calls[0] as [string, RequestInit];
    const sent = new URL(url);
    expect(sent.origin + sent.pathname).toBe('https://my-api.plantnet.org/v2/identify/useful');
    expect(sent.searchParams.get('api-key')).toBe(env.PLANTNET_KEY);
    expect(sent.searchParams.get('nb-results')).toBe('20');
    const form = init.body as FormData;
    expect(form.get('organs')).toBe('auto');
    expect(new Uint8Array(await (form.get('images') as File).arrayBuffer())).toEqual(PHOTO);
  });

  it('answers [] when Pl@ntNet finds no plant', async () => {
    plantNet(() => Response.json({ message: 'Species not found' }, { status: 404 }));
    const res = await identify();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('refuses with 429 once the day’s quota drops below 50', async () => {
    plantNet(() => Response.json({ results: [monstera], remainingIdentificationRequests: 49 }));
    expect((await identify()).status).toBe(429);
  });

  it('passes on Pl@ntNet’s 429 with its Retry-After', async () => {
    plantNet(() => new Response('Too many', { status: 429, headers: { 'Retry-After': '3600' } }));
    const res = await identify();
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('3600');
  });

  it('answers 502 when Pl@ntNet fails or can’t be reached', async () => {
    plantNet(() => new Response('Oops', { status: 500 }));
    expect((await identify()).status).toBe(502);
    vi.restoreAllMocks();
    plantNet(() => Response.json({ error: 'odd' }));
    expect((await identify()).status).toBe(502);
    vi.restoreAllMocks();
    plantNet(() => {
      throw new Error(`fetch failed for ?api-key=${env.PLANTNET_KEY}`);
    });
    const res = await identify();
    expect(res.status).toBe(502);
    expect(await seen(res)).not.toContain(env.PLANTNET_KEY);
  });

  it('refuses a body without a Content-Length, one over 5 MB, and other methods', async () => {
    const upstream = plantNet(() => Response.json({ results: [] }));
    const chunked = new ReadableStream({
      start(controller) {
        controller.enqueue(PHOTO);
        controller.close();
      },
    });

    expect((await identify(chunked)).status).toBe(411);
    expect((await identify(new Uint8Array(5 * 1024 * 1024 + 1))).status).toBe(413);
    expect((await identify(undefined, 'GET')).status).toBe(405);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('never shows the key in a response', async () => {
    const answers = [
      () => Response.json({ results: [monstera], remainingIdentificationRequests: 420 }),
      () => Response.json({ results: [monstera], remainingIdentificationRequests: 1 }),
      () => new Response(`bad key ${env.PLANTNET_KEY}`, { status: 401 }),
      () => new Response(null, { status: 404 }),
    ];
    for (const answer of answers) {
      plantNet(answer);
      expect(await seen(await identify())).not.toContain(env.PLANTNET_KEY);
      vi.restoreAllMocks();
    }
  });
});
