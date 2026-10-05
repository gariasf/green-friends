# ADR-0011: A Soil check moves a Due watering on by a quarter of its interval

Status: accepted (2026-10-05)

Watering comes Due a fixed number of days after the last one, at the interval for the Season (spec #8). Soil dries with the weather, the light and the pot, so in a humid spell (the owner's, October 2026) a Due watering found the soil still wet. Spec #8 ruled out any snooze, so the owner could only log a watering that didn't happen, or leave it Overdue with the Daily Digest firing every day until they watered.

## Decision

- **A Soil check is a Care Event.** Its type is `soilCheck`, logged when the soil isn't dry yet ("Not dry yet"), dated by day like any other (ADR-0005), with nothing else on it. It stays in the Care Log, travels in Exports, and can be edited or deleted. So it isn't a silent snooze: it records what the user found, and the watering comes back.
- **A quarter of the interval.** Watering's next due is the later of two days: the last watering plus the Season's interval, and the last Soil check plus a quarter of that interval, rounded up. A check on a 7-day plant asks again in 2 days, on a 14-day one in 4, and in a 30-day Dormant season in 8. A check before the last watering never wins, since a quarter is never more than the whole. The Season's first day and Paused apply as before. `ponytail:` a quarter is a guess made without data; tune it after real use.
- **Watering only.** Fertilizing and repotting don't depend on how wet the soil is, so they keep spec #8's rule.
- **Nothing stored.** Due still derives from the Care Log on every evaluation, so the Daily Digest, the Web view and Coming up follow with no changes of their own.

## Considered options

- **Soil-moisture sensors** (Bluetooth probes, one per pot, about €20 each): either a native Bluetooth module that reads them only near the plants, or a hub sending readings through the relay. Each pot needs calibrating and each probe a battery. For three plants a finger is the better sensor, and the Daily Digest has the owner at the plant anyway. An air-humidity sensor measures the wrong thing.
- **Weather** (Open-Meteo's humidity or evapotranspiration stretching the interval): a model of a model for pots indoors. It needs the phone's location and a third network use, and the Web view would need the same numbers to agree with the phone.
- **A snooze with no record:** what spec #8 refused, rightly. Care drops off the list with nothing to show why.
- **The user picks when to ask again** (2 days, 4 days, a week): one more tap on every check. The owner chose the automatic quarter.
- **A longer Override:** possible already, but it outlasts the humid spell, and it moves the next due date too.

## Consequences

- Spec #8's "no snooze" (user story 36) still holds for fertilizing and repotting. Overdue watering also ends with a Soil check.
- A new Care Event type changes the Export's contract (ADR-0002). An app older than this one refuses a whole Export or Snapshot that carries a Soil check, so the Web view ships with the phone.
- Checks build up in the Care Log. A later suggestion of a longer interval could learn from them; nothing does yet.
