# Local-first sync options for Green Friends (RN now, web later)

Status: research complete, 2026-09-21. GitHub issue #5. All claims checked against primary sources on this date; source list at the end.

## Question

1. What must v1's SQLite schema and export format do *now* so that no realistic sync approach is boxed out later?
2. Which sync approaches are realistic for effort #2 (multi-device iOS + separate web client) under the constraints: self-hosted on Hetzner < €100/yr, no accounts (team by join-code), strong preference for a server that holds no plaintext user data, offline-first, solo dev, tiny relational data plus photo files?

## TL;DR

v1 needs a short list of disciplines (ten, below), headlined by: client-generated TEXT UUID primary keys everywhere (no autoincrement), UTC `created_at`/`updated_at` on every user-data table, `deleted_at` tombstones instead of hard deletes, deterministic IDs baked into the bundled species dataset, and an export.json that carries schema_version + per-row timestamps + tombstones so import can merge instead of clobber. All writes already funnel through `src/core` mutation functions; keep that absolute, because it is what lets an oplog/HLC be added later without touching the UI.

Ranked later-sync direction: (1) DIY per-field LWW messages with Hybrid Logical Clocks + a merkle trie for anti-entropy, over a dumb self-hosted relay that stores end-to-end-encrypted messages — the Actual Budget design, proven in production and the only surveyed option that satisfies "server holds nothing readable" on a €4/mo VPS. (2) PowerSync Open Edition if a plaintext server Postgres ever becomes acceptable. (3) ElectricSQL for the read path if the app ever grows a real backend. Everything else is out (details below). Ship no sync code in v1.

## What v1 must do now

Directly actionable for the Drizzle schema and export.json design:

1. **TEXT UUID primary keys on every user-data table, generated client-side at insert.** No `INTEGER PRIMARY KEY AUTOINCREMENT` anywhere in user data. Because: PowerSync requires a single text `id` column and recommends UUIDs, and documents why sequential IDs cannot be generated offline [7]; Actual's sync messages address rows by `(dataset, row, column)` global ID [18]; cr-sqlite identifies and merges rows by primary key [21]. UUIDv4 is fine; UUIDv7 (RFC 9562) gives time-ordered IDs that index slightly better at the cost of leaking creation time [27] — either works at this scale, just pick one and never change it.
2. **`created_at` and `updated_at` on every user-data table, UTC, set in the core mutation layer, never by the UI.** Store ISO-8601 with milliseconds and `Z` suffix (collates correctly as TEXT — the same property Actual's serialised timestamps rely on [16]). Because: every LWW-style merge and every checkpoint-based replication (e.g. RxDB's `updatedAt` checkpoints [19]) keys on it, and a single choke point is what lets it later be replaced by an HLC without hunting down call sites.
3. **Soft deletes: `deleted_at` timestamp (tombstone), no physical `DELETE` of user rows.** Queries filter `deleted_at IS NULL`; a purge policy can come much later. Because: a merge must be able to learn that a delete happened after an edit; a hard-deleted row simply reappears when the other device syncs. Actual models deletes as just another field write; cr-sqlite consults an internal delete log for the same reason [21].
4. **All writes go through `src/core` mutation functions — no stray `db.update()` from components.** This is the one architectural rule that makes a later changelog/oplog, HLC clock, or message emitter a bolt-on instead of a rewrite. The oplog itself is *not* needed in v1 (see "not needed").
5. **Species seed data ships with deterministic, stable IDs in the bundled dataset.** IDs live in the dataset file (e.g. `sp_monstera_deliciosa` or fixed UUIDs), never generated at seed time, so two devices seeding independently produce identical foreign keys. Treat the table as read-only reference data; user rows store `species_id` as plain data. If the dataset is ever revised, IDs are append-only and never reused.
6. **Photo files are named by the photo row's UUID (`<uuid>.jpg`), one row per photo with its own timestamps and tombstone.** Because: none of the surveyed systems sync blobs in-band — PowerSync and Electric sync rows [7][10], Actual syncs field messages [18] — so photos will always be a separate id-addressed file transfer, and the filename must survive export/import and device moves unchanged.
7. **export.json carries `schema_version`, `exported_at`, and for every row: `id`, `created_at`, `updated_at`, `deleted_at` — tombstones included, not filtered out.** Import then becomes a per-row LWW merge (`updated_at` comparison per id, tombstones win over older edits) rather than a clobber. This makes the existing export/import feature the first, manual sync transport for free.
8. **Do not make uniqueness load-bearing.** Primary keys only; no `UNIQUE` constraints on user-editable columns (plant names may duplicate). Because: cr-sqlite explicitly disallows non-PK unique constraints on CRR tables [21], and under any merge two offline devices can create colliding "unique" values that then cannot both survive.
9. **No `ON DELETE CASCADE` or DB-enforced FK actions on user data; relations are handled in core.** Tombstoned parents must not physically destroy children (care-log entries of a deleted plant). cr-sqlite allows FKs but cannot check them [21]; merges generally arrive child-before-parent or vice versa, so FK enforcement moves to the app layer eventually anyway.
10. **Schema migrations are forward-only and `schema_version` is recorded in both the DB and the export.** Because: two devices on different app versions will exchange data one day; every surveyed system pushes schema compatibility onto the client (Electric and PowerSync sync whatever the server schema says; DIY merges must know which shape a row has).

