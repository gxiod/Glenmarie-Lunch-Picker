# 🍜 Glenmarie Lunch Picker

A real, deployable web app to solve *"what do we eat for lunch?"* near
**The Glenz @ Glenmarie** (6, Jalan Juruanalisis U1/35, Hicom-Glenmarie
Industrial Park, 40150 Shah Alam, Selangor).

Pure static SPA — **no backend, no build step, and no API keys.** Just open
`index.html`.

## Features

- **Live nearby places** — pulled from OpenStreetMap via the Overpass API,
  centered on The Glenz's exact coordinate (`3.081571, 101.562578`). If every
  Overpass mirror is busy (common on the free public servers), it falls back to
  a curated local sample so the app always renders, with a **retry live** button.
- **📍 Use my location** — measure distances from your real GPS position instead
  of the fixed Glenz origin (browser Geolocation; nothing is sent anywhere).
- **Walk / Drive filter** — default **800 m** walk limit (planning-standard
  outer bound of a ~10-min walk; 400 m is the "highly convenient" 5-min mark).
  Slider adjusts 300–1500 m.
- **Dynamic search** across name, cuisine, tags, and description.
- **Cuisine genre filter** — chips built dynamically from what's actually
  nearby, including a dedicated **Kopitiam** genre.
- **Live weather** — current conditions from Open-Meteo. When it's **raining**,
  outdoor-seating spots are auto-hidden with a warning. Manual override + refresh.
- **Real road distance & drive time** — each listed spot is routed from The Glenz
  via the OSRM public routing API (keyless, CORS-enabled), shown as `🛣️ X km · Y min
  drive` beneath the straight-line estimate. Loaded lazily and cached per leg so the
  list isn't blocked; if routing is unavailable the straight-line estimate stands alone.
- **Gamification** — XP + levels, a daily lunch streak, the **🎯 Surprise-Me
  daily challenge** (date-seeded, +50 XP bonus, challenge streak, one reroll/day),
  and a "🎰 Spin to decide" roulette.
- **Theme-aware** — follows system light/dark, respects `prefers-reduced-motion`.

## Run locally

No install needed — it's three static files:

```bash
python3 -m http.server 5173 --bind 127.0.0.1
# or:  npx serve -l 5173 .
```

Then open http://127.0.0.1:5173

## Push to Git — no credentials needed

This project stores **no secrets** (all APIs are keyless), so there is nothing
sensitive to leak. The remote is configured over **SSH**, which authenticates
with your SSH key — you never type a username, password, or token on push.

**One-time check** — confirm the remote uses SSH (`git@…`), not HTTPS:

```bash
git remote -v
# origin  git@github.com:gxiod/Glenmarie-Lunch-Picker.git   ← SSH ✓ (credential-free)
```

If it shows `https://github.com/…` instead, switch it to SSH so you stop being
prompted for a token:

```bash
git remote set-url origin git@github.com:gxiod/Glenmarie-Lunch-Picker.git
```

**One-time SSH key setup** (skip if `ssh -T git@github.com` already greets you):

```bash
ssh -T git@github.com                     # "Hi <user>!" means you're set
# If not set up yet:
ssh-keygen -t ed25519 -C "you@example.com"   # press Enter through the prompts
cat ~/.ssh/id_ed25519.pub                     # copy this, add it at:
#   GitHub → Settings → SSH and GPG keys → New SSH key
```

**Every push after that** — no prompts:

```bash
git add .
git commit -m "your message"
git push origin main
```

> macOS keeps your key unlocked in the Keychain, so even a passphrase-protected
> key won't prompt after the first use.

## Deploy

It's static — drop the folder on any static host, no build command, publish
directory = `.`:

- **GitHub Pages** — repo → Settings → Pages → deploy from `main` / root.
- **Netlify / Vercel / Cloudflare Pages** — point at this directory.
- **AWS S3 + CloudFront** — `aws s3 sync . s3://your-bucket`, serve via CloudFront.

## Data & accuracy notes

- The Glenz coordinate is exact (user-confirmed). Edit `GLENZ` in `app.js` to
  re-center.
- Distances shown as `(…m straight-line)` are **haversine estimates** used for the
  walk/drive filter. The `🛣️` line below each is the **real road route** from OSRM
  (Google-comparable) — e.g. Glenz → NU Empire is ~2.2 km straight-line but ~5.2 km
  by road, and Glenz → 1 Utama is ~13.6 km / ~17 min. OSRM's free demo server is
  rate-limited, so routes fill in progressively and silently skip if it's busy.
- Place data quality depends on OpenStreetMap coverage. A missing
  `diet:halal` / `outdoor_seating` tag just means no badge — not an assertion
  of absence. Spots OSM is missing are added by hand in `LOCAL_EXTRAS` and
  flagged `✎ added`.

## Files

- `index.html` — markup + layout
- `styles.css` — theming (light/dark), components
- `app.js` — live data fetch, filtering, gamification, challenge logic
- `.gitignore` — keeps OS/editor junk and any future `.env` out of the repo
