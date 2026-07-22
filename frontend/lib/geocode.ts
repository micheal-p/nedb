// ── lib/geocode.ts (server-only) ────────────────────────────────────────────
// Single place-search implementation for Nigeria, shared by /api/geo/search
// (respondent autocomplete) and the PENA submit route (server-side fallback
// geocode). Google Places when GOOGLE_MAPS_API_KEY is set, else OSM Nominatim.
// Results cache in Redis for 7 days — the cache is also what keeps aggregate
// Nominatim traffic inside its 1 req/s usage policy.

import { cacheGet, cacheSet } from "@/lib/redis";

export type GeoHit = { display_name: string; lat: number; lng: number };

async function googleSearch(q: string, key: string, limit: number): Promise<GeoHit[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.formattedAddress,places.location",
    },
    body: JSON.stringify({ textQuery: q, regionCode: "NG", maxResultCount: limit }),
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

async function nominatimSearch(q: string, limit: number): Promise<GeoHit[]> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ng&limit=${limit}&q=${encodeURIComponent(q)}`;
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

/** Cached Nigeria place search. Never throws — geocoding is an enhancement. */
export async function searchPlacesNG(q: string, limit = 5): Promise<GeoHit[]> {
  const query = q.trim();
  if (query.length < 3) return [];
  const provider = process.env.GOOGLE_MAPS_API_KEY ? "g" : "osm";
  const cacheKey = `geo:ng:${provider}:${limit}:${query.toLowerCase()}`;
  const cached = await cacheGet<GeoHit[]>(cacheKey);
  if (cached) return cached;
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    const hits = key ? await googleSearch(query, key, limit) : await nominatimSearch(query, limit);
    await cacheSet(cacheKey, hits, 7 * 24 * 3600);
    return hits;
  } catch {
    return [];
  }
}
