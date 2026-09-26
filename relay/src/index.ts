// The blind relay (ADR-0006, spec #35): stores each garden's encrypted Snapshots in R2, one per
// UTC day for 7 days, under `<garden id>/<YYYY-MM-DD>`, beside `<garden id>/token`, the SHA-256 of
// the write token the first PUT claimed the id with. It never logs a body or a token.

const MAX_BYTES = 25 * 1024 * 1024;
const KEEP_DAYS = 7;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ROUTE = /^\/gardens\/([0-9a-f]{64})(?:\/snapshots(?:\/(\d{4}-\d{2}-\d{2}))?)?$/;

export default {
  async fetch(request, env): Promise<Response> {
    // Cloudflare always sets the client's IP; only local tests go without one.
    const ip = request.headers.get('CF-Connecting-IP');
    const limited = ip !== null && !(await env.LIMITER.limit({ key: ip })).success;
    const res = limited ? status(429) : await route(request, env);
    // Reads are simple GETs with no custom headers, so the Web view needs no preflight.
    res.headers.set('Access-Control-Allow-Origin', env.ALLOWED_ORIGIN);
    return res;
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  const match = ROUTE.exec(pathname);
  if (!match) return status(404);
  const [, id, day] = match;
  const listing = pathname.endsWith('/snapshots');
  const bucket = env.SNAPSHOTS;

  if (request.method === 'GET') {
    if (day) return snapshot(await bucket.get(`${id}/${day}`));
    const days = await listDays(bucket, id);
    if (listing) return Response.json(days);
    const latest = days.at(-1);
    return snapshot(latest ? await bucket.get(`${id}/${latest}`) : null);
  }

  if (day || listing) return status(405);
  if (request.method === 'PUT') return put(request, bucket, id);
  if (request.method === 'DELETE') return remove(request, bucket, id);
  return status(405);
}

async function put(request: Request, bucket: R2Bucket, id: string): Promise<Response> {
  // The runtime holds a body to its Content-Length, so checking the header bounds the read; a
  // chunked body could fill the Worker's memory before its size was known.
  const length = request.headers.get('Content-Length');
  if (length === null) return status(411);
  if (Number(length) > MAX_BYTES) return status(413);
  const body = await request.arrayBuffer();
  const denied = await checkToken(request, bucket, id, true);
  if (denied) return denied;

  const today = utcDay(0);
  await bucket.put(`${id}/${today}`, body);
  const cutoff = utcDay(KEEP_DAYS - 1);
  const stale = (await listDays(bucket, id)).filter((d) => d < cutoff);
  if (stale.length) await bucket.delete(stale.map((d) => `${id}/${d}`));
  return status(204);
}

async function remove(request: Request, bucket: R2Bucket, id: string): Promise<Response> {
  const denied = await checkToken(request, bucket, id, false);
  if (denied) return denied;
  const keys = (await bucket.list({ prefix: `${id}/` })).objects.map((o) => o.key);
  if (keys.length) await bucket.delete(keys);
  return status(204);
}

/** A refusal, or null once the bearer token matches the garden's (or claims it, on a first PUT). */
async function checkToken(
  request: Request,
  bucket: R2Bucket,
  id: string,
  claim: boolean,
): Promise<Response | null> {
  const token = /^Bearer (.+)$/.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!token) return status(401);
  const hash = await sha256(token);
  const stored = await bucket.get(`${id}/token`);
  if (!stored) {
    // ponytail: two first PUTs racing both claim; one writer per garden makes that moot.
    if (claim) await bucket.put(`${id}/token`, hash);
    return null;
  }
  return (await stored.text()) === hash ? null : status(403);
}

/** The days a garden has Snapshots for, oldest first (R2 lists keys in order). */
async function listDays(bucket: R2Bucket, id: string): Promise<string[]> {
  // At most 7 days and a token, well under a list page.
  const { objects } = await bucket.list({ prefix: `${id}/` });
  return objects.map((o) => o.key.slice(id.length + 1)).filter((d) => DAY.test(d));
}

function snapshot(object: R2ObjectBody | null): Response {
  if (!object) return status(404);
  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Last-Modified': object.uploaded.toUTCString(),
    },
  });
}

/** Snapshots are dated by UTC day, not the phone's local day (ADR-0005 is about Care Events). */
function utcDay(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function status(code: number): Response {
  return new Response(null, { status: code });
}
