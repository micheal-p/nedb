import { NextRequest } from "next/server";
import { ok, err, requireAuth } from "@/lib/api-helpers";
import { getRedis } from "@/lib/redis";

// POST /api/brief-ref — issue a sequential document reference for a generated
// Energy Brief and log who it was issued to. A reference that changes on every
// render is theatre; this one is issued once per generated brief, in sequence,
// and auditable.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const redis = getRedis();
  if (!redis) return err("Reference service unavailable", 503);

  const { profile, year } = (await req.json().catch(() => ({}))) as { profile?: string; year?: number };
  const y = typeof year === "number" && year > 2000 && year < 2100 ? year : new Date().getFullYear();

  const seq = await redis.incr(`nedb:brief_ref:${y}`);
  const ref = `NEDB/EB/${y}/${String(seq).padStart(5, "0")}`;

  // Audit trail: newest first, capped so the log cannot grow unbounded.
  await redis.lpush(
    "nedb:brief_ref:log",
    JSON.stringify({ ref, profile: profile ?? null, year: y, issued_to: auth.sub ?? null, at: new Date().toISOString() })
  );
  await redis.ltrim("nedb:brief_ref:log", 0, 4999);

  return ok({ ref });
}
