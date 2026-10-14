// Glenmarie Lunch Picker — real deployable web app
// Live places: OpenStreetMap Overpass API (no key).
// Live weather: Open-Meteo (no key).
// State: localStorage. No backend required.

// --- The Glenz @ Glenmarie ---
// 6, Jalan Juruanalisis U1/35, Hicom-Glenmarie Industrial Park, 40150 Shah Alam, Selangor.
// Exact coordinate confirmed by the user from Google Maps.
const GLENZ = { lat: 3.081571076828667, lon: 101.5625779089501, name: "The Glenz @ Glenmarie" };
let ORIGIN = { ...GLENZ }; // mutable: geolocation can override it

const SEARCH_RADIUS_M = 6000; // wide enough to include the SS15/SS16/NU Empire cluster (~5 km by road)
const WALK_SPEED_M_PER_MIN = 80; // ~4.8 km/h

// Overpass endpoints (tried in order; public mirrors are frequently busy — 429/504/406).
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

// Research-grounded seed list near The Glenz, Glenmarie. Used ONLY when every
// Overpass mirror is unreachable, so the app always renders something usable.
// Distances are approximate straight-line metres from ORIGIN.
const FALLBACK_PLACES = [
  { n: "TheFOODtree Restaurant", g: "Western", dist: 650, out: true, halal: true, tags: ["alfresco", "family"], note: "alfresco local & western" },
  { n: "Mozer's @ Shah Alam", g: "Middle Eastern", dist: 1200, out: true, halal: true, tags: ["syrian", "shawarma"], note: "lamb shawarma, shish kebab" },
  { n: "Al-Sultan Restaurant", g: "Middle Eastern", dist: 900, out: false, halal: true, tags: ["mandi", "grill"], note: "Yemeni mandi & charcoal grills" },
  { n: "Hilton Glenmarie Dining", g: "Japanese", dist: 700, out: false, halal: false, tags: ["buffet", "premium"], note: "Japanese + garden terrace" },
  { n: "Glenmarie Golf Clubhouse", g: "Western", dist: 1500, out: true, halal: true, tags: ["view", "sit-down"], note: "poolside / golf-view dining" },
  { n: "Mamak / Nasi Kandar", g: "Malaysian", dist: 450, out: true, halal: true, tags: ["cheap", "roti", "fast"], note: "classic mamak, fast & cheap" },
  { n: "Economy Rice (Nasi Campur)", g: "Malaysian", dist: 400, out: false, halal: true, tags: ["cheap", "rice", "fast"], note: "mixed rice, quick pick" },
  { n: "Chinese Noodle House", g: "Chinese", dist: 1100, out: false, halal: false, tags: ["noodles", "wok"], note: "hor fun, wantan mee, zi char" },
  { n: "Western Grill Cafe", g: "Western", dist: 600, out: false, halal: true, tags: ["burger", "cafe"], note: "chicken chop, burgers, pasta" },
  { n: "Brunch & Coffee Spot", g: "Cafe", dist: 550, out: true, halal: true, tags: ["coffee", "brunch"], note: "light brunch & good coffee" },
  { n: "Thai Street Food", g: "Thai", dist: 1300, out: false, halal: true, tags: ["spicy", "tomyam"], note: "tom yam, basil chicken rice" },
  { n: "Korean BBQ / Bibimbap", g: "Korean", dist: 1600, out: false, halal: false, tags: ["bbq", "rice"], note: "bibimbap, grilled sets" },
];

// Popular local spots NOT in OpenStreetMap for this area (OSM is community-
// mapped and misses many kopitiams). Merged into live results. They carry a
// coordinate (anchored to the verified NU Empire / SS16 cluster, 3.0812,
// 101.5826) so their distance is COMPUTED from the real origin — not a
// hardcoded guess. `est: true` just flags that the coordinate is approximate.
const LOCAL_EXTRAS = [
  { n: "Mengkee Kopitiam", g: "Kopitiam", lat: 3.0812, lon: 101.5826, out: false, halal: false, tags: ["kopitiam", "wantan-mee", "local"], note: "coffeeshop · noodles & kopi", est: true },
  { n: "Thong Kee Kopitiam", g: "Kopitiam", lat: 3.0812, lon: 101.5826, out: false, halal: false, tags: ["kopitiam", "hainan", "toast"], note: "Hainanese coffee, toast, local fare", est: true },
];

