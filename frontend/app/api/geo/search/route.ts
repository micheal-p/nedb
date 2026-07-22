import { NextRequest } from "next/server";
import { ok, err } from "@/lib/api-helpers";
import { checkRateLimitDurable } from "@/lib/rate-limit";
import { searchPlacesNG } from "@/lib/geocode";

// GET /api/geo/search?q=... — place autocomplete for PENA address questions.
// Thin rate-limited wrapper over the shared cached geocoder (lib/geocode.ts).

export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 3) return ok([]);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = await checkRateLimitDurable(`geo:${ip}`, 30, 60);
  if (!rl.allowed) return err("Too many searches — slow down a little.", 429);

  return ok(await searchPlacesNG(q, 5));
}
