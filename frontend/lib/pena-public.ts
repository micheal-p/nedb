// ── lib/pena-public.ts ──────────────────────────────────────────────────────
// The ONE implementation of PENA's publishable aggregates.
//
// Three surfaces publish PENA statistics outside the staff walls: the open-data
// page, frozen data vintages, and working papers. If each computed its own
// aggregates the k-anonymity floor would eventually be enforced in two places
// and forgotten in the third. So the privacy rules live here, once:
//   • aggregates only — no names, emails, phones, addresses, coordinates, or
//     row-level records ever appear in this output
//   • k-anonymity — any state/LGA group under K_ANON_MIN responses is
//     suppressed entirely, and below the floor overall only a count publishes

import { db } from "@/lib/supabase-server";
import { normLga } from "@/lib/geo";
import { TIER_ORDER, K_ANON_MIN } from "@/lib/pena";

type Row = {
  state_name: string | null; lga_name: string | null;
  income: number | null; light_hours: number | null; energy_expense: number | null;
  tier: string | null; answers: Record<string, unknown> | null;
};

export type PenaGroupAggregate = {
  name: string;
  state?: string | null;
  count: number;
  avg_income: number | null;
  avg_light_hours: number | null;
  avg_energy_expense: number | null;
  tiers: number[];
};

export type PenaPublicAggregates = {
  total_responses: number;
  /** Below the anonymity floor: only the count above is publishable. */
  collecting: boolean;
  stats: {
    avg_income: number | null;
    median_income: number | null;
    avg_light_hours: number | null;
    avg_energy_expense: number | null;
    /** Average share of income spent on energy, percent. */
    avg_burden_pct: number | null;
  } | null;
  tier_distribution: { tier: string; count: number }[] | null;
  /** Aggregate counts of the primary energy source answers — no raw answers leave. */
  energy_sources: { name: string; count: number }[];
  by_state: PenaGroupAggregate[];
  by_lga: PenaGroupAggregate[];
  lga_income_map: Record<string, number>;
};

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null && isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

// Median: the honest headline for skewed data like income — a few very high
// earners cannot distort it.
const median = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

/** Read every verified response for a form and fold it into publishable aggregates. */
export async function buildPublicAggregates(formId: number): Promise<PenaPublicAggregates> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from("pena_responses")
      .select("state_name, lga_name, income, light_hours, energy_expense, tier, answers")
      .eq("form_id", formId)
      .eq("verify_status", "verified")   // open data counts confirmed responses only
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  // Below the anonymity floor even the overall averages describe an
  // identifiable handful of people — publish only the progress count.
  if (rows.length < K_ANON_MIN) {
    return {
      total_responses: rows.length,
      collecting: true,
      stats: null,
      tier_distribution: null,
      energy_sources: [],
      by_state: [],
      by_lga: [],
      lga_income_map: {},
    };
  }

  const group = (key: (r: Row) => string | null): PenaGroupAggregate[] => {
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

  // (lga, state) pair grouping — duplicate LGA names across states stay separate
  const lgaPairs = new Map<string, { name: string; state: string | null; rs: Row[] }>();
  for (const r of rows) {
    if (!r.lga_name) continue;
    const k = JSON.stringify([r.lga_name, r.state_name ?? ""]);
    if (!lgaPairs.has(k)) lgaPairs.set(k, { name: r.lga_name, state: r.state_name, rs: [] });
    lgaPairs.get(k)!.rs.push(r);
  }
  const byLga: PenaGroupAggregate[] = [...lgaPairs.values()]
    .filter(({ rs }) => rs.length >= K_ANON_MIN)
    .map(({ name, state, rs }) => ({
      name,
      state,
      count: rs.length,
      avg_income: avg(rs.map((r) => r.income)),
      avg_light_hours: avg(rs.map((r) => r.light_hours)),
      avg_energy_expense: avg(rs.map((r) => r.energy_expense)),
      tiers: TIER_ORDER.map((t) => rs.filter((r) => r.tier === t).length),
    }))
    .sort((a, b) => b.count - a.count);

  // State-aware choropleth keys ("lga|state") — k floor applies per pair
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

  // Energy-source counts are aggregates over the whole (above-floor) sample.
  // The raw answers are read here and never emitted.
  const { data: srcQ } = await db()
    .from("pena_questions").select("slug").eq("form_id", formId).eq("analytics_key", "energy_source").limit(1);
  const srcSlug = srcQ?.[0]?.slug ?? null;
  const sourceCounts: Record<string, number> = {};
  if (srcSlug) {
    for (const r of rows) {
      const v = r.answers?.[srcSlug];
      if (typeof v === "string" && v) sourceCounts[v] = (sourceCounts[v] ?? 0) + 1;
    }
  }

  const burdens = rows
    .filter((r) => r.income != null && r.income > 0 && r.energy_expense != null)
    .map((r) => (r.energy_expense! / r.income!) * 100);

  return {
    total_responses: rows.length,
    collecting: false,
    stats: {
      avg_income: avg(rows.map((r) => r.income)),
      median_income: median(rows.map((r) => r.income)),
      avg_light_hours: avg(rows.map((r) => r.light_hours)),
      avg_energy_expense: avg(rows.map((r) => r.energy_expense)),
      avg_burden_pct: avg(burdens),
    },
    tier_distribution: TIER_ORDER.map((t) => ({ tier: t, count: rows.filter((r) => r.tier === t).length })),
    energy_sources: Object.entries(sourceCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    by_state: group((r) => r.state_name),
    by_lga: byLga,
    lga_income_map: lgaIncomeMap,
  };
}
