import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth } from "@/lib/api-helpers";

// GET /api/admin/freshness — data-freshness board.
// For every series: latest national period, when it was entered, how it arrived
// (manual / upload / IoT / auto-ingested), and whether it is overdue given its
// cadence. An official statistics platform lives or dies on this discipline.

const MAX_AGE_DAYS: Record<string, number> = { monthly: 45, quarterly: 120, annual: 430 };

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const [{ data: series }, { data: latestRows }] = await Promise.all([
    db().from("series_types").select("id, name, sector, frequency, unit_default"),
    db()
      .from("energy_records")
      .select("series_type_id, period, period_date, created_at, source, notes, region")
      .order("period_date", { ascending: false })
      .limit(3000),
  ]);

  const latestBySeries = new Map<string, { period: string; period_date: string; created_at: string; source: string | null; notes: string | null }>();
  for (const r of latestRows ?? []) {
    const national = !r.region || ["NGA", "", "national"].includes(r.region);
    if (!national) continue;
    if (!latestBySeries.has(r.series_type_id)) latestBySeries.set(r.series_type_id, r);
  }

  const now = Date.now();
  const board = (series ?? []).map((s) => {
    const latest = latestBySeries.get(s.id);
    const maxAge = MAX_AGE_DAYS[s.frequency] ?? 430;
    const ageDays = latest ? Math.floor((now - new Date(latest.period_date).getTime()) / 86_400_000) : null;
    const via =
      !latest ? null
      : /IoT|EOM|sensor/i.test(`${latest.source} ${latest.notes}`) ? "iot"
      : /auto-ingested/i.test(`${latest.source} ${latest.notes}`) ? "auto"
      : "staff";
    return {
      id: s.id,
      name: s.name,
      sector: s.sector,
      frequency: s.frequency,
      unit: s.unit_default,
      latest_period: latest?.period ?? null,
      entered_at: latest?.created_at ?? null,
      age_days: ageDays,
      max_age_days: maxAge,
      via,
      status: !latest ? "empty" : (ageDays ?? 0) > maxAge * 2 ? "stale" : (ageDays ?? 0) > maxAge ? "overdue" : "fresh",
    };
  }).sort((a, b) => (b.age_days ?? 99999) - (a.age_days ?? 99999));

  return ok({
    board,
    summary: {
      fresh: board.filter((b) => b.status === "fresh").length,
      overdue: board.filter((b) => b.status === "overdue").length,
      stale: board.filter((b) => b.status === "stale").length,
      empty: board.filter((b) => b.status === "empty").length,
    },
  });
}
