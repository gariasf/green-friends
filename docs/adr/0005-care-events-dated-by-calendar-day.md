# ADR-0005: Care Events are dated by local calendar day

Status: accepted (2026-09-22) · Ticket: [#11](https://github.com/gariasf/green-friends/issues/11) · Affects: [#12](https://github.com/gariasf/green-friends/issues/12), [#14](https://github.com/gariasf/green-friends/issues/14), [#18](https://github.com/gariasf/green-friends/issues/18)

Spec #8 makes due-ness day-granular in the device's local timezone, and every way a user dates a Care Event is a whole day (today, yesterday, 2 days ago, "last watered about a week ago"). `care_events` rows travel verbatim in every Export (ADR-0002), so how a Care Event is dated is a compatibility contract, not a refactorable detail.

## Decision

- `care_events.occurred_on` is the local calendar day the care happened, as `'YYYY-MM-DD'`. It is not an instant and carries no timezone.
- The core compares days as strings and never converts through UTC: "today" is `localDay(now)` (`src/core/dates.ts`), a backdated event is `shiftDays(today, -n)`, and a care type is due when `occurred_on` plus its interval reaches today.
- `created_at` / `updated_at` stay UTC ISO-8601 instants: they order edits for the Import merge (ADR-0002), they do not date care.
- A care type never logged anchors to the local day of the plant's `created_at`, computed when evaluated.

## Considered options

- **UTC instant, converted to a day on read**: the conversion runs in every due computation and Care Log row, and the same event lands on different days when the device changes timezone or an Export is imported abroad.
- **Instant pinned to local noon of the chosen day**: keeps one column type across the schema, but stores a time nobody chose to encode a day, and still shifts under the conversion above.

## Consequences

- The Care Log shows no time of day; nothing in v1 needs one.
- An Export imported in another timezone keeps the day the user meant.
- Two events on the same day order by `created_at`.
- The creation anchor can move by a day for a plant created near midnight and evaluated from another timezone; accepted, it only affects a never-logged care type before its first event.