## Survey of later sync options

### DIY per-field LWW over a dumb relay (the Actual Budget design) — recommended

Pattern: every mutation emits messages of the form `(dataset, row, column, value, timestamp)`; peers apply a message iff its timestamp beats the last one seen for that field; a server relays and stores messages but never interprets them. Actual Budget runs exactly this in production: its `Message` protobuf is `{dataset, row, column, value}` wrapped in a `MessageEnvelope {timestamp, isEncrypted, content}`, with an `EncryptedData {iv, authTag, data}` payload when end-to-end encryption is on [18]; the sync endpoint parses a `SyncRequest`, stores/returns envelopes and a merkle trie, and nothing else [20]; with encryption enabled "the server will no longer be able to access your budget information" [17] (E2E is optional in Actual — off by default).

Why wall-clock `updated_at` LWW alone is fragile: device clocks skew and jump; a device that sat offline with a fast clock silently overwrites newer edits made elsewhere, and identical timestamps have no tiebreak. Actual therefore uses a Hybrid Logical Clock ("hybrid unique logical clock"): each timestamp is max(physical time, highest time seen) plus a counter and a node ID, giving globally unique, monotonic, causally consistent timestamps that tolerate clock stutter, regression and bounded drift [16]. The construction comes from Kulkarni, Demirbas, Madappa, Avva and Leone, "Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases" (SUNY Buffalo tech report 2014-04) [22] — Actual's `timestamp.ts` cites that exact paper. Anti-entropy (detecting that two peers diverged and from when) uses a trinary radix trie of message-hash rollups keyed by timestamp [16][19a]; James Long's `crdt-example-app` is a minimal reference implementation of the whole stack (HLC + merkle + message relay server) [23].

Fit: RN + web trivially (plain TS in `src/core`, shared by both clients); server is ~200 lines of "store envelope, return envelopes since X" plus a join-code table — any €4 Hetzner VPS; E2E encryption is natural because the server never needs plaintext; photos sync as id-addressed encrypted blobs over the same relay. Cost: you own the correctness of the merge code (small, testable, and the data model is tiny relational rows — the easy case). Verdict: **best fit; the only option that meets the "hold nothing" posture as designed rather than bolted on.**

### PowerSync

