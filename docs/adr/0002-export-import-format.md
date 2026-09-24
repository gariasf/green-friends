# ADR-0002: Export/import format & merge semantics

Status: accepted (2026-09-22), amended (2026-09-24, [#19](https://github.com/gariasf/green-friends/issues/19)) · Ticket: [#7](https://github.com/gariasf/green-friends/issues/7)

ADR-0001 fixed the container (zip of a schema-versioned `export.json` + `photos/`, share sheet out, document picker in) and the sync research (#5) fixed the row disciplines (client UUIDs, UTC timestamps, `deleted_at` tombstones, per-row timestamps in the export). This ADR pins the remaining format and behaviour decisions.

## Decisions

- **Archive**: `green-friends-<YYYY-MM-DD>.zip`. Plain `.zip`, no custom UTI / document-type association — import happens roughly once per device, via the in-app document picker only.
- **`export.json` contents**:
  - Header: `schema_version` (integer, mirrors the DB migration version), `exported_at`, `app_version`.
  - Tables, rows verbatim with `id`/`created_at`/`updated_at`/`deleted_at`: `plants` (schedule overrides as columns), `care_events` (note text, repot pot size/soil included), `photos` (tombstoned rows included; the zip carries files only for live rows), `settings` (season month ranges — they change Due derivation, so a restore without them behaves differently).
  - `species_refs`: deduped `{id, colloquial_name, scientific_name}` for every species referenced by a plant. The names are null for a Species the exporting app's catalog lacks too: only an Import can leave such a plant, and it gave the plant a nickname (Species drift, below), so the Export can pass the plant on without a snapshot.
  - Never included: the species catalog (bundled, read-only), pending notifications (a projection, recomputed after import).
- **Import is always a merge**: per-row LWW upsert by UUID — newer `updated_at` wins, tombstones beat older edits. At most one live photo per plant holds after the merge too: where each device gave a plant a new photo, the newest stays live and the others become tombstones, as if it had been taken last. Importing into an empty install *is* the restore path; there is no import-mode picker. Hard reset to a backup = "Erase all data" in settings, then import.
- **Species drift**: an unknown `species_id` is kept verbatim (FKs are app-layer per #5); where the plant has no nickname, one is backfilled from `species_refs` so the Display Name rule holds; a plant that needs one when its snapshot has no name is refused. The ref self-heals when a later catalog ships the species. Effective schedule degrades to overrides-only, same as a no-species plant.
- **Atomic import**: validate everything first — JSON parses, `schema_version` supported, every row one the core could have written itself (UUID id, UTC ISO-8601 times, the mutations' own rules), a photo's file named `<id>.jpg`, every non-null `species_id` appears in `species_refs`, a photo file exists for every live photo row, at most one live photo per plant — then apply in a single transaction plus photo-file copy. Any failure → nothing changed, one clear error. Orphan files in the zip (no matching row) are ignored.
- **Version policy**: an older `schema_version` is migrated forward on import (forward-only, same machinery as DB migrations: the rows are loaded into an empty in-memory database at their version and brought forward by the very migrations the app runs on itself); a newer one than the app knows is refused with "update the app".

## Considered options

- **Import-time Restore/Merge picker**: second code path plus modal UI for a case merge already covers (empty DB = restore); erase-then-import handles the rest.
- **Clobber restore only**: throws away the merge-transport property #5 established — the export would stop being the first manual sync vehicle.
- **Nulling dangling species refs on import**: loses the ref forever and can't self-heal; keeping it costs nothing since FKs are unenforced anyway.
- **Best-effort partial import**: a half-imported garden is worse than a clean failure at this data size (dozens of rows, cheap to validate fully).
- **Custom `.greenfriends` UTI**: tap-to-open from Files/Mail is nice, but CNG config and iOS document-type plumbing for a once-per-device flow fails the boring/minimal bar.

## Consequences

- The export format is a compatibility contract: forward-only migrations must keep handling every `schema_version` ever shipped. Each migration also runs on an Import's rows alone, with no Species catalog beside them.
- Import doubles as the manual sync transport (#5) — the later sync effort inherits merge semantics already proven in production here.
- Merge cannot un-do local edits newer than the backup; true point-in-time restore requires erase-then-import, and that is deliberate.
