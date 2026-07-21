import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth } from "@/lib/api-helpers";
import { normLga } from "@/lib/geo";
import { TIER_ORDER, VERIFY_TTL_HOURS } from "@/lib/pena";

// GET /api/pena/forms/:id/insights — full staff-side analytics for one
// assessment: headline stats, tier distribution, per-state and per-LGA
// aggregates (LGA keyed by normalized name for the choropleth), map points,
// and the energy-source breakdown. Staff view — points included.

type Row = {
  state_name: string | null; lga_name: string | null; lat: number | null; lng: number | null;
  income: number | null; light_hours: number | null; energy_expense: number | null;
  tier: string | null; answers: Record<string, unknown>; created_at: string;
  verify_status: string;
};

// Income histogram buckets (₦/month)
const INCOME_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "< 30k",      min: 0,       max: 30_000 },
  { label: "30–70k",     min: 30_000,  max: 70_000 },
  { label: "70–150k",    min: 70_000,  max: 150_000 },
  { label: "150–300k",   min: 150_000, max: 300_000 },
  { label: "300–600k",   min: 300_000, max: 600_000 },
  { label: "600k+",      min: 600_000, max: Infinity },
];

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const { id } = await params;

  const { data: form } = await db().from("pena_forms").select("id, title, slug, status, is_public_stats").eq("id", id).single();
  if (!form) return err("Assessment not found", 404);

  const { data: allQs } = await db()
    .from("pena_questions")
    .select("label, slug, qtype, analytics_key")
    .eq("form_id", form.id)
    .order("display_order");
  const srcSlug = (allQs ?? []).find((q) => q.analytics_key === "energy_source")?.slug ?? null;

  // Page through everything — assessments are field-survey sized, not big data
  const allRows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from("pena_responses")
      .select("state_name, lga_name, lat, lng, income, light_hours, energy_expense, tier, answers, created_at, verify_status")
      .eq("form_id", form.id)
      .range(from, from + 999);
    if (error) return err(error.message, 500);
    allRows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  // Only verified responses count toward every statistic. Pending rows are
  // reported separately; pending older than the TTL is shown as expired.
  const isFresh = (r: Row) => (Date.now() - new Date(r.created_at).getTime()) / 3_600_000 <= VERIFY_TTL_HOURS;
  const rows = allRows.filter((r) => r.verify_status === "verified");
  const pendingCount = allRows.filter((r) => r.verify_status === "pending" && isFresh(r)).length;
  const expiredCount = allRows.filter((r) => r.verify_status === "pending" && !isFresh(r)).length;

  const nums = (f: (r: Row) => number | null) => rows.map(f).filter((v): v is number => v != null && isFinite(v));
  const incomes  = nums((r) => r.income);
  const lights   = nums((r) => r.light_hours);
  const expenses = nums((r) => r.energy_expense);
  const burdens  = rows
    .filter((r) => r.income != null && r.income > 0 && r.energy_expense != null)
    .map((r) => (r.energy_expense! / r.income!) * 100);

  const tierDist = TIER_ORDER.map((t) => ({ tier: t, count: rows.filter((r) => r.tier === t).length }));
  const unclassified = rows.filter((r) => !r.tier).length;

  const groupBy = (key: (r: Row) => string | null) => {
    const g = new Map<string, Row[]>();
    for (const r of rows) {
      const k = key(r);
      if (!k) continue;
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(r);
    }
    return [...g.entries()].map(([name, rs]) => ({
      name,
      count: rs.length,
      avg_income: avg(rs.map((r) => r.income).filter((v): v is number => v != null)),
      avg_light_hours: avg(rs.map((r) => r.light_hours).filter((v): v is number => v != null)),
      avg_energy_expense: avg(rs.map((r) => r.energy_expense).filter((v): v is number => v != null)),
      tiers: TIER_ORDER.map((t) => rs.filter((r) => r.tier === t).length),
    })).sort((a, b) => b.count - a.count);
  };

  const byState = groupBy((r) => r.state_name);
  const byLga   = groupBy((r) => r.lga_name);

  // Choropleth feed, state-aware: "lga|state" → average income. Duplicate LGA
  // names across states (Surulere in Lagos AND Oyo…) stay separate.
  const geoPairs = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.lga_name || r.income == null) continue;
    const k = `${normLga(r.lga_name)}|${normLga(r.state_name ?? "")}`;
    if (!geoPairs.has(k)) geoPairs.set(k, []);
    geoPairs.get(k)!.push(r.income);
  }
  const lgaIncomeMap: Record<string, number> = {};
  for (const [k, vals] of geoPairs) lgaIncomeMap[k] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);

  const sources: Record<string, number> = {};
  if (srcSlug) {
    for (const r of rows) {
      const v = r.answers?.[srcSlug];
      if (typeof v === "string" && v) sources[v] = (sources[v] ?? 0) + 1;
    }
  }

  // Submissions per day, oldest → newest
  const byDay = new Map<string, number>();
  for (const r of rows) {
    const d = r.created_at?.slice(0, 10);
    if (d) byDay.set(d, (byDay.get(d) ?? 0) + 1);
  }
  const timeline = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const income_histogram = INCOME_BUCKETS.map((b) => ({
    label: b.label,
    count: incomes.filter((v) => v >= b.min && v < b.max).length,
  }));

  return ok({
    form: { id: form.id, title: form.title, slug: form.slug, status: form.status, is_public_stats: form.is_public_stats },
    questions: (allQs ?? []).map((q) => ({ label: q.label, slug: q.slug })),
    timeline,
    income_histogram,
    total: rows.length,
    pending: pendingCount,
    expired: expiredCount,
    stats: {
      avg_income: avg(incomes),          median_income: median(incomes),
      avg_light_hours: avg(lights),      avg_energy_expense: avg(expenses),
      avg_burden_pct: avg(burdens),      geocoded: rows.filter((r) => r.lat != null).length,
    },
    tier_distribution: tierDist,
    unclassified,
    by_state: byState,
    by_lga: byLga,
    lga_income_map: lgaIncomeMap,
    energy_sources: Object.entries(sources).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    points: rows
      .filter((r) => r.lat != null && r.lng != null)
      .map((r) => ({ lat: r.lat, lng: r.lng, tier: r.tier, income: r.income, lga: r.lga_name })),
  });
}
