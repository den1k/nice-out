# Shareable URL State (location + units)

**Date:** 2026-07-08
**Status:** Approved

## Goal

The home page URL should encode the active location and unit preferences so a
copied link opens the same location with the same units for any recipient.

## URL format

```
/?lat=40.694&lon=-73.99&name=Brooklyn&temp=f&dist=mi
```

| Param  | Values      | Meaning                                            |
| ------ | ----------- | -------------------------------------------------- |
| `lat`  | number      | latitude, 3-decimal rounded (matches weather fetch) |
| `lon`  | number      | longitude, 3-decimal rounded                        |
| `name` | string      | optional display name; reverse-geocode fallback     |
| `temp` | `c` \| `f`  | temperature unit (`isTempMetric`)                   |
| `dist` | `km` \| `mi`| distance/speed/pressure unit (`isDistanceMetric`)   |

Invalid or missing params are ignored individually. A bare `/` behaves exactly
as before (GPS + saved state).

## Approach

Client-side only. Read `window.location.search` once at provider init; write
with native `history.replaceState` (supported by Next 14.1's router sync).
Rejected alternatives: encoding a Google `place_id` (extra API hop, no benefit
— the pipeline is coord-keyed) and `useSearchParams` (forces Suspense
restructuring of a statically prerendered page).

## Reading (link recipient)

In `GlobalContext`:

- Parse params once via a lazy `useState` initializer (SSR-guarded, same
  pattern as the existing localStorage unit reads).
- `temp`/`dist` params seed the unit states, taking precedence over
  localStorage; the existing persistence effects then save them (URL units
  overwrite the recipient's saved preference — accepted trade-off, one tap
  reverts).
- Valid `lat`/`lon` build a `GeoLocationData` (`urlLocation`). While present:
  - the stored `activeLocationId` is NOT restored from localStorage, so the
    URL location beats the recipient's previous active location;
  - active location resolution becomes `findLocation || urlLocation || gps`.
- Once the URL location's weather loads, the existing `weatherData` effect
  makes it the active cached location; `findLocation` then shadows
  `urlLocation` permanently, so later location switches work unchanged. No
  clearing logic is needed, and GPS never races the URL location because GPS
  is the last fallback.

## Writing (link sender)

An effect in `GlobalContext` (it is mounted on every page) guarded by
`usePathname() === '/'`:

- When `weatherData`, `isTempMetric`, or `isDistanceMetric` change, rewrite
  the query string from `weatherData.location.coords`,
  `weatherData.locationName`, and the unit booleans.
- Uses `history.replaceState(window.history.state, ...)` — preserves Next's
  router state, adds no history entries.
- Unknown existing params are preserved; no-op writes are skipped by string
  comparison.
- GPS locations are written too (coords already rounded to ~110 m; sharing
  what you're looking at is the feature).
- `/search` and `/locations` URLs are untouched.

## Testing

Browser verification (no unit-test infra in this repo): recipient flow in a
fresh profile (params → correct location + units), sender flow (unit toggle
and location switch update the URL), and bare-`/` regression (GPS behavior
unchanged). Plus `next lint` and a production build.
