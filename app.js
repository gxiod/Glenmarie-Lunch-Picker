// Glenmarie Lunch Picker — real deployable web app
// Live places: OpenStreetMap Overpass API (no key).
// Live weather: Open-Meteo (no key).
// State: localStorage. No backend required.

// --- The Glenz @ Glenmarie ---
// 6, Jalan Juruanalisis U1/35, Hicom-Glenmarie Industrial Park, 40150 Shah Alam, Selangor.
// Exact coordinate confirmed by the user from Google Maps.
const GLENZ = { lat: 3.081571076828667, lon: 101.5625779089501, name: "The Glenz @ Glenmarie" };
let ORIGIN = { ...GLENZ }; // mutable: geolocation can override it

// Overpass search radius depends on travel mode: a tight walk scan, or a wide
// drive scan that reaches 1 Utama / Sunway / Kota Kemuning (~15 km by road).
const WALK_RADIUS_M = 2000;   // walking is realistically within ~2 km
const DRIVE_RADIUS_M = 16000; // drive reaches the far malls & towns
let SEARCH_RADIUS_M = WALK_RADIUS_M; // mutated when the travel mode changes
const WALK_SPEED_M_PER_MIN = 80; // ~4.8 km/h

// Slider ranges per mode. Walk: 300–1500 m. Drive: 1–15 km (shown in km).
const LIMIT_CFG = {
  walk:  { min: 300, max: 1500, step: 100, def: 800,   unit: "m",  label: "Walk limit",  toM: (v) => v },
  drive: { min: 1,   max: 15,   step: 1,   def: 15,    unit: "km", label: "Drive limit", toM: (v) => v * 1000 },
};

// Overpass endpoints (tried in order). CRITICAL for a static site: the mirror
// MUST return `Access-Control-Allow-Origin` or the browser blocks the response
// (that is the CORS error you hit on Netlify). Only mirrors VERIFIED to send
// `ACAO: *` from a browser belong here. overpass.osm.ch is the one that reliably
// does (200 + ACAO:* + JSON). overpass-api.de does NOT send CORS and is
// deliberately NOT used — not even via a public CORS proxy, because the proxies
// (corsproxy.io etc.) are themselves rate-limited/down and a failed proxy still
// logs `overpass-api.de` as the blocked resource in the console. The curated
// list renders first and is the real data for the Glenmarie industrial park
// (OSM has ~0 eateries mapped within 5 km), so a missing mirror costs nothing.
const OVERPASS_ENDPOINTS = [
  "https://overpass.osm.ch/api/interpreter",
];

// CURATED PRIMARY LIST. The Hicom-Glenmarie industrial area around The Glenz is
// essentially UNMAPPED for food in OpenStreetMap (verified: 0 OSM eateries
// within 5 km), so this hand-built list — not live Overpass — is the real data
// here. Each entry carries a coordinate so its distance is COMPUTED from the
// current origin (haversine), honest for both walk and drive. Live OSM results
// are merged ON TOP when the area eventually gets mapped. `est` flags an
// approximate coordinate. Edit freely as you learn exact spots.
const GLENMARIE = { lat: 3.0816, lon: 101.5626 };   // ~The Glenz / Hicom-Glenmarie
const SS15 = { lat: 3.0730, lon: 101.5870 };         // SS15 Subang food cluster
const NU_EMPIRE = { lat: 3.0812, lon: 101.5826 };    // NU Empire / Empire Gallery
const SUBANG_PARADE = { lat: 3.0812, lon: 101.5867 };// Subang Parade mall
const SUNWAY = { lat: 3.0726, lon: 101.6072 };       // Sunway Pyramid
const ONE_UTAMA = { lat: 3.1500, lon: 101.6160 };    // 1 Utama Shopping Centre
const KOTA_KEMUNING = { lat: 3.0215, lon: 101.5330 };// Kota Kemuning town

