# Expo / React Native

Green Friends is an Expo (CNG) app: `app/` holds expo-router routes, `src/core` the plain-TypeScript domain, `src/db` the Drizzle schema, migrations and the expo-sqlite handle. See ADR-0001.

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
npm run ios                  # local dev build on the simulator (npx expo run:ios)
npx expo-doctor              # diagnose dependency and config issues
```

Run test, lint and typecheck before declaring any task done.

## House rules

- `src/core` never imports React, React Native, Expo, or `src/db/client` (enforced by eslint). Core functions take the `Db` handle as their first argument; tests hand them an in-memory database via `src/test/db.ts`.
- Every write goes through a `src/core` mutation function; components never call `db.insert/update/delete`.
- Schema changes: edit `src/db/schema.ts`, run `npm run db:generate`, review the new SQL in `drizzle/`. Migrations are forward-only; the schema version is SQLite's `PRAGMA user_version`.
- `ios/` and `android/` are generated (CNG). Never edit them; configure native behaviour in `app.json` and config plugins.
- Native modules (sqlite, notifications) need a dev build, not Expo Go: `npm run ios`.
- `react-dom` is pinned to the same version as `react` only so npm can resolve expo-router's transitive web peers (there is no web target, ADR-0001). Removing it reintroduces an `ERESOLVE` on install; bump it together with `react`.