// ---------- utilities ----------
const $ = (s) => document.querySelector(s);
const haversine = (a, b) => {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
};
const walkMins = (m) => Math.max(1, Math.round(m / WALK_SPEED_M_PER_MIN));
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
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(q),
      });
      if (!res.ok) continue; // 429/504/406 → try next mirror
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json")) continue; // busy mirrors return an HTML error page
      const data = await res.json();
      const places = normalizePlaces(data.elements || []);
      if (places.length) return { places, source: "live" };
    } catch (_) { /* network error → try next mirror */ }
  }
  // Every mirror failed — degrade gracefully to the grounded seed list.
  return { places: FALLBACK_PLACES.slice().sort((a, b) => a.dist - b.dist), source: "fallback" };
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
let mode = "walk", wmax = 800, genre = "All", rainOverride = null;
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
    if (mode === "walk" && p.dist > wmax) return false;
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
    ? ' · <span style="color:var(--warn)">⚠️ offline sample (Overpass busy) <button id="retry" class="btn" style="padding:2px 8px;font-size:11px">retry live</button></span>'
    : "";
  $("#count").innerHTML = `${v.length} spot${v.length !== 1 ? "s" : ""} match${extra}${src}`;
  const retry = $("#retry");
  if (retry) retry.addEventListener("click", () => { $("#count").dataset.src = "live"; loadPlaces(); });
  const list = $("#list");
  if (!v.length) { list.innerHTML = '<div class="empty">No matches. Loosen filters, raise the walk limit, or switch to 🚗 Drive.</div>'; return; }
  list.innerHTML = v.map((p) => {
    const approx = p.est ? "~" : "";
    const reach = p.dist <= wmax ? `🚶 ${approx}${walkMins(p.dist)} min (${approx}${p.dist}m)` : `🚗 drive (${approx}${p.dist}m)`;
    const star = p.g === challengeG ? ' <span title="today\'s challenge cuisine">🎯</span>' : "";
    const halal = p.halal ? ' <span class="badge-halal">● halal</span>' : "";
    const estTag = p.est ? ' <span class="badge-out" title="Not in OpenStreetMap — hand-added, distance is an estimate">✎ added</span>' : "";
    const out = p.out ? ' · <span class="badge-out">⛅ outdoor</span>' : "";
    const tags = p.tags.length ? p.tags.map((t) => "#" + t).join(" ") : "";
    return `<div class="row">
      <div>
        <div class="row-name">${esc(p.n)}${star}${halal}${estTag}</div>
        <div class="row-sub">${esc(p.g)} · ${esc(p.note)}</div>
        <div class="row-tags">${esc(tags)}${out}</div>
      </div>
      <div class="row-reach">${reach}</div>
    </div>`;
  }).join("");
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// ---------- events ----------
function wireEvents() {
  $("#q").addEventListener("input", render);
  $("#wmax").addEventListener("input", (e) => { wmax = +e.target.value; $("#wlab").textContent = wmax; render(); });
  document.querySelectorAll("[data-mode]").forEach((el) => el.addEventListener("click", () => {
    document.querySelectorAll("[data-mode]").forEach((x) => x.classList.remove("on"));
    el.classList.add("on"); mode = el.dataset.mode; $("#wmax").disabled = mode === "drive"; render();
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
  $("#genres").innerHTML =
    '<span class="muted small">Genre:</span>' +
    ["All", ...GENRES].map((g) => `<button class="chip${g === "All" ? " on" : ""}" data-g="${esc(g)}">${esc(g)}</button>`).join("");
}

async function boot() {
  resetDailyIfNeeded();
  renderGame();
  wireEvents();
  $("#list").innerHTML = '<div class="loading">📍 Finding food near The Glenz…</div>';
  loadWeather();
  await loadPlaces();
}

async function loadPlaces() {
  const { places, source } = await fetchPlaces();
  // Merge curated local spots that OSM is missing, skipping any the live data already has.
  const have = new Set(places.map((p) => p.n.toLowerCase()));
  const extras = LOCAL_EXTRAS
    .filter((e) => !have.has(e.n.toLowerCase()))
    .map((e) => ({ ...e, dist: haversine(ORIGIN, { lat: e.lat, lon: e.lon }) }));
  PLACES = places.concat(extras).sort((a, b) => a.dist - b.dist);
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