Sync service between a backend database and client SQLite. Server side: the PowerSync Service replicates from a source DB (Postgres, MongoDB, MySQL, SQL Server, Convex) and streams to clients, persisting a *second* copy — "the recent history of operations on each row" — in bucket storage (MongoDB or Postgres) [6]. Writes never go through the service: you implement `uploadData()` against your own backend API, which must write to the source DB synchronously [8]. Client: mature RN SDK (requires `@op-engineering/op-sqlite`, i.e. replaces expo-sqlite) [9] and a web SDK on wa-sqlite with IndexedDB/OPFS [10]. Self-host "Open Edition" is free, "source-available" [4]; the service is licensed FSL-1.1-ALv2 — each version becomes Apache-2.0 on its second anniversary; until then production self-hosting is a permitted purpose but competing offerings are not [5]. Client SDKs are Apache-2.0 [26].

Fit: fits the budget technically (all containers on one VPS) but the infra is heavy for dozens of plants: source Postgres + PowerSync service + bucket-storage DB + your own write API + auth. User data lives in plaintext on the server twice (source DB + bucket history) — directly against the "hold nothing" preference; no E2E option. Verdict: **the most mature RN+web product surveyed; second choice, only if the plaintext-server penalty is ever accepted.**

### ElectricSQL

Post-rewrite Electric is "a read-path sync engine for Postgres" syncing "shapes" out of Postgres over HTTP [10a]; "Electric does not do write-path sync… It doesn't provide (or prescribe) a built-in solution for getting data back into Postgres" — you build writes through your own API using their four documented patterns [11]. This contradicts most pre-2024 blog coverage: the old bidirectional local-first SQLite architecture was abandoned in the July 2024 "Electric Next" rewrite ("a sync engine, not a local-first software platform"; old code parked at electric-sql/electric-old) [12]. Apache-2.0 [26]; self-host is one Elixir Docker container plus any Postgres ≥14 with logical replication [13]. Expo/React Native is officially supported for the HTTP client (`useShape`; PGlite persistence does not yet work on RN, so local persistence into expo-sqlite is your code) [14]. Note: electric-sql.com now 301-redirects to electric.ax (observed 2026-09-21); content is the same official docs.

Fit: light to self-host and honestly scoped, but it only solves the half of the problem this app finds easy (fan-out reads) and leaves the hard half (offline writes, merge) to you — while requiring a server Postgres holding plaintext plant data. Verdict: **out for this app; reasonable if a plaintext backend ever exists anyway.**

### cr-sqlite / vlcn

MIT-licensed run-time loadable SQLite extension that makes tables CRDTs ("CRRs"): rows identified by primary key, tables unioned with a delete log, columns merged per-CRDT (default last-write-wins) [21]. Schema constraints: tables need a (non-null) primary key; no unique constraints other than the PK; FKs allowed but unchecked; only single-column check constraints [21a]. RN usability: op-sqlite lists vanilla SQLite/libSQL/SQLCipher compilation targets; loading cr-sqlite means shipping a custom native build — possible, not packaged. Maintenance as of 2026-09: last release v0.16.3 (2024-01-17); 2026 commits are build fixes only (Android 16 KB page size, macOS header pad, Windows ARM64) — no feature development for ~2.5 years [25].

Fit: exactly the right shape (CRDT inside SQLite, any dumb transport, E2E possible since peers exchange changesets) and its constraints are the ones v1 should adopt anyway — but betting the sync layer on a stalled extension plus a custom native build is a real risk for a solo dev. Verdict: **out; its schema rules inform v1, its code does not.**

### Automerge

