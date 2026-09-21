# ADR-0001: v1 app architecture & stack

Status: accepted (2026-09-21) · Ticket: [#2](https://github.com/gariasf/green-friends/issues/2)

Green Friends v1 is a local-first, single-device iOS app built by a solo dev (React Native background, no Swift) on a boring/minimal budget. Within the locked lane (Expo/React Native, TypeScript, iOS-first) we pin the stack as follows, optimising for zero recurring cost, offline operation, and not boxing out a later web client or sync effort.

## Decisions

- **Workflow & builds**: Expo managed with CNG (prebuild). Dev builds locally via `npx expo run:ios` (free, Xcode). EAS free tier → TestFlight for long-lived personal installs. No bare workflow; Expo Go insufficient (SQLite + local notifications need a dev build).
- **Storage**: `expo-sqlite` + Drizzle ORM (typed schema, migrations, `useLiveQuery`). Single database.
- **Species catalog**: build script generates `species.json` (bundled asset) from the open-data pipeline decided in ticket #4; the app seeds it into a read-only `species` table on first launch and reseeds when the bundled dataset version exceeds the seeded version. **Perenual online autofill is out of v1** — bundled catalog + manual entry only.
- **Navigation**: `expo-router`.
- **Reminders**: `expo-notifications`, local scheduled only. The database's care-schedule state is the source of truth; pending iOS notifications are a *projection*, recomputed (cancel + reschedule) whenever care state changes, as a rolling window because iOS caps pending local notifications at 64.
- **Photos**: `expo-image-picker` (camera + library), resized/compressed on save (~1600px JPEG) into the app documents dir under `photos/`; the DB stores relative filenames. No blobs in SQLite, no full-res originals.
- **Web posture**: no RN-web target. Domain/care-engine/export logic lives in `src/core` as plain TS (no `react-native` imports); a future web client is a new UI over the same core.
- **Export/import**: zip containing a schema-versioned `export.json` + `photos/`. Share sheet out (`expo-sharing`), document picker in. Format details finalise after the sync research (#5).
- **Repo & tooling**: single Expo app at repo root (`app/` routes, `src/core`, `src/db`, `scripts/`); npm; no client-state library (Drizzle live queries + React state); `jest-expo` unit tests for `src/core` only; TypeScript `strict`, `eslint-config-expo`, Prettier.

## Considered options

- **WatermelonDB**: built-in sync protocol but JSI setup and lazy-loading machinery designed for 10k+ rows; this app holds dozens of plants. Later sync needs changelog/`updated_at` discipline in the schema, not a special engine (verified by ticket #5).
- **RxDB**: SQLite storage is a paid premium plugin — disqualifying.
- **Raw SQLite file copy as export format**: trivial, but welds the export format to the internal schema forever; versioned JSON survives migrations and suits a future web client.
- **RN-web from day one**: taxes every library choice for a target we distrust (a11y, lib lock-in); plain-TS core is the cheaper portability guarantee.
- **Monorepo** (`apps/` + `packages/`): daily overhead for a web client that may never exist; `src/core` extracts into a package the day it's needed.

## Consequences

- Sync is not designed in v1, but the schema must carry `updated_at`/changelog discipline so the export format and data model don't preclude it — the open sync research ticket (#5) guards this.
- The notification projection makes snooze/overdue behaviour pure DB logic (domain ticket territory) and keeps the app correct under the 64-notification cap.
- Perenual gets revisited only if bundled coverage disappoints in practice.
