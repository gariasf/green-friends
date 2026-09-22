# ADR-0003: An Override shadows a whole care type

Status: accepted (2026-09-22) · Affects: [#12](https://github.com/gariasf/green-friends/issues/12), [#16](https://github.com/gariasf/green-friends/issues/16), [#18](https://github.com/gariasf/green-friends/issues/18)

An Override lets one plant shadow its Species' default schedule for one care type. Watering and fertilizing schedules carry two values, a Growing interval and a nullable Dormant interval where null means Paused, so a per-field override would give a null Dormant column two meanings: "inherit the species' Dormant interval" and "Paused". Override columns are also rows-verbatim in `export.json` (ADR-0002), which makes their representation a compatibility contract rather than a refactorable detail.

## Decision

- An Override is all-or-nothing per care type. Setting one requires the Growing interval (for repotting, its single interval in months); the Dormant interval inside a set Override is null for Paused.
- Unset is the absence of a stored Growing (or repot) interval for that care type; then the Species default applies to both seasons. Clearing an Override clears every value for that care type.
- Effective-schedule resolution is therefore one check per care type: Growing interval set → the Override, otherwise the Species default, otherwise no schedule (never Due). A plant with no Species is simply a plant whose schedule is Overrides only.

## Considered options

- **Per-field overrides with a Paused sentinel** (`0` or `-1` for the Dormant interval): resolves the ambiguity but bakes a magic value into the export contract and adds a third state per field to the UI, the care engine and the merger.
- **Per-field overrides with a separate "paused" boolean per care type**: one more column per seasonal care type, and the same "Growing set, Dormant inherited, paused flag set" combinations to define and test.

## Consequences

- A user who only wants to pause the Dormant season must copy the Species' Growing value; that care type then stops following catalog improvements until the Override is cleared. Accepted: rare, and reversible per plant.
- The schema needs one nullable Growing column and one nullable Dormant column per seasonal care type plus one nullable months column for repotting, no separate "override set" flags.
