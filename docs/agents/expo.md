# Expo / React Native

Green Friends is an Expo (CNG) app: `app/` holds expo-router routes, `src/core` the plain-TypeScript domain, `src/db` the Drizzle schema, migrations and the expo-sqlite handle, `src/ui` shared components, `scripts/` build-time tooling, TypeScript run directly by Node 24 or later (`engines` in `package.json`). See ADR-0001.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. Before writing code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common misconceptions. Follow its links; never answer from memory.

## Commands

```bash
npx expo install <package>   # ALWAYS use instead of npm add — resolves SDK-compatible versions
npm test                     # jest-expo: core seam tests against in-memory SQLite
npm run lint                 # eslint (expo config) + prettier
npm run typecheck            # tsc --noEmit
npm run db:generate          # drizzle-kit: regenerate drizzle/ after editing src/db/schema.ts
npm run species:build        # regenerate assets/species.json from scripts/species/curated.json (queries Wikidata)
npm run species:coverage     # Open Plantbook coverage spot-check; reads OPENPLANTBOOK_CLIENT_ID / _SECRET from .env.local (git-ignored)
npm run ios                  # local dev build on the simulator (npx expo run:ios)
npx expo-doctor              # diagnose dependency and config issues
```

Run test, lint and typecheck before declaring any task done.

## House rules

- `src/core` never imports React, React Native, Expo, or `src/db/client` (enforced by eslint). Core functions take the `Db` handle as their first argument; tests hand them an in-memory database via `src/test/db.ts`.
- Every write goes through a `src/core` mutation function; components never call `db.insert/update/delete`. Screens that must react to writes subscribe with Drizzle's `useLiveQuery` to a query builder the core exports (`plantListQuery`); it re-runs on changes to the query's primary table only. Today shows derived care state (`evaluateCare` reads plants, the Care Log, Species and settings), so it instead re-evaluates on every write through expo-sqlite's `addDatabaseChangeListener`, which fires once per changed row, and when the app returns to the foreground.
- Row ids come from the standard `crypto.randomUUID()` inside core. Hermes has no WebCrypto, so `app/_layout.tsx` installs Expo's native generator at boot; never import `expo-*` into core for ids.
- Care Events are dated by local calendar day, `occurred_on` as `'YYYY-MM-DD'` (ADR-0005). Use `localDay` / `shiftDays` from `src/core/dates.ts`, never `toISOString().slice(0, 10)`. Tests run under `TZ=Pacific/Auckland` (jest `globalSetup`, `src/test/timezone.js`) so a day computed through UTC fails; build test dates with the local `Date` constructor when the day matters.
- Due-ness is never stored. `evaluateCare` / `listNeedsAttention` in `src/core/care.ts` derive it on every call from the Care Log, the effective schedule (ADR-0003) and the Season settings; they take `today` as a local calendar day, which tests pass explicitly.
- Adding a route: after creating the file under `app/`, regenerate the typed-routes declaration (`npx expo customize tsconfig.json`, or start the dev server once) or `npm run typecheck` rejects the new `href`.
- Schema changes: edit `src/db/schema.ts`, run `npm run db:generate`, review the new SQL in `drizzle/`. Migrations are forward-only; the schema version is SQLite's `PRAGMA user_version`. Then `npx jest --clearCache`: the SQL is inlined into `drizzle/migrations.js` at transform time and jest caches the result, so an edited or regenerated migration otherwise runs stale in tests ("no such table").
- Species catalog changes: edit `scripts/species/curated.json` (IDs are Wikidata QIDs, append-only, ADR-0004), bump its `version` whenever species content changes, run `npm run species:build`. Never hand-edit `assets/species.json`; the app reseeds the read-only `species` table when the bundled version is newer.
- `ios/` and `android/` are generated (CNG). Never edit them; configure native behaviour in `app.json` and config plugins.
- Native modules (sqlite, notifications) need a dev build, not Expo Go: `npm run ios`.
- `react-dom` is pinned to the same version as `react` only so npm can resolve expo-router's transitive web peers (there is no web target, ADR-0001). Removing it reintroduces an `ERESOLVE` on install; bump it together with `react`.
- Adding a root dependency: `npx expo install` can write `package.json` and then fail npm's resolution (observed 2026-09-22: `ERESOLVE` on `react-native-worklets`, a peerOptional of `expo-modules-core`), leaving `package-lock.json` untouched. Check `git diff package-lock.json`; never fall back to `--legacy-peer-deps`. `expo-modules-core` itself is imported as the transitive `expo` pins, not declared, for this reason.
