# ADR-0012: The App Store build has no Sync and no Identify

Status: accepted (2026-10-16) · Spec: [#106](https://github.com/gariasf/green-friends/issues/106) · Parked: [#107](https://github.com/gariasf/green-friends/issues/107)

The owner wants Green Friends on the App Store. The relay (ADR-0006) and Identify (ADR-0007) were built for one owner, and their one safeguard against everyone else is the app token. Expo inlines that token into the JS bundle. An IPA's resources aren't encrypted, the `X-App-Token` header shows in any proxy on a user's own phone, and this public repo documents both. So whoever has a published bundle has the token, and with it the relay's writes: 25 MB files under any garden id, readable by anyone with free egress, and the owner's Pl@ntNet key.

## Decision

- **The App Store build is ADR-0001's local-only app.** It has plants, Care Logs, Due, the Daily Digest, Care Guides, Export and Import, and no network use at all.
- **The token is the switch.**
  - A build without `EXPO_PUBLIC_APP_TOKEN` (`HAS_APP_TOKEN`, `src/ui/useSync.ts`) shows no Sync in Settings.
  - It keeps Sync off whatever an old status file says.
  - It ignores Pairing links.
  - Identify stays hidden, and may only ever be shown where `HAS_APP_TOKEN` holds.
  - The owner's own builds carry the token, and keep Sync, the Web view and Identify.
- **Store builds can't carry the token.** They are archived with `EXPO_NO_DOTENV=1`, so Expo never reads `.env.local`. Before any upload, the archive's `main.jsbundle` is checked to hold no copy of the token (docs/agents/app-store.md).

## Considered options

- **Publish Sync, hardened first** (parked as #107). It needs:
  - a write gate that proves a genuine app (App Attest, through `@expo/app-integrity`, which is alpha on SDK 57)
  - a custom domain, so WAF rules run before the Worker. On `*.workers.dev`, the per-IP limiter runs inside it, so anyone can use up Workers Free's 100,000 requests a day.
  - Workers Paid
  - lifecycle rules for abandoned gardens
  - deletion when Sync is turned off
  - an ask on every pairing
  - photos apart from the whole-Garden upload, which is about 8 MB for 20 plants

  That is a project, not a launch step.
- **Publish as it is:** rejected, for the reasons above.
- **Identify for everyone:** Pl@ntNet's free plan is 500 identifications a day for every install together. Its terms never define "commercial", and only the Pro contract (€1,000 a year for 200,000) explicitly allows use inside an app.

## Consequences

- **App Privacy is "Data Not Collected":** nothing leaves the phone but an Export the user shares.
- **Sync's code ships dormant in the store binary:** there's no token for it and no way to turn it on.
- **The owner's iPhone runs the owner's own builds.** A store or TestFlight install there hides Sync until the owner's build goes back on. The key and status stay, so nothing is lost.
- **Every schema change now migrates strangers' only copy of their Garden.** The no-users shortcuts are over: #66 swapped Overrides because nobody else had any.