// Landmark anchors for the distance GAUGE (straight-line km from The Glenz).
// Used to pin recognisable destinations along the drive-distance scale so the
// slider reads in real terms. Verified road distances in the tooltip come from
// OSRM live; the km here is the straight-line used by the slider filter.
const LANDMARKS = [
  { name: "NU Empire", ...NU_EMPIRE },
  { name: "Subang Parade", ...SUBANG_PARADE },
  { name: "SS15", ...SS15 },
  { name: "Sunway Pyramid", ...SUNWAY },
  { name: "Kota Kemuning", ...KOTA_KEMUNING },
  { name: "1 Utama", ...ONE_UTAMA },
];
// Hicom-Glenmarie Industrial Park coffeeshop cluster — the Meng Kee / Thong Kee
// row of shops on Jalan Pekedai U1/36 / Jalan Juruanalisis U1/35, same industrial
// park as The Glenz (so a short drive / long walk, not SS15). Shared `est` anchor;
// swap in each stall's exact coordinate when you have it.
const HICOM_KOPITIAM = { lat: 3.0801, lon: 101.5612 };

const FALLBACK_PLACES = [
  // --- Hicom-Glenmarie kopitiam / coffeeshop cluster (user-confirmed local spots) ---
  // Jalan Pekedai U1/36 / Jalan Juruanalisis U1/35 — the row near The Glenz.
  { n: "Thong Kee Cafe (Glenmarie)", g: "Kopitiam", lat: HICOM_KOPITIAM.lat, lon: HICOM_KOPITIAM.lon, out: false, halal: false, tags: ["kopitiam", "dim-sum", "breakfast", "pulut-panggang"], note: "popular dim sum & kopi, breakfast spot", est: true },
  { n: "Hakka Mee (beside Thong Kee)", g: "Kopitiam", lat: HICOM_KOPITIAM.lat, lon: HICOM_KOPITIAM.lon, out: false, halal: false, tags: ["kopitiam", "hakka-mee", "noodles"], note: "Hakka mee stall right beside Thong Kee", est: true },
  { n: "Yat Pat Hoe (Fried Rice / Pan Mee)", g: "Kopitiam", lat: HICOM_KOPITIAM.lat, lon: HICOM_KOPITIAM.lon, out: false, halal: false, tags: ["kopitiam", "fried-rice", "pan-mee"], note: "fried rice & pan mee stall", est: true },
  { n: "Meng Kee Chicken Rice", g: "Kopitiam", lat: HICOM_KOPITIAM.lat, lon: HICOM_KOPITIAM.lon, out: false, halal: false, tags: ["kopitiam", "chicken-rice", "char-siew"], note: "Hainanese chicken rice & char siew (Jln Pekedai U1/36)", est: true },
  { n: "Harmee / Curry Mee", g: "Kopitiam", lat: HICOM_KOPITIAM.lat, lon: HICOM_KOPITIAM.lon, out: false, halal: false, tags: ["kopitiam", "har-mee", "curry-mee", "noodles"], note: "prawn mee (har mee) & curry mee stall", est: true },
  { n: "Uncle Soon Fried Rice", g: "Kopitiam", lat: HICOM_KOPITIAM.lat, lon: HICOM_KOPITIAM.lon, out: false, halal: false, tags: ["kopitiam", "fried-rice", "wok"], note: "wok-fried rice stall", est: true },
  // --- Near The Glenz — hotels & industrial-park spots (short drive / long walk) ---
  { n: "Hilton Glenmarie Dining", g: "Western", lat: 3.0796, lon: 101.5668, out: false, halal: false, tags: ["hotel", "buffet"], note: "hotel restaurants, Japanese + terrace", est: true },
  { n: "Holiday Inn Glenmarie — Café", g: "Western", lat: 3.0802, lon: 101.5651, out: false, halal: true, tags: ["hotel", "buffet"], note: "all-day dining & local buffet", est: true },
  { n: "Glenmarie Golf Clubhouse", g: "Western", lat: 3.0870, lon: 101.5600, out: true, halal: true, tags: ["view", "sit-down"], note: "golf-view dining, several outlets", est: true },
  { n: "Mamak / Nasi Kandar (Glenmarie)", g: "Malaysian", lat: 3.0828, lon: 101.5635, out: true, halal: true, tags: ["mamak", "roti", "cheap"], note: "classic mamak, fast & cheap", est: true },
  // --- SS15 / SS16 / NU Empire cluster — a drive away (~5 km by road) ---
  { n: "Madam Kwan's @ NU Empire", g: "Malaysian", lat: NU_EMPIRE.lat, lon: NU_EMPIRE.lon, out: false, halal: true, tags: ["nasi-lemak", "mall"], note: "Malaysian classics in Empire Gallery", est: true },
  { n: "Mozer's @ Shah Alam", g: "Middle Eastern", lat: 3.0760, lon: 101.5700, out: true, halal: true, tags: ["syrian", "shawarma"], note: "lamb shawarma, shish kebab", est: true },
  { n: "Al-Sultan Restaurant", g: "Middle Eastern", lat: 3.0775, lon: 101.5720, out: false, halal: true, tags: ["mandi", "grill"], note: "Yemeni mandi & charcoal grills", est: true },
  { n: "SS15 Thai Street Food", g: "Thai", lat: SS15.lat, lon: SS15.lon, out: false, halal: true, tags: ["spicy", "tomyam"], note: "tom yam, basil chicken rice", est: true },
  { n: "SS15 Korean BBQ", g: "Korean", lat: SS15.lat, lon: SS15.lon, out: false, halal: false, tags: ["bbq", "rice"], note: "bibimbap, grilled sets", est: true },
  // --- Farther drive-only destinations (malls & town food, ~5–14 km by road) ---
  { n: "Subang Parade — food court", g: "Malaysian", lat: SUBANG_PARADE.lat, lon: SUBANG_PARADE.lon, out: false, halal: true, tags: ["mall", "food-court", "variety"], note: "mall food court, lots of choice", est: true },
  { n: "Sunway Pyramid — dining", g: "Western", lat: SUNWAY.lat, lon: SUNWAY.lon, out: false, halal: true, tags: ["mall", "variety", "chains"], note: "huge mall, every cuisine & chain", est: true },
  { n: "1 Utama — food cluster", g: "Western", lat: ONE_UTAMA.lat, lon: ONE_UTAMA.lon, out: false, halal: true, tags: ["mall", "variety", "chains"], note: "massive mall food cluster, all cuisines", est: true },
  { n: "Kota Kemuning Chicken Rice", g: "Kopitiam", lat: KOTA_KEMUNING.lat, lon: KOTA_KEMUNING.lon, out: false, halal: false, tags: ["chicken-rice", "kopitiam"], note: "well-known Kota Kemuning chicken rice", est: true },
];

