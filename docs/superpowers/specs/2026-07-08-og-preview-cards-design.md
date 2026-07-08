# Link Preview Cards (OG tags + generated weather card)

**Date:** 2026-07-08
**Status:** Shipped
**Builds on:** 2026-07-08-shareable-url-state-design.md

## Goal

A shared `/?lat=..&lon=..&name=..&temp=..&dist=..` link unfurls in iMessage /
WhatsApp / Slack / social apps as a rich card with live weather for that
location, respecting the link's units.

## Architecture

Three pieces, all server-side (the app already runs `next start`):

1. **`src/lib/weatherkit-server.ts`** — WeatherKit access extracted from
   `/api/weather` (JWT signing + fetch), plus `parseShareCardParams`
   (mirrors the client's URL validation) and `getShareCardData` (converted
   temps/wind, condition description, day/night gradient from the app's own
   palette maps in `useGradientColorStops`). Card fetches use
   `next: { revalidate: 900 }` so the metadata and image fetches for the same
   coords dedupe via Next's data cache; `/api/weather` keeps `no-store`.

2. **`src/app/page.tsx`** — now a server component: `generateMetadata`
   builds per-link tags (title `Aruba — 85°F, Windy`, H/L/feels-like/humidity
   description, `og:image` → `/api/og?...`, `twitter:card
   summary_large_image`). Bare `/` or any failure falls back to the layout's
   generic metadata. The old client page moved verbatim to
   `src/app/components/HomeClient.tsx`. Reading `searchParams` makes `/`
   dynamic (λ) — accepted; the HTML shell is tiny.

3. **`src/app/api/og/route.tsx`** — 1200×630 PNG via `ImageResponse`
   (`next/og`), Node runtime (jsonwebtoken). Thin-Roboto typography over the
   app's authentic day/night condition gradients: place, condition, hero
   temperature, High/Low · Feels like · Humidity · Wind chips, wordmark.
   Fonts committed at `src/assets/fonts/Roboto-{Thin,Light,Regular}.ttf`,
   read via `process.cwd()` (systemd WorkingDirectory = app root). ~45 KB,
   well under WhatsApp's 600 KB limit.

## Satori gotchas (hard-won)

- **Number JSX children crash satori** with a misleading "Expected <div> to
  have explicit display: flex" error — `String()` every numeric
  interpolation.
- **`ImageResponse` renders lazily at stream time**, after the handler
  returns — a try/catch around `new ImageResponse` never sees render errors.
  Buffer with `await image.arrayBuffer()` inside the try; a weather-less
  branded fallback card renders on any failure.
- **Radial gradients render with a hard band edge** — use linear gradients
  for the vignette.
- **`headers` in ImageResponse options are appended**, not replaced: the
  default `immutable, max-age=31536000` survives. Set `Cache-Control`
  (900 s, matching the app's weather staleTime) on the buffered Response.

## Verification

Prod build: per-link tags + title curl-verified, card PNGs eyeballed for
day (Aruba) and night (Tallinn) palettes, °F/°C + km/h / mph respected,
invalid coords → 400, `/api/weather` regression-checked byte-identical
shape, bare `/` metadata unchanged, client app verified in Playwright after
the page split.
