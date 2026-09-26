# Web view

`web/` is Sync's read-only Web view (ADR-0006, spec #35): a Vite + React single-page app that opens the latest Snapshot in the browser. It's its own npm package, like `relay/`: root `npm test` and `npm run typecheck` leave it out (`tsconfig.json` excludes it), root `npm run lint` covers it.

## How it works

- It imports the app's own `../src/core`, `../src/db`, `../drizzle` and `../assets/species.json` directly (no workspace, ADR-0001). drizzle-orm and fflate resolve from the root `node_modules`, so `web/` never installs its own copy. `vite.config.ts` turns each `drizzle/*.sql` into a string, as babel's inline-import does for the app, and lets the dev server read one level up.
- `web/src/garden.ts` (`openGarden`): a sql.js database through drizzle-orm's `sql-js` driver, migrated by the app's `migrate`, seeded with the bundled catalog (an Export never carries it, ADR-0002), and the Snapshot's Export run through `importExport`, photos held in memory, a second sql.js database as scratch. Core reads it as it reads the phone's.
- `web/src/snapshot.ts`: the key from a Pairing link's `#k=` (32 bytes), kept in IndexedDB and then cleared from the address bar (a browser that won't keep it keeps the link instead); ids and the AES key from `deriveSyncKeys` over WebCrypto; `GET /gardens/:id` from `RELAY_URL` (`src/core/sync.ts`, shared with the phone), opened as `iv | ciphertext | tag`. "Synced" is the relay's `Last-Modified`.
- Screens (`web/src/screens.tsx`): Today, and the Garden as panes like Mail or Notes, the list beside the plant chosen at `#/plant/<id>` (`#/garden` alone chooses none; below 60rem, the list or the plant with a way back), read with core's own reads and the app's words from `src/ui/words.ts`, which imports nothing from React Native so both can use it. They sit in a shell (`App.tsx`, spec #41): a sidebar with the app's mark, Today and Garden with their counts, and Synced at its foot, folding into a top bar below 60rem. `web/src/icons.tsx` draws what the app shows with SF Symbols and its icon: each care type's symbol after CARE_COPY's, in its hue, the leaf on Ecru for a plant without a photo, and the mark from `assets/icon.svg`. The type is Nunito Sans, bundled from `@fontsource-variable/nunito-sans` (Latin subsets load by `unicode-range`), on the size scale at the top of `app.css`; the app itself stays on iOS's system font. Its colours are `src/ui/theme.ts`'s, mirrored as CSS custom properties in `web/src/app.css`: change theme.ts, then app.css. One departs: light mode's secondary label is iOS's Increase Contrast grey, since iOS's own reads 3.3:1 on the page.
- A Snapshot with a newer `schema_version` throws `NewerExportError` (`src/core/import.ts`), which the page shows as "This page needs an update". So the Web view deploys from the same commit as each app release.
- Open in Green Friends (hidden where the pointer can hover) hands the key to the app as `greenfriends://pair#k=…`, so a new phone pairs and restores from the Web view. After Reset sync the old key's garden is gone, and the page says No Garden found.
- A Pairing link pasted into an open tab changes only the fragment, which reloads nothing, so the page loads again on a `hashchange` carrying a key.

## Commands

```bash
npm --prefix web ci          # the Web view's own dependencies (root npm install doesn't reach them)
npm run web:test             # vitest in Node: the smoke test (a phone's Export opened through sql.js) and the Snapshot's opening
npm --prefix web run typecheck
npm --prefix web run dev     # vite; it reads the deployed relay, whose CORS allows only the deployed origin
npm run web:deploy           # vite build, then wrangler deploy, by hand (no CI deploys)
```

It lives at `https://green-friends.gariasf.workers.dev` (first deployed 2026-09-26): static assets on a Worker, `web/wrangler.toml`. Spec #35 planned `*.pages.dev`, but Cloudflare now backs a new Pages project with Workers static assets on the account's `workers.dev` subdomain. That origin is the relay's `ALLOWED_ORIGIN` and the base of the phone's Pairing link (`WEB_VIEW`, `src/ui/useSync.ts`); change all three together, then deploy the relay.

## House rules

- `react` and `react-dom` are pinned to the root's version; bump all four together.

- The key never leaves the browser but through Open in Green Friends, a link to the app on the same device: no request carries it, nothing logs it, and the page sends no referrer.
- A browser check needs a Snapshot on the relay. Seed a throwaway garden from Node (core's `buildExport`, sealed with WebCrypto under a random key), open its link, then `DELETE /gardens/:id` with its write token.
