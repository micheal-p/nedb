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

// A health endpoint that hangs is its own kind of outage: monitors give up and
// report the whole service down. An unreachable dependency took 4.5s to fail on
// DNS alone, so each probe is bounded and a timeout is reported as what it is.
const PROBE_TIMEOUT_MS = 3000;

async function timed(fn: () => Promise<unknown>): Promise<Probe> {
  const started = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`did not answer within ${PROBE_TIMEOUT_MS}ms`)), PROBE_TIMEOUT_MS)
      ),
    ]);
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
  const checks = { database, cache };

  const failed = Object.values(checks).filter((p) => p.status === "error");

  // "Not configured" is fine in development and is not fine in production: it
  // means the deployment is running without something it was built to have. It
  // does not warrant a 503, because the service genuinely works, but reporting
  // it as plain "ok" is how production ran without a cache unnoticed.
  const unconfigured = Object.entries(checks)
    .filter(([, p]) => p.status === "not-configured")
    .map(([name]) => name);
  const inProduction = process.env.NODE_ENV === "production";

  const status =
    failed.length > 0 ? "unhealthy"
    : unconfigured.length > 0 && inProduction ? "degraded"
    : "ok";

  // The snapshot is the console's memory: written at most once a minute, and
  // never allowed to break the health answer itself.
  try {
    const { data: lastRow } = await db()
      .from("health_snapshots").select("checked_at").order("checked_at", { ascending: false }).limit(1);
    const last = lastRow?.[0]?.checked_at ? new Date(lastRow[0].checked_at).getTime() : 0;
    if (Date.now() - last > 60_000) {
      await db().from("health_snapshots").insert({
        status: failed.length > 0 ? "down" : status,
        db_ok: database.status === "ok",
        db_ms: database.ms ?? null,
        cache_status: cache.status,
        detail: failed.length ? { failed: checks } : null,
      });
    }
  } catch { /* the record must never break the reading */ }

  return NextResponse.json(
    {
      status,
      checks,
      ...(unconfigured.length && inProduction
        ? { warnings: unconfigured.map((n) => `${n} is not configured in production`) }
        : {}),
      checked_at: new Date().toISOString(),
    },
    { status: failed.length > 0 ? 503 : 200 }
  );
}
