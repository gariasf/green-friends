# Research: houseplant species databases

Ticket: [#4](https://github.com/gariasf/green-friends/issues/4) · Researched 2026-09-21. All pricing, limits, and licence claims below were verified against the linked primary sources on that date.

## Question

Which species data source should prefill care info (watering norms, colloquial + scientific names, soil, light) for Green Friends — local-first, offline-capable, no backend, may go paid/public someday?

## TL;DR

- **Primary: a build-time bundled snapshot** — scientific + colloquial names from **Wikidata (CC0)** / **GBIF Backbone (CC-BY 4.0)**, quantitative care thresholds (light, soil moisture, temp, humidity) from **Open Plantbook** (free for any purpose), normalised into an in-repo curated catalog of the ~200–400 most common houseplants and shipped inside the app.
- **Fallback: Perenual API** as optional, online-only autofill for species missing from the bundle. Free tier (100 req/day, species IDs 1–3000) is explicitly non-commercial; commercial use starts at $59.99/mo, and its ToS forbids redistributing the data — so Perenual data may never be bundled.
- No single surveyed source is bundleable, commercial-safe, *and* rich in houseplant care fields. The two with real care prose (Perenual; Trefle to a lesser degree) are either legally closed or sparse for tropical houseplants; the open ones (GBIF, Wikidata, OpenFarm) lack care fields. Hence the hybrid.

## Constraints driving the decision

From the [map issue](https://github.com/gariasf/green-friends/issues/1): local-first with no backend (data must be *redistributable* to ship offline, or the feature degrades when offline), commercial use must remain possible, hosting budget <€100/yr, boring/minimal. Wanted fields: watering norms, sci + colloquial names, soil, light, toxicity.

## Comparison

| Source | Licence / commercial use | Houseplant coverage | Care fields (water/light/soil/toxicity) | Offline / bundling | Cost & limits (verified 2026-09-21) |
|---|---|---|---|---|---|
| [Perenual](https://perenual.com/docs/api) | Proprietary; ToS forbids duplication/distribution; commercial use only on paid tiers | Strong — houseplant-oriented | **Best**: watering, sunlight, soil, poisonous-to-humans/pets, care guides | **Not allowed** (API-only, no redistribution) | Free 100 req/day (species 1–3000, non-commercial); Premium $59.99/mo 10k/day; Supreme $139.99/mo 100k/day |
| [Trefle](https://trefle.io) | 2020 dump: ODbL (attribution + share-alike); current live DB licence [still unnamed](https://github.com/treflehq/trefle-api/issues/285) | Weak — global flora, care indicators calibrated on temperate European flora, often null for tropicals | Ecological indicators only (light 1–9, soil humidity/texture/pH, temps); no watering norms, no toxicity | Yes via [2020 ODbL dump](https://github.com/treflehq/dump) (TSV, generated 2020-10-15) | Free; token auth; 60 req/min (sponsors more) |
| [OpenFarm](https://github.com/openfarmcc/OpenFarm) | CC0 (public domain) | Weak — crops/gardening focus | Growing guides (prose), sparse for houseplants | Data is CC0 but servers are gone; no maintained dump found | **Dead** — servers shut down April 2025, repo archived 2025-04-22 |
| [GBIF](https://techdocs.gbif.org/en/openapi/) | Backbone Taxonomy [CC-BY 4.0](https://api.gbif.org/v1/dataset/d7dddbf4-2cf0-4f39-9b2a-bb099caae36c); commercial OK with attribution | Full taxonomy + multi-language vernacular names; every houseplant present | **None** — no care data at all | Yes — backbone downloadable, or bundle an extract | Free, no auth for reads; soft rate limiting (429 under load) |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing) | CC0 — unrestricted, commercial OK | Taxa + common names/aliases in many languages | **None structured** (no care properties) | Yes — SPARQL extract, bundle freely | Free public endpoints |
| [Open Plantbook](https://open.plantbook.io) | "FREE service and it will always be free. Anyone can use information from the database for any purpose without limitations" (their words) | Good for common houseplants (community-sourced; used by the [Home Assistant plant integration](https://github.com/Olen/home-assistant-openplantbook)) | Quantitative thresholds: min/max light (lux + mmol), soil moisture, temp, humidity, soil EC; newer care-info fields (sunlight, watering, fertilisation, pruning, soil) | Yes — no usage restriction stated, snapshot and bundle | Free; OAuth2 client-credentials or API key ([client docs](https://github.com/slaxor505/OpenPlantbook-client)); rate limits not published |

## Per-source notes

### Perenual

- API v2 (`/api/v2/species-list`, `/api/v2/species/details/{id}`, care-guide and hardiness endpoints) returns exactly the fields we want: common + scientific names, watering, sunlight, soil, poisonous-to-humans/pets ([docs](https://perenual.com/docs/api)).
- [Pricing](https://perenual.com/subscription-api-pricing): Free "100 Requests / Day" with species IDs 1–3000 only; **"Commercial Use" appears only on Premium ($59.99/mo, 10,000 req/day) and Supreme ($139.99/mo, 100,000 req/day)**. Premium alone is ~$720/yr — 7× the project's hosting ceiling.
- [Terms of service](https://perenual.com/terms-of-service): users may not "duplicate, distribute, publicly showcase, or publicly display Perenual Content", may not "sell, resell, or use our Services or Perenual Content commercially" without permission, and may not "employ any data mining, robots, or similar data collection or extraction tools". Plant data is claimed as owned/licensed IP.
- Verdict: best-in-class fields, worst-in-class fit. Offline bundling is contractually barred; a free-tier integration is fine only while the app is personal/non-commercial, and would go dark offline.

### Trefle

- Shut down May 2021, since revived as a volunteer-run project — the [live site](https://trefle.io) shows active corrections and v2.7.0; [getting started](https://docs.trefle.io/docs/guides/getting-started) documents token auth and "a limit of 60 requests per minute" (sponsors get more). Free.
- Care-ish fields ([plants fields](https://docs.trefle.io/docs/advanced/plants-fields)): `light` (1–9), `atmospheric_humidity`, `soil_humidity`, `soil_texture`, `ph_minimum/maximum`, `soil_nutriments`, min/max temperature/precipitation. These are **ecological indicators from the French Baseflor/Catminat dataset, calibrated for temperate European flora, and frequently null** — poor for tropical houseplants. No watering norms, no toxicity.
- Bundling: the [2020 data dump](https://github.com/treflehq/dump) (TSV, generated 2020-10-15) is ODbL — redistribution OK with attribution, but **share-alike**: a derived plant database must itself be offered under ODbL. Doable (publish the extract), but adds legal surface for little houseplant value. The licence of the *current* revived database is still an [open issue](https://github.com/treflehq/trefle-api/issues/285).
- Verdict: nice free name-search API for dev-time cross-checks; not a care-data source for this app.

### OpenFarm

- **Dead.** Per the [archived repo README](https://github.com/openfarmcc/OpenFarm): "The OpenFarm servers were shutdown in April of 2025 after being online for a little more than 10 years"; repo archived 2025-04-22. "All data within the OpenFarm.cc database is in the Public Domain (CC0)."
- No maintained public dump was found, and coverage was vegetables/garden crops, not houseplants. Verdict: out; also a cautionary tale for depending on small community APIs at runtime — which is an argument for bundling.

### GBIF / Wikidata (the names layer)

- GBIF Backbone Taxonomy is [CC-BY 4.0](https://api.gbif.org/v1/dataset/d7dddbf4-2cf0-4f39-9b2a-bb099caae36c); the [species API](https://techdocs.gbif.org/en/openapi/) is free, needs no auth for reads, and is informally rate-limited (429 under load; bulk work should use downloads). Canonical scientific names, synonyms, and multi-language vernacular names — zero care data.
- Wikidata is [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing) ("All structured data in the main, property and lexeme namespaces is made available under the Creative Commons CC0 License"): taxon items, aliases, and common names in Catalan/Spanish/English etc., extractable via SPARQL. No structured care properties.
- Verdict: ideal, legally frictionless backbone for "colloquial + scientific names" (CC0 preferred; CC-BY needs an attribution line in the app's about screen). Never a care source.

### Open Plantbook

- Positioning, from [open.plantbook.io](https://open.plantbook.io): "This is a FREE service and it will always be free. Anyone can use information from the database for any purpose without limitations." Community-sourced, "a GitHub for plant care recipes".
- Data per species ([API client docs](https://github.com/slaxor505/OpenPlantbook-client)): min/max light (lux and mmol), temperature, soil moisture, air humidity, soil conductivity — plus newer care-info fields covering sunlight, watering, fertilisation, pruning, and soil. API via OAuth2 client-credentials or API key with CORS enabled; client library is MIT.
- Ecosystem signal: it is the data source behind the popular [Home Assistant plant integration](https://github.com/Olen/home-assistant-openplantbook), i.e. skewed toward exactly the common-houseplant species home users keep.
- Caveats: rate limits and total species count are not published; provenance of seed data is not formally documented; it is a small community service (see OpenFarm) — bundle a snapshot rather than depending on the API at runtime.

### Other open datasets (surveyed, none sufficient)

- [FloraDB houseplant care + toxicity dataset](https://github.com/FloraaDB/houseplants-botanical-floradb): quantitative light/water metrics + ASPCA toxicity, but **CC-BY-NC** — non-commercial, disqualifying.
- [growspot light dataset](https://github.com/ranson0318-dot/growspot-light-dataset): CC-BY 4.0 but light-only.
- [biologiste95/plant-dataset](https://github.com/biologiste95/plant-dataset): indoor-plant fields incl. watering and toxicity from research papers, but no stated licence — unusable until clarified.
- [openplantdb](https://github.com/cwfrazier1/openplantdb): CC0, but outdoor garden plants (germination, USDA zones).

### Toxicity (gap)

Perenual has poisonous-to-humans/pets flags but can't be bundled. The de-facto reference (ASPCA's toxic-plant list) is copyrighted website content with no open licence; open datasets that repackage it are NC-licensed (FloraDB above). Treat toxicity as a **hand-curated column** in the bundled catalog (a bounded yes/no/species-note per ~300 species, cross-checked against public references), not as an imported dataset.

## Recommendation

**Primary — bundled snapshot (fits offline-first as a bundle):** build a one-time, in-repo dataset generation step (script, not a service) that joins (a) scientific names + colloquial names from Wikidata (CC0), cross-checked against GBIF Backbone (CC-BY 4.0), with (b) light/moisture/temperature/humidity thresholds from an Open Plantbook snapshot, and (c) a hand-curated layer for the fields no open source provides well: plain-language watering norms, soil mix, and toxicity. Scope it to the ~200–400 species that cover virtually all real-world houseplant collections. Ship it as JSON/SQLite inside the app: fully offline, zero runtime cost, zero external dependency, commercial-safe (attribution screen: GBIF CC-BY + Open Plantbook credit). Prefill = local fuzzy search over this bundle; manual entry remains the escape hatch.

**Fallback — Perenual API (fits offline-first only as a per-user cached API):** optional "look up online" autofill for species outside the bundle. Free tier (100 req/day, species 1–3000) only while the app is personal and non-commercial; before any paid/public release either buy Premium ($59.99/mo — likely not worth it) or drop the feature. Responses may be kept as the *user's own plant record* (the user typed/accepted the values), but Perenual data must never be shipped in the bundle or redistributed, per their ToS.

### Key caveats

1. **Verify Open Plantbook coverage before committing**: get an API key and spot-check a top-50 houseplant list (coverage count and rate limits are unpublished). If coverage disappoints, the curated layer grows and Open Plantbook shrinks to a seed.
2. **Perenual prices/ToS as of 2026-09-21** — recheck before ever wiring it in; its free tier is explicitly non-commercial.
3. **Trefle's revived database has no named licence yet** (only the 2020 dump is clearly ODbL); don't build on the live data until that's resolved.
4. The curated care layer is the real cost of this recommendation — a bounded, one-time editorial effort (~300 species), which matches the app's "manual + autofill" posture and keeps Green Friends the owner of its own care data.
