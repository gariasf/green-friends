# ADR-0013: Usage data and Crash reports are opt-in, anonymous and our own

Status: accepted (2026-10-16) · Spec: [#113](https://github.com/gariasf/green-friends/issues/113)

Green Friends 1.0 sends nothing off the phone (ADR-0012), and its listing says "Data Not Collected". Once it's on the App Store, the owner can't see much:

- **Crashes.** Xcode Organizer shows crashes only from users who share with app developers, and never a JS error's text. Release builds also drop rejected promises, and render errors skip the JS global handler.
- **Use.** App Store Connect Analytics shows only the same users, in noisy rows of 5 or more, and nothing about which parts of the app get used.

The owner wants to know whether a release broke, who comes back, and what gets used, at no cost and with no personal data.

## Decision

- **Opt-in, everywhere:** two switches, Share usage and Share crash reports, both off until the user says yes.
  - The app asks once, the first time a plant is saved or care is logged, and refusing is as easy as accepting.
  - **Apple** requires consent "even if such data is considered to be anonymous" (guideline 5.1.1(ii)).
  - **The EU:** ePrivacy Art. 5(3) needs consent before an app sends anything to its developer, whether or not it's personal data (EDPB Guidelines 2/2023, Planet49). Spain's AEPD exempts only a listed set of audience statistics, and Crash reports and Garden sizes aren't on it.
  - **The UK** would allow both with an opt-out, but one model for every storefront is simpler and meets the strictest rule.
- **No ID of any kind:** no install ID, no device ID, no time of day, no user content.
  - Active phones are counted by pings: each phone sends one for its first use in each day, week and month.
  - Retention comes from days since install, sent as a bucket.
  - This keeps the stored data anonymous for us (GDPR Recital 26), and the label at "Data Not Linked to You". A per-install UUID would make every event personal data, and the label "Linked".
- **Our own client and collector:**
  - **The client:** a small module in core, with no new dependency and no native code.
  - **The collector:** a Worker on the owner's zone, which writes Cloudflare Analytics Engine. It refuses anything outside an allowlist the app shares, keeps no logs, and never writes an IP.
  - **No secret:** the collector needs none, so ADR-0012 stands, since a secret in the bundle is public. Fake events are possible, and are accepted until App Attest is available.
- **The edge collects, and the Umbrel pulls.**
  - Phones only ever reach Cloudflare, which is always up and is already the processor under its DPA.
  - The owner's Umbrel pulls every hour, keeps raw data for 25 months and daily counts after that, and serves Grafana through Cloudflare Tunnel behind Access.
  - The tunnel carries the owner's dashboards only, never data coming in.

## Considered options

- **Sentry's React Native SDK, with GlitchTip on the Umbrel:**
  - For: native crash capture and a UI that groups crashes.
  - Against: about 1.8 MiB more and native code. It sends the user agent, console breadcrumbs and device context unless each is turned off, and the server infers the IP. GlitchTip isn't an Umbrel app, and doesn't document Hermes source maps.
- **Aptabase:** the server needs ClickHouse and Postgres and isn't an Umbrel app, and its sessions use a pseudonymous hash.
- **Hosted free tiers** (Sentry, PostHog, TelemetryDeck): each puts a third party's SDK and servers into the label and the policy, for less control over every field.
- **Apple's data only:** keeps "Data Not Collected", but leaves JS errors and feature use invisible.
- **Phones posting straight to the Umbrel through the tunnel:** opens a public write path into the home LAN, loses data whenever the house is offline, and hands the home server every IP.

## Consequences

- **The store build now makes network requests, but only after consent.** The App Privacy label becomes Usage Data and Diagnostics, not linked and not used for tracking. The privacy policy changes before the version that sends anything ships, as it promised.
- **The allowlist is the contract.** A new event or field means changing the shared allowlist, the privacy policy and the label together, and redeploying the collector before the app ships.
- **Crash reports need the build's source map.** Each store archive emits the composed Hermes map, kept privately by build number, and the token check counts the map too.
- **Native crashes stay with Organizer** until MetricKit is added: later, once iOS 27.2's `MetricManager` settles.
