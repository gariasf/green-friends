# ADR-0009: Summer-resting Species turn the garden's Season around

Status: accepted (2026-09-27)

The Season is app-wide: one growing-month range in Settings (default Mar–Oct), and every plant's watering and fertilizing switch between their Growing and Dormant intervals on it. A few Species grow in the cool months and rest in summer (Aeonium, Albuca spiralis, Cyclamen persicum). For them the schedule ran backwards, and the Care Guide said "Growing season" in July against their own care notes; Cyclamen's catalog defaults had been hand-swapped as a workaround.

## Decision

- **A flag, not months.** A Species that rests in summer (`species.restsInSummer`) takes the garden's range the other way round: its Growing season is the garden's Dormant months and its Dormant season the garden's growing months. It keeps following the garden's Settings, so a southern garden or a mild climate needs no second setting. A garden Growing all year stays Growing all year for it too.
- **In the Species catalog.** A column on `species`, curated in `scripts/species/curated.json` like pet toxicity. Not the Care Profile: profiles are shared (Aeonium sits in `succulent` with Haworthia, which doesn't rest in summer). Not `care-guides.json`: the schedule core never reads it (ADR-0008).
- **One place in the core.** `seasonOn(day, months, restsInSummer)` flips the range and otherwise keeps today's rule, so the Season's start, Paused-until and the start-of-Season clamp all move with it. Every screen reads the plant's Season through it; the words follow ("Dormant season" in July).
- **Existing Overrides are turned around** by the migration that adds the column, where both intervals are set, so a hand-swapped Cyclamen keeps its schedule. The migration names the four Species rather than reading the catalog, since an Import migrates an Export's rows with no catalog beside them (ADR-0002). So an older Export is turned around on Import too. The swap's `updatedAt` is the day it shipped, not the moment it runs, so an older Export's swapped rows tie with the Garden's and never overwrite an edit made since.

## Considered options

- **A Species' own growing months:** exact for each Species, but it would ignore the garden's hemisphere and climate, and twelve numbers per Species to curate for four that need it.
- **A flag on the Care Profile:** one place per group, but profiles group by care style, not by Season.
- **An Override per plant to opt out:** not needed. An Override with the same interval in both Seasons already keeps a plant on one schedule all year.

## Consequences

- Only four Species are flagged. Lithops and Pleiospilos rest twice a year and Oxalis irregularly; their care notes cover it, or an Override does.
- Cyclamen's and Albuca's catalog defaults are written for their own Season now (Albuca is Paused in summer).
- A Species added later that rests in summer needs the flag and, if plants already override it, its QID in a migration like 0006's.
