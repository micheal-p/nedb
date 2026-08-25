import { NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { getRedis } from "@/lib/redis";

// GET /api/health — is this service actually working?
//
// The previous version returned `cache: "ok"` in BOTH the success and the
// failure branch without ever touching Redis, so a dead cache reported healthy.
// A health check that cannot fail is worse than none at all, because it is
// trusted: an uptime monitor watching it would have stayed green through a
// complete cache outage.
//
// Each dependency is now probed and reported on its own. The endpoint answers
// 200 only when everything it depends on answered.

export const dynamic = "force-dynamic";

type Probe = { status: "ok" | "error" | "not-configured"; detail?: string; ms?: number };

async function timed(fn: () => Promise<unknown>): Promise<Probe> {
  const started = Date.now();
  try {
    await fn();
    return { status: "ok", ms: Date.now() - started };
  } catch (e) {
    return { status: "error", detail: e instanceof Error ? e.message : "unknown", ms: Date.now() - started };
  }
}

async function checkDb(): Promise<Probe> {
  return timed(async () => {
    // .select() alone does not throw on a query error, it returns one.
    const { error } = await db().from("series_types").select("id").limit(1);
    if (error) throw new Error(error.message);
  });
}

async function checkCache(): Promise<Probe> {
  const redis = getRedis();
  // Not configured is a deployment fact, not a failure. Said plainly so it is
  // never mistaken for a working cache.
  if (!redis) return { status: "not-configured", detail: "UPSTASH_REDIS_REST_URL or token absent" };
  return timed(async () => {
    // A round trip, not just a connection: write, read back, and compare.
    const key = "health:probe";
    const stamp = String(Date.now());
    await redis.set(key, stamp, { ex: 60 });
    const back = await redis.get<string>(key);
    if (String(back) !== stamp) throw new Error("value written to cache did not read back");
  });
}

export async function GET() {
  const [database, cache] = await Promise.all([checkDb(), checkCache()]);

  const failed = [database, cache].filter((p) => p.status === "error");
  const status = failed.length === 0 ? "ok" : "degraded";

  return NextResponse.json(
    { status, checks: { database, cache }, checked_at: new Date().toISOString() },
    { status: failed.length === 0 ? 200 : 503 }
  );
}