// Kept for compatibility with the merge step; the SS15 kopitiams now live in
// FALLBACK_PLACES, so no separate extras are needed.
const LOCAL_EXTRAS = [];

// ---------- utilities ----------
const $ = (s) => document.querySelector(s);
const haversine = (a, b) => {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
};
const walkMins = (m) => Math.max(1, Math.round(m / WALK_SPEED_M_PER_MIN));

// ---------- routing (real road distance + drive time) ----------
// OSRM public demo server: keyless, sends CORS (Access-Control-Allow-Origin: *).
// Returns { km, mins } for the driving route ORIGIN -> dest, or null on failure.
// Results are cached per "lat,lon@origin" so we never re-request the same leg,
// and requests are throttled so a full list doesn't hammer the demo server.
const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving/";
const routeCache = new Map();
const routeKey = (dest) => `${dest.lat.toFixed(5)},${dest.lon.toFixed(5)}@${ORIGIN.lat.toFixed(5)},${ORIGIN.lon.toFixed(5)}`;

async function fetchRoute(dest) {
  const key = routeKey(dest);
  if (routeCache.has(key)) return routeCache.get(key);
  try {
    const url = `${OSRM_BASE}${ORIGIN.lon},${ORIGIN.lat};${dest.lon},${dest.lat}?overview=false`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error("osrm " + res.status);
    const j = await res.json();
    const r = j.routes && j.routes[0];
    if (!r) throw new Error("no route");
    const out = { km: r.distance / 1000, mins: Math.round(r.duration / 60) };
    routeCache.set(key, out);
    return out;
  } catch (_) {
    routeCache.set(key, null); // negative-cache so we don't retry a dead leg this session
    return null;
  }
}

// Progressively enrich the currently-rendered rows with real road time.
// Called after render(); fills in each row's "drive" figure as OSRM replies,
// gently throttled, and skips anything already resolved.
let routingRun = 0;
async function enrichRoutes() {
  const myRun = ++routingRun; // cancel stale runs when the list re-renders
  const rows = Array.from(document.querySelectorAll("#list .row[data-lat]"));
  for (const row of rows) {
    if (myRun !== routingRun) return;             // a newer render superseded us
    const el = row.querySelector(".road");
    if (!el || el.dataset.done) continue;
    const dest = { lat: +row.dataset.lat, lon: +row.dataset.lon };
    const r = await fetchRoute(dest);
    if (myRun !== routingRun) return;
    el.dataset.done = "1";
    if (r) el.innerHTML = `🛣️ ${r.km.toFixed(1)} km · ${r.mins} min drive`;
    else el.innerHTML = "";                        // routing unavailable → leave estimate only
    await new Promise((f) => setTimeout(f, 120));  // be kind to the demo server
  }
}
// Stamp curated places with distance computed from the CURRENT origin, so the
// list stays correct after "Use my location" changes ORIGIN.
const curatedWithDist = () =>
  FALLBACK_PLACES.map((p) => ({ ...p, dist: haversine(ORIGIN, { lat: p.lat, lon: p.lon }) }))
    .sort((a, b) => a.dist - b.dist);
