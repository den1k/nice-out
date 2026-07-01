# Nice Out — Persistent Storage for Locations & Settings

**Date:** 2026-07-01
**Status:** Approved

## Problem

Users (iOS home-screen PWA) report saved locations and unit settings
occasionally vanishing. Everything is stored client-side in `localStorage`;
there is no backend. Two distinct root causes were identified.

### Cause 1 — 24h cache expiry (frequent)

Saved locations live in the React Query cache, persisted to `localStorage` via
`PersistQueryClientProvider` (`src/lib/Providers.tsx`). The persistence library
(`@tanstack/query-persist-client-core`) defaults `maxAge` to **24 hours**:

```js
maxAge = 1e3 * 60 * 60 * 24,
const expired = Date.now() - persistedClient.timestamp > maxAge;
```

When the persisted cache is older than `maxAge` on load, the **entire** cache is
discarded. `Providers.tsx` never overrides `maxAge`, so if the app is not opened
for >24h, all saved locations are wiped on next open. This is the dominant cause.

### Cause 2 — iOS full-bucket eviction (occasional)

After ~7 days idle or under storage pressure, iOS/WebKit (ITP) evicts the entire
origin's script-writable storage bucket at once (localStorage + IndexedDB +
caches). This takes the unit settings too (separate `localStorage` keys). This is
a platform behavior; it can be mitigated but not eliminated without a backend.

## Approach

Local-only, zero-friction fixes. No login, no backend, no identity model.
(A future InstantDB backend is the only truly bulletproof option but is out of
scope per YAGNI.)

### Fix 1 — Disable cache expiry

In `src/lib/Providers.tsx`, set `maxAge: Infinity` in `persistOptions` so the
persisted query cache (and thus saved locations) never expires by age.

```tsx
persistOptions={{ persister, maxAge: Infinity }}
```

### Fix 2 — Request persistent storage

On app startup (client), call `navigator.storage.persist()` (guarded for
feature support) to ask the browser to exempt storage from automatic eviction.
Best-effort — WebKit grants it heuristically, more likely for an installed
home-screen PWA. Protects both locations and settings. Implemented as a small
client effect mounted once (e.g. in `Providers.tsx` or a dedicated hook).

## Non-goals

- Backend / cross-device sync
- Any authentication or user identity
- Migrating storage APIs (IndexedDB would live in the same evictable bucket)

## Verification

- `npm run build` passes (TypeScript + Next build).
- `navigator.storage.persist()` is called once on client mount (guarded).
- `maxAge: Infinity` present in persistOptions.
- Service restarts and `niceout.vimsical.com` returns HTTP 200.