Document CRDT (Rust core compiled to Wasm) with automerge-repo for storage/network plumbing; MIT [26]. Documents retain full history by design; Automerge 3 (July 2025) keeps the compressed representation in memory, cutting RAM "by over 10x" (Moby Dick: 700 MB → 1.3 MB), so history growth is a non-issue at this data size [15a]. React Native is documented but thin: Metro config for package exports plus manual Wasm initialisation (`initializeWasm` / `initializeBase64Wasm`) [15]; built-in storage adapters are IndexedDB and Node fs only — nothing for RN/SQLite [15b]; network adapters are WebSocket/MessageChannel/BroadcastChannel [15c], with a small MIT sync server (automerge-repo-sync-server) whose peer sees document plaintext [26]. Fit: would replace the relational SQLite model with documents (bye Drizzle), RN needs custom storage glue, and the sync server is a plaintext peer unless you build blob-store sync yourself. Verdict: **out; wrong data model for relational rows, RN support is the least-trodden path.**

### Yjs

MIT [26] CRDT aimed squarely at collaborative editing ("collaborative applications like Google Docs and Figma") [2]. Persistence providers target browser/Node (y-indexeddb, y-leveldb); the docs list no RN/SQLite provider [3]; y-websocket's server relays updates and optionally persists to LevelDB — as a Yjs peer it holds plaintext [3a]. Rows-as-Y.Maps works, but everything around it (persistence on RN, awareness, subdocuments) is built for live text collaboration this app does not have. Verdict: **out.**

### Triplit

Full-stack syncing database, AGPL-3.0, self-hosted via a single Docker image (`aspencloud/triplit-server`) with JWT auth and durable server-side storage (`LOCAL_DATABASE_URL`) — i.e. plaintext user data on the server [24][24a]. Has a react-native package. Maintenance as of 2026-09: no commits to `main` since 2025-09-11, last release 2025-07-31; user issues continue to be filed into 2026 [25a]. No official status announcement found — the staleness is inferred from repository data. Verdict: **out; adopting a full-stack database whose development apparently stopped a year ago is not a solo-dev-safe bet.**

### RxDB

The replication protocol itself is free and open (Apache-2.0 core): you implement pull/push endpoints with checkpoints; conflicts resolve client-side, default "drop the fork state and use the master state" [19]. But on React Native the production SQLite storage is a paid Premium plugin — the free "trial" SQLite storage "is not made for production… limited to store 500 non-deleted documents" [20a]; the RN page mainly markets the (also premium) Expo Filesystem storage [20b]. A free RxDB RN stack means memory storage or the crippled trial. Verdict: **out; the free tier does not cover this exact platform, and per-project licence fees violate the budget's spirit.**

### One-liners

- **Rocicorp Zero**: requires deploying zero-cache + Postgres + your own API server (S3 for multi-node) [28] — a heavier, web-first stack with plaintext Postgres; out.
- **LiveStore**: event-sourcing SQLite with genuine Expo/RN + web adapters, but v0.4.x with WIP docs and sync backends geared to Cloudflare/Electric/S2 [29]; a full event-log rearchitecture for tiny CRUD data; out, worth a look if it hits 1.0.
- **Turso embedded replicas**: local read replica, "writes are sent to the cloud primary"; the newer offline/sync features are single-device or tied to Turso's cloud, and no RN SDK is listed [30]; out.

### Ranking against this app's constraints

| Rank | Option | Self-host <€100/yr | No plaintext on server | No accounts | Tiny relational data | RN + web |
|---|---|---|---|---|---|---|
| 1 | DIY LWW/HLC relay (Actual-style) | yes, trivially | yes (E2E by design) | yes (join-code) | ideal | shared TS core |
| 2 | PowerSync Open Edition | yes, heavy | no (two plaintext copies) | DIY on your API | overkill | best-in-class |
| 3 | ElectricSQL | yes, light | no (plaintext Postgres) | DIY | read path only | official Expo |
| 4 | cr-sqlite | yes | possible | yes | good | custom builds; stalled |
| 5+ | Automerge / Yjs / Triplit / RxDB / Zero / LiveStore / Turso | varies | mostly no | varies | poor fit or unmaintained | varies |

## What v1 does NOT need

Explicitly skip, to prevent over-engineering:

