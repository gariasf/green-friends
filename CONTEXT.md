# Green Friends

Local-first iOS app for caring for houseplants: what you own, what each plant needs, what you did, and what needs doing today.

## Language

**Garden**:
All of the user's Plants with their Care Logs and photos, Archived ones included.
_Avoid_: collection, library, catalog (that is the Species list)

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
A plant no longer cared for (dead, given away); reversible. Excluded from Needs Attention and the default Garden view; its Care Log and photo are kept.
_Avoid_: deleted, inactive

**Deleted**:
A plant or Care Event the user removed, typically a mistake; deleting a plant takes its Care Log and photo with it. Hidden everywhere, and the deletion survives Export and Import so an old backup never resurrects it.
_Avoid_: archived, erased (that is "Erase all data"), tombstoned

**Care Type**:
A schedulable kind of care: watering, fertilizing, or repotting. Notes are not a care type.
_Avoid_: task type, activity

**Care Schedule**:
The effective cadence for one care type on one plant: the plant's Override where set, otherwise the Species default. A plant with neither has no schedule for that care type and is never Due for it.
_Avoid_: routine, plan

**Override**:
A plant-level schedule for one care type that shadows the Species default as a whole: both seasonal intervals for watering or fertilizing, the single interval for repotting. Unset means the default applies; a missing Dormant interval inside a set Override means Paused.
_Avoid_: custom schedule, partial override

**Season**:
Growing or Dormant, determined by an app-level growing-month range (default Mar–Oct); a range that starts and ends in the same month means Growing all year. Watering and fertilizing schedules carry one interval per season; a missing Dormant interval means that care type is Paused for the season.
_Avoid_: winter mode

**Paused**:
A care type with no Dormant interval during the Dormant season: nothing is due and nothing is scheduled until the Growing season resumes.
_Avoid_: disabled, skipped

**Care Event**:
A dated record that care happened (or, for a Note, that something was observed) on a plant. Dated by calendar day, never by time of day (ADR-0005). May be backdated, edited, or deleted. A repot event also records the new pot size and soil.
_Avoid_: task completion, check-in

**Care Log**:
The per-plant history of Care Events. All derived state ("last watered", Due) comes from it; nothing derived is stored.
_Avoid_: history, journal, diary

**Current Pot**:
A plant's pot size and soil as they are now. Directly editable; logging a repot newer than every other repot sets it, while editing or deleting a repot event never changes it.
_Avoid_: last repot, derived pot

**Note**:
A free-text, dated Care Event for observations — diseases, pests, anything. The only disease tracking in v1.
_Avoid_: comment, disease record

**Due**:
A care type on a plant whose next due date has been reached. Next due is the last matching Care Event (or the plant's creation, if never logged) plus the interval for today's Season, but never earlier than the first day of today's Season.
_Avoid_: pending

**Overdue**:
Due, and the due date has passed. Overdue items persist until the care is logged; there is no snooze.
_Avoid_: late, missed

**Needs Attention**:
A plant with at least one care type Due or Overdue today. Defines the daily view.
_Avoid_: todo, urgent

**Daily Digest**:
The one notification of a day, at the user's chosen time, sent only on a day when at least one plant Needs Attention. Nothing due, no notification; Overdue care keeps it firing daily until logged.
_Avoid_: alert, push, per-plant reminder

**Export**:
A complete, portable snapshot of the user's data — plants, Care Log, photos, settings — as one shareable file. Species are referenced by ID with a name snapshot; the catalog itself is never included.
_Avoid_: backup dump, sync file

**Import**:
Merging an Export into the local data: the newer edit wins per record, deletions are preserved, and nothing is wiped. Importing into an empty install restores the Export. Either everything imports or nothing does.
_Avoid_: load, restore mode
