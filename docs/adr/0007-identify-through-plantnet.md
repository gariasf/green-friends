# ADR-0007: Identify sends the photo to Pl@ntNet through the relay

Status: accepted (2026-09-26)

The owner wants New plant to suggest a Species from the plant's photo. v1 promised no server and bytes that stay on the phone, so on-device was the first choice. We measured it before deciding, and it can't recognise houseplants.

## Decision

- **Engine.** Pl@ntNet's identification API, project `useful` (cultivated and ornamental plants), on its free plan of 500 identifications a day.
- **Only on a tap.** The photo leaves the phone only when the user taps Identify from photo in New plant, never on its own. Pl@ntNet keeps images in memory only and doesn't store them.
- **Through the relay.** The API key is a secret of the relay Worker (ADR-0006), never in the app. `POST /identify` forwards one 1280 px JPEG, stores nothing, and refuses with 429 once Pl@ntNet's remaining daily quota drops below 50. Cloudflare's per-IP rate limit sits in front.
- **Mapping to the catalog on the phone.** Pl@ntNet answers in its own taxonomy. The species build writes a name index beside `species.json`: each Species' GBIF keys and names, its synonyms included, plus hand aliases from `curated.json` where taxonomies disagree (_Spathiphyllum floribundum_ → _S. wallisii_). Candidates outside the catalog are dropped.
- **What the user sees.** Up to three Suggestions: "likely" at a score of 0.3 or more, "maybe" from 0.05, and "No match in the catalog" below that. `ponytail:` the thresholds come from 131 test photos; tune them after real use.

## Considered options

Tested on 2026-09-26 against the owner's two plants and 129 photos of cultivated plants from iNaturalist (43 catalog Species). A pass needed the right Species in the top 3 for at least 90% of photos, and the owner's Monstera found.

- **On-device BioCLIP 1** (about 90 MB at int8, via react-native-executorch or onnxruntime), zero-shot against the 296 names: 67% top-3. It named the owner's Monstera a banana at 0.90.
- **On-device BioCLIP 2** (about 300 MB): 80% top-3, with scores too flat to support confidence words. It placed the Monstera 3rd at 0.07. Both models learned from field and herbarium images, not potted plants indoors.
- **Generic CLIP (OpenAI ViT-L/14):** worse than either.
- **BioCLIP on a home server (Umbrel):** the same weak models, plus a machine and a tunnel to keep up.
- **Pl@ntNet (chosen):** 80% top-3 overall, and 95% whenever it offers Suggestions (78% of photos). It placed the Monstera 1st at 0.64.
- **An LLM with vision (Claude Haiku):** kept as the fallback. It costs about 0.5¢ per Identify and its confidence is self-reported.

## Consequences

- The app now has a second network use besides Sync, and a third party sees a photo, though only after the user taps.
- New plant credits Pl@ntNet beneath the Suggestions ("Identified with Pl@ntNet"), as its terms ask.
- The species build gains a GBIF step and a second bundled file, the name index. It stays out of the `species` table, so it needs no migration and the Web view never loads it. Wikidata's GBIF id is P14607; P846 is retired.
- The free plan fits one owner. Publishing the app would mean one shared quota of 500 a day for every install, Pl@ntNet's written OK for any commercial use, and Pro (€1,000 a year) beyond that.
- A second relay route has to follow docs/agents/relay.md. The key never goes into the repo; it is set with `wrangler secret put`.
