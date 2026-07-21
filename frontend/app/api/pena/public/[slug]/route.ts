import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { normLga } from "@/lib/geo";
import { TIER_ORDER, K_ANON_MIN } from "@/lib/pena";
import { cacheGet, cacheSet } from "@/lib/redis";

// GET /api/pena/public/:slug — open-data aggregates for a published assessment.
// NDPA 2023 safeguards, enforced here and nowhere overridable:
//   • aggregates only — no names, emails, phones, addresses, coordinates, or
//     row-level records ever appear in this payload
//   • k-anonymity — any state/LGA group with fewer than K_ANON_MIN responses
//     is suppressed entirely
// Cached 10 min; the staff-side insights route stays live and unredacted.

type Row = {
  state_name: string | null; lga_name: string | null;
  income: number | null; light_hours: number | null; energy_expense: number | null;
  tier: string | null;
};

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null && isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const cacheKey = `pena:pub:${slug}`;
  const cached = await cacheGet<object>(cacheKey);
  if (cached) return ok(cached);

  const { data: form } = await db()
    .from("pena_forms")
    .select("id, slug, title, description, status, is_public_stats, created_at")
    .eq("slug", slug)
    .single();
  if (!form || !form.is_public_stats || form.status === "draft") return err("Assessment not found", 404);

  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from("pena_responses")
      .select("state_name, lga_name, income, light_hours, energy_expense, tier")
      .eq("form_id", form.id)
      .eq("verify_status", "verified")   // open data counts confirmed responses only
      .range(from, from + 999);
    if (error) return err(error.message, 500);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const group = (key: (r: Row) => string | null) => {
    const g = new Map<string, Row[]>();
    for (const r of rows) {
      const k = key(r);
      if (!k) continue;
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(r);
    }
    return [...g.entries()]
      .filter(([, rs]) => rs.length >= K_ANON_MIN)   // k-anonymity floor
      .map(([name, rs]) => ({
        name,
        count: rs.length,
        avg_income: avg(rs.map((r) => r.income)),
        avg_light_hours: avg(rs.map((r) => r.light_hours)),
        avg_energy_expense: avg(rs.map((r) => r.energy_expense)),
        tiers: TIER_ORDER.map((t) => rs.filter((r) => r.tier === t).length),
      }))
      .sort((a, b) => b.count - a.count);
  };

  const byLga = group((r) => r.lga_name);
  // State-aware choropleth keys ("lga|state") — duplicate LGA names across
  // states stay separate. k-anonymity floor applies per (lga, state) group.
  const geoPairs = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.lga_name || r.income == null) continue;
    const k = `${normLga(r.lga_name)}|${normLga(r.state_name ?? "")}`;
    if (!geoPairs.has(k)) geoPairs.set(k, []);
    geoPairs.get(k)!.push(r.income);
  }
  const lgaIncomeMap: Record<string, number> = {};
  for (const [k, vals] of geoPairs) {
    if (vals.length >= K_ANON_MIN) lgaIncomeMap[k] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  const payload = {
    assessment: { slug: form.slug, title: form.title, description: form.description, status: form.status, created_at: form.created_at },
    license: "Open data — k-anonymised aggregates (groups under " + K_ANON_MIN + " responses suppressed). Personal data withheld under NDPA 2023.",
    total_responses: rows.length,
    stats: {
      avg_income: avg(rows.map((r) => r.income)),
      avg_light_hours: avg(rows.map((r) => r.light_hours)),
      avg_energy_expense: avg(rows.map((r) => r.energy_expense)),
    },
    tier_distribution: TIER_ORDER.map((t) => ({ tier: t, count: rows.filter((r) => r.tier === t).length })),
    by_state: group((r) => r.state_name),
    by_lga: byLga,
    lga_income_map: lgaIncomeMap,
  };

  await cacheSet(cacheKey, payload, 600);
  return ok(payload);
}
