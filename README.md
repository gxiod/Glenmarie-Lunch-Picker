# 🍜 Glenmarie Lunch Picker

A real, deployable web app to solve "what do we eat for lunch?" near **The Glenz, Glenmarie** (Shah Alam, Selangor).

Pure static SPA — **no backend, no build step, no API keys.** Just open `index.html`.

## Features

- **Live nearby places** — pulled from OpenStreetMap via the Overpass API, centered on The Glenz's real coordinates.
- **Walk / Drive filter** — defaults to an **800 m** walk limit (the planning-standard outer bound of a ~10-minute walk before people prefer to drive; 400 m is the "highly convenient" 5-minute mark). Slider adjusts 300–1500 m.
- **Dynamic search** across name, cuisine, tags, and description.
- **Cuisine genre filter** — chips built dynamically from whatever cuisines actually exist nearby.
- **Live weather** — current conditions from Open-Meteo. When it's **raining**, outdoor-seating spots are auto-hidden with a warning. Manual override + refresh included.
- **Gamification**
  - XP + level (every 100 XP = +1 level), picks earn XP.
  - **Daily lunch streak** (consecutive days you pick a spot).
  - **🎯 Surprise Me daily challenge** — a cuisine chosen deterministically from today's date (same for everyone, all day). Accept it to filter + chase a **+50 XP bonus** and a separate **challenge streak**. One reroll per day.
  - "🎰 Spin to decide" roulette for when you genuinely can't choose.
- **Theme-aware** — follows system light/dark preference, respects `prefers-reduced-motion`.

## Run locally

```bash
# any static server works; the app is just 3 files
npx serve -l 5173 .
# or
python3 -m http.server 5173 --bind 127.0.0.1
```

Then open http://127.0.0.1:5173

> Note: both the Overpass and Open-Meteo calls are plain HTTPS `fetch`es that work from `file://` too, but a local server avoids any browser quirks.

## Deploy

It's static — drop the folder on any static host:

- **Netlify / Vercel / Cloudflare Pages / GitHub Pages** — point at this directory, no build command, publish directory = `.`.
- **AWS S3 + CloudFront** — `aws s3 sync . s3://your-bucket` then serve via CloudFront.
- **KiroCrew** — deployable via the artifact-deploy flow (static dir) to your own AWS account with a public HTTPS link.

## Data & accuracy notes

- Coordinates for The Glenz are approximate; adjust `ORIGIN` in `app.js` if you want to re-center.
- Distances are **straight-line (haversine) estimates** for filtering, not turn-by-turn navigation. For real walking/driving distances you'd add a routing API (OSRM / Google Directions) — intentionally left out to keep this key-free and free-tier.
- Place data quality depends on OpenStreetMap coverage. Missing `diet:halal` / `outdoor_seating` tags on OSM simply mean those badges don't show — they're not assertions of absence.

## Files

- `index.html` — markup + layout
- `styles.css` — theming (light/dark), components
- `app.js` — live data fetch, filtering, gamification, challenge logic
# Glenmarie-Lunch-Picker
# Glenmarie-Lunch-Picker
# Glenmarie-Lunch-Picker
