import { ok, err } from "@/lib/api-helpers";
import { buildCostReference } from "@/lib/reference-prices";
import { cacheGet, cacheSet } from "@/lib/redis";

// GET /api/reference-prices — public. The demand-side cost reference plus the
// state of the supply-side receiving series. Cached ten minutes.

export async function GET() {
  const cached = await cacheGet<object>("refprices:v1");
  if (cached) return ok(cached);
  try {
    const ref = await buildCostReference();
    await cacheSet("refprices:v1", ref, 600);
    return ok(ref);
  } catch (e) {
    return err(e instanceof Error ? e.message : "reference computation failed", 500);
  }
}
