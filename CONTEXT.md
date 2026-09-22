# Green Friends

Local-first iOS app for caring for houseplants: what you own, what each plant needs, what you did, and what needs doing today.

## Language

**Plant**:
An individual specimen the user owns and cares for. May reference a Species; a plant without one carries its whole care schedule itself.
_Avoid_: specimen, item

**Species**:
A read-only catalog entry (colloquial + scientific name) bundled with the app, carrying care defaults. Never user-editable.
_Avoid_: variety, plant type

**Display Name**:
What the UI calls a plant: its nickname where set, otherwise its species' colloquial name. A plant without a species must have a nickname.
_Avoid_: title, label

**Archived**:
A plant no longer cared for (dead, given away). Excluded from Needs Attention and the default catalog view; its Care Log and photo are kept.
_Avoid_: deleted, inactive

**Care Type**:
A schedulable kind of care: watering, fertilizing, or repotting. Notes are not a care type.
_Avoid_: task type, activity

**Care Schedule**:
The effective cadence for one care type on one plant: the plant's Override where set, otherwise the Species default.
_Avoid_: routine, plan

**Override**:
A plant-level schedule value that shadows the species default for one care type. Unset means the default applies.
_Avoid_: custom schedule

**Season**:
Growing or Dormant, determined by app-level month ranges (default: growing Mar–Oct). Watering and fertilizing schedules carry one interval per season; a missing Dormant interval means that care type is Paused for the season.
_Avoid_: winter mode

**Paused**:
A care type with no Dormant interval during the Dormant season: nothing is due and nothing is scheduled until the Growing season resumes.
_Avoid_: disabled, skipped

**Care Event**:
A dated, append-only record that care happened (or, for a Note, that something was observed) on a plant. May be backdated, edited, or deleted. A repot event also records the new pot size and soil.
_Avoid_: task completion, check-in

**Care Log**:
The per-plant history of Care Events. All derived state ("last watered") comes from it.
_Avoid_: history, journal, diary

**Note**:
A free-text, dated Care Event for observations — diseases, pests, anything. The only disease tracking in v1.
_Avoid_: comment, disease record

**Due**:
A care type on a plant whose next due date has been reached. Next due derives from the last matching Care Event plus the effective schedule.
_Avoid_: pending

**Overdue**:
Due, and the due date has passed. Overdue items persist until the care is logged; there is no snooze.
_Avoid_: late, missed

**Needs Attention**:
A plant with at least one care type Due or Overdue today. Defines the daily view.
_Avoid_: todo, urgent

**Export**:
A complete, portable snapshot of the user's data — plants, Care Log, photos, settings — as one shareable file. Species are referenced by ID with a name snapshot; the catalog itself is never included.
_Avoid_: backup dump, sync file

**Import**:
Merging an Export into the local data: the newer edit wins per record, deletions are preserved, and nothing is wiped. Importing into an empty install restores the Export. Either everything imports or nothing does.
_Avoid_: load, restore mode
