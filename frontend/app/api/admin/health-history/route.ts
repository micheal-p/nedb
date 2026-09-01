import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";

// GET /api/admin/health-history — the platform's memory of itself: health
// snapshots for the chosen window, an uptime figure computed from them, the
// incident list (transitions into a bad state), and what the rate limiter is
// holding back right now.

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return err("admin required", 403);

  const hours = Math.min(24 * 30, Math.max(1, Number(new URL(req.url).searchParams.get("hours") ?? 168)));
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();

  const [{ data: snaps }, { data: rl }] = await Promise.all([
    db().from("health_snapshots")
      .select("checked_at, status, db_ok, db_ms, cache_status")
      .gte("checked_at", since)
      .order("checked_at", { ascending: true })
      .limit(5000),
    // Live limiter pressure: recent buckets only (last ~2h of epoch buckets
    // regardless of window length, keys carry their window)
    db().from("rate_limit_counters")
      .select("key, bucket, count")
      .order("count", { ascending: false })
      .limit(400),
  ]);

  const rows = snaps ?? [];
  const okCount = rows.filter((r) => r.status === "ok").length;
  const avgDbMs = rows.length
    ? Math.round(rows.reduce((s, r) => s + (r.db_ms ?? 0), 0) / rows.filter((r) => r.db_ms != null).length || 0)
    : null;

  // Incidents: entering a non-ok state from ok (or from nothing)
  const incidents: { at: string; status: string }[] = [];
  let prev = "ok";
  for (const r of rows) {
    if (r.status !== "ok" && prev === "ok") incidents.push({ at: r.checked_at, status: r.status });
    prev = r.status;
  }

  // Aggregate limiter keys (window suffix stripped for display)
  const byKey = new Map<string, number>();
  for (const r of rl ?? []) {
    const k = String(r.key).replace(/:\d+$/, "");
    byKey.set(k, (byKey.get(k) ?? 0) + Number(r.count));
  }
  const limiter = [...byKey.entries()].map(([key, hits]) => ({ key, hits }))
    .sort((a, b) => b.hits - a.hits).slice(0, 20);

  return ok({
    hours,
    samples: rows.length,
    uptime_pct: rows.length ? Math.round((okCount / rows.length) * 1000) / 10 : null,
    avg_db_ms: avgDbMs,
    incidents: incidents.slice(-25).reverse(),
    snapshots: rows.slice(-200),
    limiter,
    sampling_note: "Snapshots are written when /api/health is called, at most once a minute. Gaps mean nobody asked, not that the service was up — point an external monitor at /api/health for continuous coverage.",
  });
}
