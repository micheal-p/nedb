import { ok, err } from "@/lib/api-helpers";
import { buildEpi } from "@/lib/epi";
import { cacheGet, cacheSet } from "@/lib/redis";

// GET /api/epi — the Energy Poverty Index, public. Movement publishes only
// when a second wave of the same population clears the privacy floor.

export async function GET() {
  const cached = await cacheGet<object>("epi:v1");
  if (cached) return ok(cached);
  try {
    const epi = await buildEpi();
    await cacheSet("epi:v1", epi, 600);
    return ok(epi);
  } catch (e) {
    return err(e instanceof Error ? e.message : "index computation failed", 500);
  }
}