const todayStr = () => new Date().toISOString().slice(0, 10);
const yesterdayStr = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);

// Map OSM cuisine/amenity tags (and name) to a friendly genre.
function genreOf(tags) {
  const c = (tags.cuisine || "").toLowerCase();
  const name = (tags.name || "").toLowerCase();
  // Kopitiam first — a Malaysian coffeeshop is often tagged amenity=restaurant
  // with no cuisine, so detect it by name/pattern too.
  if (/kopitiam|kedai kopi|\bkopi\b|white coffee|hainan/.test(c + " " + name)) return "Kopitiam";
  const map = [
    ["malaysian|mamak|nasi", "Malaysian"],
    ["chinese|dim_sum|noodle", "Chinese"],
    ["japanese|sushi|ramen", "Japanese"],
    ["korean", "Korean"],
    ["thai", "Thai"],
    ["indian", "Indian"],
    ["arab|lebanese|turkish|middle_eastern|kebab", "Middle Eastern"],
    ["western|american|steak|grill", "Western"],
    ["italian|pizza|pasta", "Italian"],
    ["burger|fast_food", "Fast Food"],
    ["coffee_shop|cafe|breakfast", "Cafe"],
  ];
  for (const [re, label] of map) if (new RegExp(re).test(c)) return label;
  if (tags.amenity === "cafe") return "Cafe";
  if (tags.amenity === "fast_food") return "Fast Food";
  return c ? c.split(";")[0].replace(/_/g, " ").replace(/^\w/, (x) => x.toUpperCase()) : "Other";
}

// ---------- live data ----------
// Returns { places, source: "live" | "fallback" }.
async function fetchPlaces() {
  const q = `[out:json][timeout:25];
    (
      node["amenity"~"restaurant|fast_food|cafe|food_court"](around:${SEARCH_RADIUS_M},${ORIGIN.lat},${ORIGIN.lon});
      way["amenity"~"restaurant|fast_food|cafe|food_court"](around:${SEARCH_RADIUS_M},${ORIGIN.lat},${ORIGIN.lon});
    );
    out center tags;`;
  const body = "data=" + encodeURIComponent(q);

  // 1) Direct CORS-capable mirror(s). No proxy fallback: a failed public proxy
  //    just logs a scary cross-origin error for overpass-api.de and never helps.
  for (const url of OVERPASS_ENDPOINTS) {
    const places = await tryOverpass(url, body, false);
    if (places && places.length) return { places, source: "live" };
  }

  // 2) Degrade gracefully to the grounded curated list (the real data here).
  return { places: curatedWithDist(), source: "fallback" };
}

// One Overpass attempt. Never throws — returns an array or null.
async function tryOverpass(url, body, isProxyGet) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000); // don't hang on a slow mirror
    const res = await fetch(url, isProxyGet
      ? { method: "GET", signal: ctrl.signal }
      : { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;                       // 429/504/406 → next
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();                  // proxies sometimes mislabel content-type
    if (!/json/.test(ct) && !text.trim().startsWith("{")) return null; // HTML error page
    const data = JSON.parse(text);
    return normalizePlaces(data.elements || []);
  } catch (_) {
    return null;                                    // network/CORS/abort → next
  }
}

function normalizePlaces(elements) {
  const seen = new Set();
  return elements
    .map((el) => {
      const t = el.tags || {};
      const name = t.name;
      if (!name) return null;
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) return null;
      const dist = haversine(ORIGIN, { lat, lon });
      const outdoor = t.outdoor_seating === "yes";
      const halal = /yes|only/.test((t["diet:halal"] || "").toLowerCase());
      const tags = [];
      if (t.cuisine) tags.push(...t.cuisine.split(";").slice(0, 3));
      if (t.amenity === "fast_food") tags.push("fast");
      if (t.takeaway === "yes") tags.push("takeaway");
      return {
        n: name, g: genreOf(t), dist, out: outdoor, halal,
        tags: [...new Set(tags)].slice(0, 4),
        note: t["description"] || (t.amenity || "").replace(/_/g, " ") || "eatery",
        lat, lon,
      };
    })
    .filter((p) => p && !seen.has(p.n) && seen.add(p.n))
    .sort((a, b) => a.dist - b.dist);
}

