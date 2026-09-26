# Relay

`relay/` is Sync's blind relay (ADR-0006, spec #35): a Cloudflare Worker that keeps each garden's encrypted Snapshots in R2, one per UTC day for 7 days. It's its own npm package, TypeScript run by Wrangler, outside the Expo app: root `npm test` and `npm run typecheck` leave it out (`tsconfig.json` excludes it), root `npm run lint` covers it.

## Routes

- `PUT /gardens/:id` stores today's Snapshot (replacing today's earlier one) and drops any from before the last 7 days (today and the 6 before it). It needs `Authorization: Bearer <write token>`. The first PUT claims the id by storing the token's SHA-256 beside the Snapshots; later PUTs and `DELETE` must match it (401 without a token, 403 with a wrong one). Bodies over 25 MB get 413, and a body without a `Content-Length` 411, since its size can't be checked before it's read.
- `GET /gardens/:id` serves the latest Snapshot, dated by `Last-Modified`. `GET /gardens/:id/snapshots` lists the days, oldest first, and `GET /gardens/:id/snapshots/:day` serves one.
- `DELETE /gardens/:id` removes the Snapshots and the token, so the id can be claimed again.
- Reads are open (ciphertext, and a 256-bit id can't be guessed). Every response allows the Web view's origin, `ALLOWED_ORIGIN` in `relay/wrangler.toml`. A client IP gets 60 requests a minute (the `LIMITER` binding), since `*.workers.dev` has no zone for WAF rules.

## Commands

```bash
npm --prefix relay ci        # the relay's own dependencies (root npm install doesn't reach them)
npm run relay:test           # vitest in the Workers runtime (@cloudflare/vitest-pool-workers), over local R2
npm --prefix relay run typecheck  # regenerates worker-configuration.d.ts (git-ignored) from wrangler.toml, then tsc
npm --prefix relay run dev   # wrangler dev, local R2
npm run relay:deploy         # wrangler deploy, by hand (no CI deploys)
```

A first deploy, by the owner: `cd relay && npx wrangler login`, then `npx wrangler r2 bucket create green-friends-snapshots`, then `npm run relay:deploy`. It lives at `https://green-friends-relay.gariasf.workers.dev` (first deployed 2026-09-26).

## House rules

- Never commit a Cloudflare API token or account id. `wrangler login` keeps its OAuth token in the user's home directory; a `CLOUDFLARE_API_TOKEN`, if one is ever needed, stays in the shell or a git-ignored `.env*.local`.
- The Worker never logs a request body, a token or its hash, and holds nothing it could decrypt: the key never leaves the phone and the Pairing link's `#` fragment.
- `compatibility_date` can't be newer than the `workerd` that `@cloudflare/vitest-pool-workers` bundles, or the tests won't start; bump the two together.
- After editing `wrangler.toml`'s bindings or vars, run the typecheck so `Env` follows.
