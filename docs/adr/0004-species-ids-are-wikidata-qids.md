# ADR-0004: Species IDs are Wikidata QIDs

Status: accepted (2026-09-22) · Ticket: [#10](https://github.com/gariasf/green-friends/issues/10)

Spec #8 and the sync research (#5) require Species IDs that are deterministic, stable, append-only and never reused: Plants reference them, and an Export carries them in `species_refs` (ADR-0002), so the ID format is a compatibility contract rather than a build detail.

## Decision

- A Species ID is the Wikidata item ID (QID) of the taxon, stored as text: `Q161077` for _Monstera deliciosa_. Wikidata never reuses a QID and every ID resolves to a public page, so the IDs are meaningful outside the app and need no registry of our own.
- The curated care layer (`scripts/species/curated.json`) pins each QID together with the expected scientific name. The build script (`scripts/species/build.ts`) fetches the item's taxon name (P225) from Wikidata and refuses to build on a mismatch, and refuses to drop any ID present in the `assets/species.json` committed at `HEAD`, which is the record of what shipped. Wikidata is CC0, so bundling the names carries no attribution duty; the dataset records its sources anyway.
- The bundle carries names plus the curated care layer, nothing else. Spec #8 also named GBIF and Open Plantbook thresholds: GBIF is unused because Wikidata alone resolves every species, and the thresholds are not bundled because nothing in v1 reads them and Open Plantbook answers only registered credentials. Either can join the pipeline later without touching a single ID.
- An entry may sit at whatever taxon rank a grower actually buys: a species, a named hybrid (_Alocasia × amazonica_) or a genus (_Phalaenopsis_, sold as unlabelled hybrids).
- Taxonomy renames keep the ID. When Wikidata updates a taxon name (_Sansevieria trifasciata_ → _Dracaena trifasciata_), the curated name follows and the QID stays. Should Wikidata ever merge an item away, the shipped ID stays too: Wikidata mints the IDs, but once shipped they are ours. The build's name check then fails for that entry until the curated file gains a per-entry pointer to the surviving item to verify against; that field is added the first time it is needed.

## Considered options

- **Sequential integers or slugs assigned in the curated file**: deterministic as well, but uniqueness and non-reuse then rest on our own discipline, and a slug invites a rename exactly when the taxon is renamed.
- **UUIDv5 of the scientific name**: deterministic, but it changes when the name does, which is precisely when the ID must not.
- **GBIF backbone keys**: open (CC-BY 4.0) and widely used, but keys can move when taxa are re-synonymised across backbone releases, and CC-BY would put an attribution line in the app for the names alone.

## Consequences

- A cultivar with no Wikidata item (Philodendron 'Birkin') cannot enter the catalog until the item exists on Wikidata, or a later ADR agrees a non-QID scheme; the plant is still addable as a species-less Plant carrying its own schedule.
- Regenerating the dataset needs network access to Wikidata. The app bundles the committed `assets/species.json`, so app builds stay offline.
