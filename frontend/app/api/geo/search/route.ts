import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { checkRateLimitDurable } from "@/lib/rate-limit";
import { cacheGet, cacheSet } from "@/lib/redis";

// GET /api/geo/search?q=... — place autocomplete for PENA address questions.
// Runs server-side (no key or CORS issues reach the browser), caches results
// in Redis for 7 days, and rate-limits per IP.
// Provider: Google Places when GOOGLE_MAPS_API_KEY is set (cleaner Nigerian
// address matching — needs a billing-enabled Google Cloud key), otherwise OSM
// Nominatim (free, no key; stays inside its 1 req/s usage policy).

type GeoHit = { display_name: string; lat: number; lng: number };

async function googleSearch(q: string, key: string): Promise<GeoHit[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.formattedAddress,places.location",
    },
    body: JSON.stringify({ textQuery: q, regionCode: "NG", maxResultCount: 5 }),
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return [];
  const j = await res.json();
  return (j.places ?? [])
    .map((p: { formattedAddress: string; location: { latitude: number; longitude: number } }) => ({
      display_name: p.formattedAddress,
      lat: p.location?.latitude,
      lng: p.location?.longitude,
    }))
    .filter((h: GeoHit) => isFinite(h.lat) && isFinite(h.lng));
}

async function nominatimSearch(q: string): Promise<GeoHit[]> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ng&limit=5&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "NEDB/1.0 (Nigeria Energy Data Bank; energy assessment geocoding)" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return [];
  const raw: { display_name: string; lat: string; lon: string }[] = await res.json();
  return raw
    .map((r) => ({ display_name: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }))
    .filter((r) => isFinite(r.lat) && isFinite(r.lng));
}

export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 3) return ok([]);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = await checkRateLimitDurable(`geo:${ip}`, 30, 60);
  if (!rl.allowed) return err("Too many searches — slow down a little.", 429);

  const provider = process.env.GOOGLE_MAPS_API_KEY ? "g" : "osm";
  const cacheKey = `geo:ng:${provider}:${q.toLowerCase()}`;
  const cached = await cacheGet<GeoHit[]>(cacheKey);
  if (cached) return ok(cached);

  try {
    const gkey = process.env.GOOGLE_MAPS_API_KEY;
    const hits = gkey ? await googleSearch(q, gkey) : await nominatimSearch(q);
    await cacheSet(cacheKey, hits, 7 * 24 * 3600);
    return ok(hits);
  } catch {
    return ok([]); // geocoding is an enhancement — never block the form on it
  }
}
