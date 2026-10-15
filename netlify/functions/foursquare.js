// Netlify Function — Foursquare Places proxy.
//
// WHY THIS EXISTS: a static site cannot call Foursquare directly. Two hard
// blocks: (1) Foursquare forbids browser/CORS calls, and (2) putting the API
// key in client JS would leak it to anyone who views source. This function runs
// server-side on Netlify, holds the key in an env var, and returns clean JSON
// the browser CAN read (we add Access-Control-Allow-Origin here ourselves).
//
// SETUP (one-time):
//   1. Get a free Foursquare Places API key (no credit card):
//      https://location.foursquare.com/developer/  → create a project → copy the
//      Service API Key (the new keys look like a long opaque string).
//   2. In Netlify: Site settings → Environment variables → add
//        FOURSQUARE_API_KEY = <your key>
//   3. Redeploy. The function is then live at /.netlify/functions/foursquare
//      (and at /api/foursquare via the redirect in netlify.toml).
//
// LOCAL DEV:  `netlify dev`  (reads a local .env — see .env.example), serves the
//             function at the same /api/foursquare path next to the static files.
//
// QUERY PARAMS (from the browser):
//   lat, lon   — required, search center
//   radius     — metres (default 2000, max 100000)
//   query      — optional text filter (e.g. "nasi lemak")
//   limit      — max results (default 50, Foursquare hard max 50)
//
// RESPONSE:  { places: [ { n, g, lat, lon, dist?, tags[], note, halal, out,
//                          src:"foursquare" } ], source:"foursquare" }
//            or { places:[], error:"..." } on failure (never throws to the client).

const FSQ_SEARCH = "https://api.foursquare.com/v3/places/search";

// Map Foursquare category names to the app's genre vocabulary.
function genreFromCategories(cats) {
  const text = (cats || []).map((c) => (c.name || "").toLowerCase()).join(" ");
  if (/kopitiam|coffee shop|kopi|white coffee|hainan/.test(text)) return "Kopitiam";
  if (/malaysian|mamak|nasi|satay/.test(text)) return "Malaysian";
  if (/dim sum|chinese|noodle|dumpling/.test(text)) return "Chinese";
  if (/japanese|sushi|ramen|izakaya/.test(text)) return "Japanese";
  if (/korean|bbq korean|bibimbap/.test(text)) return "Korean";
  if (/thai|tom yam/.test(text)) return "Thai";
  if (/indian|mamak|banana leaf|tandoor/.test(text)) return "Indian";
  if (/arab|lebanese|turkish|middle eastern|kebab|shawarma|mandi/.test(text)) return "Middle Eastern";
  if (/italian|pizza|pasta/.test(text)) return "Italian";
  if (/burger|fast food|fried chicken/.test(text)) return "Fast Food";
  if (/western|american|steak|grill|bar & grill/.test(text)) return "Western";
  if (/cafe|café|coffee|bakery|breakfast|brunch|dessert/.test(text)) return "Cafe";
  return "Other";
}

export const handler = async (event) => {
  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300", // 5 min — be kind to the free tier
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  const key = process.env.FOURSQUARE_API_KEY;
  if (!key) {
    // Soft failure: the app keeps working on OSM + curated. We say WHY, briefly.
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        places: [],
        source: "foursquare",
        error: "FOURSQUARE_API_KEY not set on the server (add it in Netlify env vars).",
      }),
    };
  }

  const p = event.queryStringParameters || {};
  const lat = parseFloat(p.lat);
  const lon = parseFloat(p.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ places: [], error: "lat and lon required" }) };
  }
  const radius = Math.min(parseInt(p.radius, 10) || 2000, 100000);
  const limit = Math.min(parseInt(p.limit, 10) || 50, 50);
  const query = (p.query || "").slice(0, 100);

  // Foursquare "fsq_category_ids" for Dining & Drinking is 13000; passing it
  // scopes results to food/drink venues. radius+ll+categories = nearby food.
  const params = new URLSearchParams({
    ll: `${lat},${lon}`,
    radius: String(radius),
    categories: "13000", // Dining and Drinking (top-level food category)
    sort: "DISTANCE",
    limit: String(limit),
    fields: "name,geocodes,location,categories,distance",
  });
  if (query) params.set("query", query);

  try {
    const res = await fetch(`${FSQ_SEARCH}?${params.toString()}`, {
      headers: { Authorization: key, Accept: "application/json" },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        statusCode: 200, // soft-fail so the client keeps its OSM+curated data
        headers: CORS,
        body: JSON.stringify({ places: [], source: "foursquare", error: `foursquare ${res.status}: ${detail.slice(0, 160)}` }),
      };
    }
    const j = await res.json();
    const places = (j.results || [])
      .map((v) => {
        const g = v.geocodes && (v.geocodes.main || v.geocodes.roof);
        if (!g || !Number.isFinite(g.latitude) || !Number.isFinite(g.longitude)) return null;
        const cats = v.categories || [];
        return {
          n: v.name,
          g: genreFromCategories(cats),
          lat: g.latitude,
          lon: g.longitude,
          dist: Number.isFinite(v.distance) ? v.distance : undefined, // metres, straight-line from FSQ
          tags: cats.slice(0, 3).map((c) => (c.name || "").toLowerCase().replace(/\s+/g, "-")).filter(Boolean),
          note: (cats[0] && cats[0].name) || "eatery",
          halal: /halal/i.test((cats.map((c) => c.name).join(" ") + " " + v.name)),
          out: false, // Foursquare v3 search doesn't expose outdoor seating cheaply
          src: "foursquare",
        };
      })
      .filter(Boolean);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ places, source: "foursquare" }) };
  } catch (e) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ places: [], source: "foursquare", error: String(e).slice(0, 160) }),
    };
  }
};
