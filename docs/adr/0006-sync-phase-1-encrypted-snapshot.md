# ADR-0006: Sync phase 1 uploads an encrypted Snapshot to a blind relay

Status: accepted (2026-09-26) · Spec: [#35](https://github.com/gariasf/green-friends/issues/35) · Research: [#5](https://github.com/gariasf/green-friends/issues/5)

The owner wants to see the Garden from a laptop, and wants a copy of it off the phone. Research #5 recommends the full design: per-field LWW with Hybrid Logical Clocks and merkle anti-entropy, over a relay that stores E2E-encrypted messages, hosted on a Hetzner VPS. Phase 1's Web view is read-only, though, so the phone is the only writer.

## Decision

- **The Snapshot.** The phone encrypts its whole Export (ADR-0002) with AES-256-GCM and uploads it after each burst of writes. The Web view downloads it, decrypts it, and reads it through `src/core`'s Import into an in-memory SQLite.
- **The relay.** It is a Cloudflare Worker with R2, and it stores ciphertext only. It keeps one Snapshot per day for 7 days. A write needs a token, whose hash the first upload stores. Reads are open.
- **Keys.** There are no accounts. A random 32-byte key is the identity. The garden id, the write token and the encryption key each come from SHA-256 over a label plus the key. The key reaches a browser in a Pairing link's `#` fragment, which is never sent to a server. The phone keeps the key in secure-store on this device only.
- **Restore** is the existing Import of a downloaded Snapshot.

## Considered options

- **#5's change log now.** It is the design two writers will need, but with one writer it only adds cost: an oplog, device ids, HLCs and merge code before anyone writes from a second place. Phase 2 builds it once the Web view logs care.
- **A Hetzner VPS (#5).** It's a box to patch, back up and put TLS on. A Worker with R2 has nothing to operate, the free tier covers the load, and the phase 2 log fits D1 or a Durable Object without moving host.
- **A server that can read the data** (Supabase, PowerSync). It would make a web login simple, but #5 and the owner both want a host that holds no plaintext.
- **iCloud Keychain for the key.** expo-secure-store (v57) can't mark an item synchronizable, and a native module goes against ADR-0001's no-Swift rule. A saved Pairing link covers a lost phone instead.

## Consequences

- Every upload carries the whole Garden, photos included, so there is a 25 MB cap. `ponytail:` at a few dozen plants that's roughly 5–10 MB. Phase 2's change log, with photos as their own blobs, lifts the cap.
- **Losing the key.** Whoever has lost every copy of the key can't read the synced copy. The phone still holds the Garden, and Reset sync makes a new key.
- **Leaked links.** Whoever holds a leaked Pairing link can read every Snapshot until Reset sync.
- **Version skew.** The Web view must be as new as the phone's schema, so it deploys with every app release, and a newer Snapshot shows "needs an update".
- Sync adds three things to the house rules: `expo-crypto`, `expo-secure-store`, and network access (the app had none).