- **No CRDT library** (Automerge/Yjs/cr-sqlite) shipped in v1 — nothing on the recommended path needs one.
- **No oplog/changelog table yet.** It is derivable work later precisely because requirement 4 (all writes through core) holds. Add it when sync starts, not before.
- **No HLC, vector clocks, or per-field version columns.** Plain `updated_at` is sufficient until two devices exist; HLC replaces the clock helper in one place later.
- **No device/installation ID, no `sync_status`/`dirty` flags, no message queue.**
- **No server, join-code, team, or encryption design work** — effort #2 decisions, informed by this doc.
- **No local database encryption** (photos and SQLite sit in the app sandbox; out of scope here).
- **Do not switch away from expo-sqlite pre-emptively.** Only PowerSync would force op-sqlite, and only if chosen.
- **No merge UI / conflict surfacing.** Per-field LWW on this data model makes conflicts silent and acceptable.

## Sources

Fetched/verified 2026-09-21. GitHub metadata (licences, commit and release dates) read via the GitHub API on the same date.

1. https://automerge.org/docs/hello/ — what Automerge/automerge-repo are; platform overview.
2. https://docs.yjs.dev/ — Yjs scope ("collaborative applications like Google Docs and Figma"); network-agnostic claim.
3. https://docs.yjs.dev/ecosystem/database-provider — persistence providers target browser/Node; no RN provider listed. [3a] https://docs.yjs.dev/ecosystem/connection-provider/y-websocket — self-hostable server, relays updates, optional LevelDB persistence.
4. https://www.powersync.com/pricing — free "Open Edition" self-hosting, "source-available"; cloud tiers.
5. https://github.com/powersync-ja/powersync-service/blob/main/LICENSE — FSL-1.1-ALv2; "additional license… under the Apache License, Version 2.0 that is effective on the second anniversary".
6. https://docs.powersync.com/architecture/powersync-service — replicates from Postgres/MongoDB/MySQL/SQL Server/Convex; bucket storage in MongoDB or Postgres; stores "recent history of operations on each row".
7. https://docs.powersync.com/usage/sync-rules/client-id — single text `id` PK required; UUIDs recommended; sequential IDs cannot be generated offline.
8. https://docs.powersync.com/installation/app-backend-setup/writing-client-changes — client writes upload via your own `uploadData()`/backend API.
9. https://docs.powersync.com/client-sdk-references/react-native-and-expo — RN SDK requires `@op-engineering/op-sqlite`.
10. https://docs.powersync.com/client-sdk-references/javascript-web — web SDK on wa-sqlite, IndexedDB/OPFS. [10a] https://electric-sql.com/docs/intro — "read-path sync engine for Postgres", shapes over HTTP (redirects to electric.ax as of 2026-09).
11. https://electric-sql.com/docs/guides/writes — "Electric does not do write-path sync"; four write patterns through your API.
12. https://electric-sql.com/blog/2024/07/17/electric-next — the rewrite announcement; "a sync engine, not a local-first software platform"; old architecture deprecated (electric-sql/electric-old).
13. https://electric-sql.com/docs/guides/deployment — self-host: Elixir Docker service + Postgres ≥14 with logical replication.
14. https://electric-sql.com/docs/integrations/expo — official Expo/RN usage via HTTP client; PGlite persistence not yet on RN.
15. https://automerge.org/docs/reference/library-initialization/ — environment setup; RN Metro config; `initializeBase64Wasm`. [15a] https://automerge.org/blog/automerge-3/ — full history retained; >10x memory reduction (July 2025). [15b] https://automerge.org/docs/reference/repositories/storage/ — built-in storage adapters: IndexedDB, Node fs only. [15c] https://automerge.org/docs/reference/repositories/networking/ — WebSocket/MessageChannel/BroadcastChannel adapters.
16. https://github.com/actualbudget/actual/blob/master/packages/crdt/src/crdt/timestamp.ts — "Hybrid Unique Logical Clock" generator; monotonic, globally unique timestamps tolerating clock regression/drift; cites the HLC tech report; collatable serialised form.
17. https://actualbudget.org/docs/getting-started/sync/ — change-based sync; optional end-to-end encryption; "the server will no longer be able to access your budget information".
18. https://github.com/actualbudget/actual/blob/master/packages/crdt/src/proto/sync.proto — `Message {dataset,row,column,value}`, `MessageEnvelope {timestamp,isEncrypted,content}`, `EncryptedData {iv,authTag,data}`, `SyncResponse.merkle`.
19. https://rxdb.info/replication.html — free replication protocol; pull/push + checkpoints (`updatedAt` + id); client-side conflict handler. [19a] https://github.com/actualbudget/actual/blob/master/packages/crdt/src/crdt/merkle.ts — trinary radix trie of timestamp-keyed hashes for anti-entropy.
20. https://github.com/actualbudget/actual/blob/master/packages/sync-server/src/app-sync.ts — server parses `SyncRequest` protobuf, returns message envelopes plus serialised merkle trie. [20a] https://rxdb.info/rx-storage-sqlite.html — SQLite RxStorage is Premium; free trial "not made for production… limited to store 500 non-deleted documents". [20b] https://rxdb.info/react-native-database.html — RN storage options; premium Expo Filesystem storage promoted.
21. https://github.com/vlcn-io/cr-sqlite — CRR merge semantics: rows by PK, tables unioned with delete log, per-column CRDTs (LWW default); MIT. [21a] https://vlcn.io/docs/cr-sqlite/constraints — PK required; no non-PK unique constraints; FKs allowed but unchecked; single-column checks only.
22. https://cse.buffalo.edu/tech-reports/2014-04.pdf — Kulkarni, Demirbas, Madappa, Avva, Leone, "Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases" (HLC origin; URL cited directly by Actual's implementation).
23. https://github.com/jlongster/crdt-example-app — James Long's reference implementation: "full implementation of hybrid logical clocks… merkle tree to check consistency… a server to store and retrieve messages" (supporting material).
24. https://www.triplit.dev/docs/self-hosting (source: aspen-cloud/triplit `packages/docs/src/pages/self-hosting/index.mdx`) — Docker image, `JWT_SECRET`, `LOCAL_DATABASE_URL` durable server storage. [24a] https://github.com/aspen-cloud/triplit — AGPL-3.0; README claims and package list (incl. react-native).
25. GitHub API, vlcn-io/cr-sqlite — last release v0.16.3 (2024-01-17); 2026 commits limited to build fixes (16 KB page size, macOS headerpad, Windows ARM64). [25a] GitHub API, aspen-cloud/triplit — last commit to main 2025-09-11; last release 2025-07-31.
26. GitHub API licence fields — automerge/automerge MIT, automerge/automerge-repo MIT, automerge/automerge-repo-sync-server MIT, yjs/yjs MIT (LICENSE file), electric-sql/electric Apache-2.0, powersync-ja/powersync-js Apache-2.0, pubkey/rxdb Apache-2.0, actualbudget/actual MIT, rocicorp/mono Apache-2.0, livestorejs/livestore Apache-2.0.
27. https://www.rfc-editor.org/rfc/rfc9562.html — UUIDv7 "time-ordered value field derived from… Unix Epoch timestamp".
28. https://zero.rocicorp.dev/docs/deployment — "deploy zero-cache, a Postgres database, your frontend, and your API server"; S3 for multi-node.
29. https://docs.livestore.dev/ — event-sourcing state library; Expo/RN + web adapters; v0.4.0, docs "still work in progress"; sync backends: Cloudflare Workers, ElectricSQL, S2, custom.
30. https://docs.turso.tech/features/embedded-replicas/introduction — "reads run locally… writes are sent to the cloud primary"; offline option single-device; no RN SDK listed.
