# ADR-0008: Care Guides are bundled, reviewed text grouped by Care Profile

Status: accepted (2026-09-26)

The app tracks what each plant needs and when, but not how: how to water, which fertiliser, where to place it, what brown tips mean. The owner wants that guidance tailored to the plant and the Season, with common problems and a fun fact.

## Decision

- **Bundled, written by us, reviewed by the owner.** Claude drafts the text from care sheets (extension services, RHS) and Wikipedia; the owner reviews it before it ships. It is our own wording, and every Fun fact carries its source link, so the content could be published one day. Nothing is fetched while the app runs, and nothing is generated.
- **Grouped by Care Profile.** About 15 profiles (Tropical aroid, Succulent, Fern, Orchid, …) hold the advice; each catalog Species points to one, with its own care notes only where it differs. Reviewing about 15 profiles is feasible where 296 Species × 5 topics isn't, and care really clusters this way.
- **Symptoms are shared.** One list of about 15, pests included, each with its causes, how to tell them apart and what to do. A profile only reorders the causes. Beside a cause the app shows what the Care Log says (last watered, the schedule), without claiming a diagnosis.
- **Words say how, the schedule says how often.** Profile text never states days, weeks or months. Where timing matters, the Care Guide shows the plant's real Care Schedule (Override or Species default), so it can't contradict it. A test over the bundled file enforces this.
- **Season-aware.** Watering and fertiliser have Growing and Dormant text; the Care Guide opens on today's Season.
- **Its own asset.** `assets/care-guides.json`, keyed by Species QID, beside `species.json` and read by core directly. Like the Identify name index (ADR-0007), it is not in the `species` table: no migration, no reseed, never in an Export (ADR-0002). The Web view bundles the same file.

## Considered options

- **Per-Species text for all 296:** the most tailored, but about 1,500 pieces to review, mostly repeating each other.
- **A care API, fetched live:** Perenual has care guides but is paid or rate-limited, has unclear licensing and needs a connection. Open Plantbook gives only numeric thresholds (lux, °C, humidity), no words.
- **Generated on demand by an LLM through the relay:** covers everything, but unreviewed. Invented care advice is the worst failure this feature can have.
- **Fun facts fetched from Wikipedia at view time:** always fresh, but needs a connection and gives a whole summary rather than one line.

## Consequences

- The catalog pipeline gains content work: every new Species needs a profile, and a Fun fact with its source. The test fails on a Species without a profile once the content is complete.
- Wikipedia text is CC BY-SA. Fun facts are our own sentences, with a "More on Wikipedia" link to the article.
- Plants without a Species get only the Symptom list, with a nudge to set one.
- English only. Translating would triple the text to review.
- The tension between "water when the top 3 cm are dry" and a watering Due that can't be snoozed is left open, for its own grilling.