async function fetchWeather() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${ORIGIN.lat}&longitude=${ORIGIN.lon}` +
    `&current=temperature_2m,precipitation,weather_code,is_day&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather HTTP " + res.status);
  const d = (await res.json()).current;
  return {
    temp: d.temperature_2m,
    precip: d.precipitation,
    code: d.weather_code,
    isDay: d.is_day === 1,
    raining: d.precipitation > 0.1 || [51,53,55,61,63,65,80,81,82,95,96,99].includes(d.weather_code),
  };
}

// WMO weather code → emoji + label
function wxFace(w) {
  if (w.raining) return ["🌧️", "Raining"];
  if ([0,1].includes(w.code)) return [w.isDay ? "☀️" : "🌙", "Clear"];
  if ([2,3].includes(w.code)) return ["⛅", "Cloudy"];
  if ([45,48].includes(w.code)) return ["🌫️", "Foggy"];
  return ["🌤️", "Fair"];
}

// ---------- state / gamification ----------
const STORE = "glenz_lunch_app";
let S = JSON.parse(localStorage.getItem(STORE) || "{}");
S = Object.assign({
  xp: 0, streak: 0, last: null,
  chalDate: null, chalAccepted: false, chalDone: false, chalRevealed: false,
  chalStreak: 0, chalLast: null, chalRerolled: false, chalRerollSeed: 0,
}, S);
const save = () => localStorage.setItem(STORE, JSON.stringify(S));

// runtime
let PLACES = [];
let WX = null;
let mode = "walk", wmax = 800, genre = "Kopitiam", rainOverride = null;
// wmax is always stored in METRES; the slider converts km→m in drive mode.
let GENRES = [];
let challengeG = "Other";

function seedFromDate(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }
function computeChallenge() {
  if (!GENRES.length) { challengeG = "Other"; return; }
  const seed = seedFromDate(todayStr()) + (S.chalRerolled ? S.chalRerollSeed : 0);
  challengeG = GENRES[seed % GENRES.length];
}

function isRaining() { return rainOverride !== null ? rainOverride : (WX?.raining ?? false); }

function renderGame() {
  $("#xp").textContent = S.xp;
  $("#streak").textContent = S.streak;
  $("#lvl").textContent = Math.floor(S.xp / 100) + 1;
}
function addXP(n) { S.xp += n; save(); renderGame(); }

// ---------- challenge ----------
function resetDailyIfNeeded() {
  if (S.chalDate !== todayStr()) {
    S.chalDate = todayStr();
    S.chalAccepted = false; S.chalDone = false; S.chalRevealed = false; S.chalRerolled = false; S.chalRerollSeed = 0;
    save();
  }
}
function renderChal() {
  $("#chalDate").textContent = todayStr();
  $("#chalG").textContent = (S.chalRevealed || S.chalAccepted) ? challengeG : "? ? ?";
  $("#chalBadge").innerHTML = S.chalDone
    ? '<span style="color:var(--ok)">✅ done! +50</span>'
    : (S.chalAccepted ? '<span style="color:var(--warn)">accepted — go eat it</span>' : "");
  $("#chalReroll").disabled = S.chalRerolled || S.chalDone;
  $("#chalMsg").innerHTML = S.chalDone
    ? `🏆 Challenge complete! Challenge streak: <strong>${S.chalStreak}</strong> day(s).`
    : (S.chalAccepted
        ? `List is filtered to <strong>${challengeG}</strong>. Pick or spin a spot from it for +50 XP and a challenge-streak day.`
        : (S.chalRevealed ? `Revealed. Hit <strong>Accept</strong> to filter the list and chase the bonus.` : `Hidden until you reveal — no peeking, that's the surprise 😉`));
}
function completeChallenge(p) {
  if (S.chalAccepted && !S.chalDone && p.g === challengeG) {
    S.chalDone = true;
    S.chalStreak = (S.chalLast === yesterdayStr()) ? S.chalStreak + 1 : 1;
    S.chalLast = todayStr();
    addXP(50); renderChal();
    return true;
  }
  return false;
}
function logPick(p) {
  if (S.last !== todayStr()) {
    S.streak = (S.last === yesterdayStr()) ? S.streak + 1 : 1;
    S.last = todayStr(); addXP(25);
  } else addXP(5);
  const bonus = completeChallenge(p);
  save(); renderGame();
  return bonus;
}

