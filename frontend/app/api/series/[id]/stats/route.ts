import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: rows } = await db()
    .from("energy_records")
    .select("period, period_date, value, unit")
    .eq("series_type_id", id)
    .not("value", "is", null)
    .order("period_date", { ascending: false })
    .limit(120);

  const all = rows ?? [];
  const stats: Record<string, unknown> = { series_type_id: id, latest: null, latest_period: "", unit: "", yoy_pct: null, mom_pct: null, cagr: null, rolling_3: null, rolling_12: null };

  if (!all.length) return ok(stats);

  const latest = all[0];
  stats.latest       = latest.value;
  stats.latest_period = latest.period;
  stats.unit         = latest.unit;

  const yoyIdx = all.length >= 13 ? 12 : 1;
  if (all.length > yoyIdx) {
    const prev = all[yoyIdx].value;
    if (prev !== 0) stats.yoy_pct = ((latest.value - prev) / Math.abs(prev)) * 100;
  }
  if (all.length >= 2) {
    const prev = all[1].value;
    if (prev !== 0) stats.mom_pct = ((latest.value - prev) / Math.abs(prev)) * 100;
  }
  if (all.length >= 2) {
    const oldest = all[all.length - 1];
    const years = (new Date(latest.period_date).getTime() - new Date(oldest.period_date).getTime()) / (1000 * 60 * 60 * 8760);
    if (oldest.value > 0 && years > 0)
      stats.cagr = (Math.pow(latest.value / oldest.value, 1 / years) - 1) * 100;
  }
  if (all.length >= 3)
    stats.rolling_3 = (all[0].value + all[1].value + all[2].value) / 3;
  if (all.length >= 12)
    stats.rolling_12 = all.slice(0, 12).reduce((s: number, r: { value: number }) => s + r.value, 0) / 12;

  return ok(stats);
}
