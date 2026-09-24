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
- Every write goes through a `src/core` mutation function; components never call `db.insert/update/delete`. Screens that must react to writes subscribe with Drizzle's `useLiveQuery` to a query builder the core exports (`careLogQuery`); it re-runs on changes to the query's primary table only. A screen over several tables (Today over `evaluateCare`, the Garden and the archived view over plants and their photos) instead reads again through `useAfterWrites` (`src/ui/useAfterWrites.ts`), expo-sqlite's `addDatabaseChangeListener` debounced because it fires once per changed row; Today and the Daily Digests are also planned again when the app returns to the foreground, where the day may have turned (`useAfterWritesOrForeground`, same file).
- Side effects outside the database go through a small adapter the core function takes after `Db` (spec #8, Testing Decisions); tests pass a fake. The first is `PhotoFiles` (`src/core/photos.ts`), implemented by `photoFiles` in `src/ui/Photo.tsx` over `Documents/photos/`. The database stores a photo's filename only, since the app container's absolute path moves between installs; `photoUri` resolves it at render time. `PendingNotifications` (`src/core/digest.ts`) replaces the pending Daily Digests; `src/ui/useDigests.ts` implements it over expo-notifications and, from the root layout, plans them again at launch, after every burst of writes and on returning to the foreground, so no mutation has to remember to. `ShareSheet` (`src/core/export.ts`) takes an Export's zip, which the core builds in memory with fflate (plain JavaScript, so seam tests open the very zip that would be shared) from photo files read through `PhotoFiles`; `app/settings.tsx` implements it over expo-sharing. Import (`importExport`, `src/core/import.ts`) takes the picked zip's bytes, writes its photos through `PhotoFiles.write`, and takes a second, empty database to bring the Export's rows up to the current schema in: `withScratchDb` (`src/db/client.ts`) opens one in memory, tests pass `emptyDb()` (`src/test/db.ts`). The document picker is expo-file-system's `File.pickFileAsync`, not expo-document-picker.
- Row ids come from the standard `crypto.randomUUID()` inside core. Hermes has no WebCrypto, so `app/_layout.tsx` installs Expo's native generator at boot; never import `expo-*` into core for ids.
- Care Events are dated by local calendar day, `occurred_on` as `'YYYY-MM-DD'` (ADR-0005). Use `localDay` / `shiftDays` from `src/core/dates.ts`, never `toISOString().slice(0, 10)`. Tests run under `TZ=Pacific/Auckland` (jest `globalSetup`, `src/test/timezone.js`) so a day computed through UTC fails; build test dates with the local `Date` constructor when the day matters.
- Due-ness is never stored. `evaluateCare` / `listNeedsAttention` in `src/core/care.ts` derive it on every call from the Care Log, the effective schedule (ADR-0003) and the Season settings; they take `today` as a local calendar day, which tests pass explicitly. Both go through `forecastCare`, which reads the database once and evaluates any day; the Daily Digest planner (`planDigests`, `src/core/digest.ts`) asks it day after day.
- Adding a route: after creating the file under `app/`, regenerate the typed-routes declaration (`npx expo customize tsconfig.json`, or start the dev server once) or `npm run typecheck` rejects the new `href`.
- Sheets (the plant sheet, a Care Event's edit sheet) are routes presented with the shared `SHEET` options in `app/_layout.tsx`: a native `formSheet` sized to its content, opaque because the iOS 26 glass default turns dark under the dimmed screen. A screen pushed from a sheet lands beneath it, so a sheet moves on with `router.replace`.
- Schema changes: edit `src/db/schema.ts`, run `npm run db:generate`, review the new SQL in `drizzle/`. Migrations are forward-only; the schema version is SQLite's `PRAGMA user_version`. An Import runs them on an older Export's rows too, in a database holding nothing else (no Species catalog), so a data migration must not depend on the catalog (ADR-0002). Then `npx jest --clearCache`: the SQL is inlined into `drizzle/migrations.js` at transform time and jest caches the result, so an edited or regenerated migration otherwise runs stale in tests ("no such table").
- Species catalog changes: edit `scripts/species/curated.json` (IDs are Wikidata QIDs, append-only, ADR-0004), bump its `version` whenever species content changes, run `npm run species:build`. Never hand-edit `assets/species.json`; the app reseeds the read-only `species` table when the bundled version is newer.
- `ios/` and `android/` are generated (CNG). Never edit them; configure native behaviour in `app.json` and config plugins.
- iOS 27 refuses to launch an app built with its SDK unless the app adopts the UIKit scene life cycle (the crash names `UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`). SDK 57's template doesn't, so `plugins/withSceneLifecycle.js` backports SDK 58's wiring: a scene manifest naming Expo's `EXExpoAppSceneDelegate`, and an `AppDelegate` that leaves the window and React Native's start to it. Delete the plugin when upgrading to SDK 58.
- Native modules (sqlite, notifications, sharing) need a dev build, not Expo Go: `npm run ios`.
- expo-notifications' config plugin runs on every prebuild without an `app.json` entry (one of Expo's automatic plugins) and adds an `aps-environment` entitlement, so the signing team needs the Push Notifications capability, which automatic signing adds. The app schedules local notifications only and never registers for push.
- `react-dom` is pinned to the same version as `react` only so npm can resolve expo-router's transitive web peers (there is no web target, ADR-0001). Removing it reintroduces an `ERESOLVE` on install; bump it together with `react`.
- Adding a root dependency: `npx expo install` can write `package.json` and then fail npm's resolution (observed 2026-09-22: `ERESOLVE` on `react-native-worklets`, a peerOptional of `expo-modules-core`), leaving `package-lock.json` untouched. Check `git diff package-lock.json`; never fall back to `--legacy-peer-deps`. `expo-modules-core` itself is imported as the transitive `expo` pins, not declared, for this reason.