// ---------- filtering / rendering ----------
function visible() {
  const q = $("#q").value.trim().toLowerCase();
  return PLACES.filter((p) => {
    // wmax is in metres in BOTH modes; walk caps the near range, drive caps the far range.
    if (p.dist > wmax) return false;
    if (genre !== "All" && p.g !== genre) return false;
    if (isRaining() && p.out) return false;
    if (q) {
      const hay = (p.n + " " + p.g + " " + p.tags.join(" ") + " " + p.note).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
function setGenre(g) {
  genre = g;
  document.querySelectorAll("[data-g]").forEach((x) => x.classList.toggle("on", x.dataset.g === g));
  render();
}
function render() {
  const v = visible();
  const extra = (isRaining() ? " · 🌧️ outdoor hidden" : "") + (S.chalAccepted && genre === challengeG ? " · 🎯 challenge mode" : "");
  const src = $("#count").dataset.src === "fallback"
    ? ' · <span style="color:var(--muted)">📋 curated local guide (this area is sparsely mapped in OSM) <button id="retry" class="btn" style="padding:2px 8px;font-size:11px">check live</button></span>'
    : "";
  $("#count").innerHTML = `${v.length} spot${v.length !== 1 ? "s" : ""} match${extra}${src}`;
  const retry = $("#retry");
  if (retry) retry.addEventListener("click", () => { $("#count").dataset.src = "live"; loadPlaces(); });
  const list = $("#list");
  if (!v.length) { list.innerHTML = '<div class="empty">No matches. Loosen filters, raise the walk limit, or switch to 🚗 Drive.</div>'; return; }
  list.innerHTML = v.map((p) => {
    const approx = p.est ? "~" : "";
    const reach = p.dist <= wmax ? `🚶 ${approx}${walkMins(p.dist)} min (${approx}${p.dist}m)` : `🚗 drive (${approx}${p.dist}m straight-line)`;
    const star = p.g === challengeG ? ' <span title="today\'s challenge cuisine">🎯</span>' : "";
    const halal = p.halal ? ' <span class="badge-halal">● halal</span>' : "";
    const estTag = p.est ? ' <span class="badge-out" title="Not in OpenStreetMap — hand-added, straight-line distance is an estimate">✎ added</span>' : "";
    const out = p.out ? ' · <span class="badge-out">⛅ outdoor</span>' : "";
    const tags = p.tags.length ? p.tags.map((t) => "#" + t).join(" ") : "";
    const coord = Number.isFinite(p.lat) && Number.isFinite(p.lon) ? ` data-lat="${p.lat}" data-lon="${p.lon}"` : "";
    return `<div class="row"${coord}>
      <div>
        <div class="row-name">${esc(p.n)}${star}${halal}${estTag}</div>
        <div class="row-sub">${esc(p.g)} · ${esc(p.note)}</div>
        <div class="row-tags">${esc(tags)}${out}</div>
      </div>
      <div class="row-reach">${reach}<div class="road" style="font-size:11px;color:var(--muted);margin-top:2px">${coord ? "🛣️ …" : ""}</div></div>
    </div>`;
  }).join("");
  enrichRoutes();
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// ---------- distance gauge (landmark pins under the slider) ----------
// Positions recognisable destinations along the slider's current min..max so the
// limit reads in real terms. Pins within the current limit are highlighted.
// Tooltip shows straight-line km now, then fills in the live OSRM road figure.
function buildGauge() {
  const track = $("#gaugeTrack");
  if (!track) return;
  const cfg = LIMIT_CFG[mode];
  const minM = cfg.toM(cfg.min), maxM = cfg.toM(cfg.max);
  const span = maxM - minM || 1;
  const pins = LANDMARKS
    .map((L) => ({ ...L, d: haversine(ORIGIN, { lat: L.lat, lon: L.lon }) }))
    .filter((L) => L.d <= maxM + 500) // only pins that fit the current scale
    .sort((a, b) => a.d - b.d);
  track.innerHTML = pins.map((L) => {
    const pct = Math.max(0, Math.min(100, ((L.d - minM) / span) * 100));
    const near = L.d <= wmax ? " near" : "";
    const km = (L.d / 1000).toFixed(1);
    return `<div class="gauge-pin${near}" style="left:${pct}%" data-lat="${L.lat}" data-lon="${L.lon}">
      <div class="tick"></div><div class="lbl">${esc(L.name)}</div>
      <div class="tip">${esc(L.name)} · ${km} km straight-line<span class="tip-road"> · 🛣️ …</span></div>
    </div>`;
  }).join("");
  // Lazily fill each tooltip with the real road distance/time.
  pins.forEach((L, i) => {
    const el = track.children[i];
    if (!el) return;
    fetchRoute({ lat: L.lat, lon: L.lon }).then((r) => {
      const road = el.querySelector(".tip-road");
      if (road) road.innerHTML = r ? ` · 🛣️ ${r.km.toFixed(1)} km · ${r.mins} min drive` : "";
    });
  });
}

// ---------- events ----------
// Apply a travel mode: reconfigure the slider range/unit, set the Overpass
// search radius, and (for drive) re-scan for farther places. `rescan` is false
// on the very first setup so boot doesn't double-fetch.
function applyMode(m, rescan = true) {
  mode = m;
  const cfg = LIMIT_CFG[m];
  const s = $("#wmax");
  s.min = cfg.min; s.max = cfg.max; s.step = cfg.step; s.value = cfg.def;
  wmax = cfg.toM(cfg.def);
  $("#limLabel").textContent = cfg.label;
  $("#limUnit").textContent = cfg.unit;
  $("#wlab").textContent = cfg.def;
  SEARCH_RADIUS_M = (m === "drive") ? DRIVE_RADIUS_M : WALK_RADIUS_M;
  buildGauge();
  if (rescan) {
    // Re-scan live OSM at the new radius (drive reaches the far clusters).
    $("#list").innerHTML = `<div class="loading">${m === "drive" ? "🚗 Scanning farther spots (SS15, malls, Kota Kemuning)…" : "🚶 Finding walkable spots…"}</div>`;
    loadPlaces().catch(() => render());
  } else {
    render();
  }
}

function wireEvents() {
  $("#q").addEventListener("input", render);
  $("#wmax").addEventListener("input", (e) => {
    const cfg = LIMIT_CFG[mode];
    const raw = +e.target.value;
    wmax = cfg.toM(raw);
    $("#wlab").textContent = raw;
    buildGauge();
    render();
  });
  document.querySelectorAll("[data-mode]").forEach((el) => el.addEventListener("click", () => {
    if (el.dataset.mode === mode) return;
    document.querySelectorAll("[data-mode]").forEach((x) => x.classList.remove("on"));
    el.classList.add("on");
    applyMode(el.dataset.mode, true);
  }));
  $("#genres").addEventListener("click", (e) => { const el = e.target.closest("[data-g]"); if (el) setGenre(el.dataset.g); });

  $("#wxBtn").addEventListener("click", () => {
    rainOverride = isRaining() ? false : true;
    paintWeather(true); render();
  });
  $("#wxRefresh").addEventListener("click", () => { rainOverride = null; loadWeather(); });

  $("#useLoc").addEventListener("click", () => {
    const btn = $("#useLoc");
    if (!navigator.geolocation) { btn.textContent = "⚠️ no geolocation"; return; }
    btn.textContent = "📍 locating…"; btn.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        ORIGIN = { lat: pos.coords.latitude, lon: pos.coords.longitude, name: "My location" };
        $("#originLabel").textContent = "My location";
        btn.textContent = "📍 using my location"; btn.disabled = false;
        $("#list").innerHTML = '<div class="loading">📍 Re-measuring from your location…</div>';
        loadPlaces(); loadWeather();
      },
      (err) => { btn.textContent = "⚠️ " + (err.code === 1 ? "permission denied" : "location failed"); btn.disabled = false; },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  $("#chalShow").addEventListener("click", () => { S.chalRevealed = true; save(); renderChal(); });
  $("#chalApply").addEventListener("click", () => { S.chalRevealed = true; S.chalAccepted = true; save(); setGenre(challengeG); renderChal(); });
  $("#chalReroll").addEventListener("click", () => {
    if (S.chalRerolled || S.chalDone) return;
    S.chalRerolled = true; S.chalRerollSeed = Math.floor(Math.random() * 9973) + 1; save();
    computeChallenge(); if (S.chalAccepted) setGenre(challengeG); renderChal();
  });

  $("#spin").addEventListener("click", () => {
    const v = visible();
    if (!v.length) { $("#pick").textContent = "Nothing to spin — loosen filters."; return; }
    const w = $("#wheel"), turns = 4 + Math.random() * 3;
    w.style.setProperty("--final", turns * 360 + "deg");
    w.classList.remove("spinning"); void w.offsetWidth; w.classList.add("spinning");
    $("#pick").textContent = "spinning…";
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => {
      const choice = v[Math.floor(Math.random() * v.length)];
      w.textContent = "🍽️";
      const bonus = logPick(choice);
      $("#pick").innerHTML = `👉 <strong>${esc(choice.n)}</strong> — ${esc(choice.note)}` +
        (bonus ? ' <span style="color:var(--ok)">🎯 +50 challenge bonus!</span>' : "");
    }, reduce ? 50 : 3450);
  });
}

// ---------- weather paint ----------
function paintWeather(isOverride) {
  const w = WX || { raining: isRaining(), temp: null };
  const raining = isRaining();
  const [icon, label] = wxFace({ ...w, raining });
  $("#wxIcon").textContent = icon;
  $("#wxText").textContent = raining
    ? "Raining — outdoor spots are hidden. Pick covered/indoor or drive."
    : `${label} — outdoor spots are fair game.`;
  $("#wxMeta").textContent = (isOverride ? "manual override · " : "live · ") +
    (WX?.temp != null ? `${Math.round(WX.temp)}°C` : "weather unavailable");
  $("#wx").style.borderColor = raining ? "var(--warn)" : "var(--border)";
  $("#wxBtn").textContent = raining ? "Override: clear ☀️" : "Override: raining 🌧️";
}
async function loadWeather() {
  try { WX = await fetchWeather(); } catch { WX = null; }
  paintWeather(false);
  render();
}

// ---------- boot ----------
function buildGenreChips() {
  GENRES = [...new Set(PLACES.map((p) => p.g))].filter(Boolean).sort();
  // Default to Kopitiam when present (user preference); else fall back to "All".
  if (genre !== "All" && !GENRES.includes(genre)) genre = GENRES.includes("Kopitiam") ? "Kopitiam" : "All";
  $("#genres").innerHTML =
    '<span class="muted small">Genre:</span>' +
    ["All", ...GENRES].map((g) => `<button class="chip${g === genre ? " on" : ""}" data-g="${esc(g)}">${esc(g)}</button>`).join("");
}

async function boot() {
  resetDailyIfNeeded();
  renderGame();
  wireEvents();

  // RENDER-FIRST: show the curated fallback immediately so genres, filters,
  // search, spinner and the location button all work even if every network
  // call fails (CORS, offline, busy Overpass). Live data upgrades this later.
  PLACES = curatedWithDist();
  $("#count").dataset.src = "fallback";
  buildGenreChips();
  computeChallenge();
  renderChal();
  applyMode("walk", false); // sets slider range/unit + builds the gauge, then renders

  // Now enrich with live data + weather — failures here never break the UI.
  loadWeather().catch(() => {});
  loadPlaces().catch((e) => console.warn("live places failed, keeping fallback:", e));
}

async function loadPlaces() {
  const { places, source } = await fetchPlaces();
  // The curated list is PRIMARY data for Glenmarie (OSM barely maps this area),
  // so always merge it in — even when live OSM succeeds — deduped by name so a
  // spot OSM already has isn't listed twice. Previously, a successful live fetch
  // REPLACED the curated set, which hid the hand-added kopitiams (Thong Kee,
  // Meng Kee, etc.) whenever a mirror answered.
  const liveByName = new Set(places.map((p) => p.n.toLowerCase()));
  const curated = curatedWithDist().filter((c) => !liveByName.has(c.n.toLowerCase()));
  PLACES = places.concat(curated).sort((a, b) => a.dist - b.dist);
  showSource(source);
  buildGenreChips();
  computeChallenge();
  renderChal();
  render();
}

function showSource(source) {
  const el = $("#count");
  if (source === "fallback") {
    el.dataset.src = "fallback";
  } else {
    el.dataset.src = "live";
  }
  // The banner itself is rendered inside render() via the count line.
}

boot();
