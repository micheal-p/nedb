// ── lib/reference-prices.ts ─────────────────────────────────────────────────
// The Household Energy Cost Reference: the demand side of the reference
// price series, computed from what households actually report paying and
// receiving. Nobody in Nigeria publishes an authoritative benchmark; the
// data bank holds the raw material and now states the number.
//
//   spend_per_lit_hour = monthly energy expense ÷ (daily supply hours × 30)
//
// Deliberately NOT called a ₦/kWh price: households buy candles, fuel and
// generator-hours, not metered units, and pretending otherwise would put a
// false precision on an honest measure. k-anonymity applies exactly as on
// every other public PENA surface.

import { db } from "@/lib/supabase-server";
import { K_ANON_MIN } from "@/lib/pena";

export type CostReference = {
  computed_at: string;
  method: string;
  national: { n: number; median_spend_per_lit_hour: number | null; avg_burden_pct: number | null } | null;
  by_state: { state: string; n: number; median_spend_per_lit_hour: number | null; avg_burden_pct: number | null }[];
  supply_side: { series: string; name: string; records: number }[];
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

export async function buildCostReference(): Promise<CostReference> {
  const rows: { state_name: string | null; income: number | null; light_hours: number | null; energy_expense: number | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from("pena_responses")
      .select("state_name, income, light_hours, energy_expense")
      .eq("verify_status", "verified")
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const usable = rows.filter((r) => r.energy_expense != null && r.light_hours != null && r.light_hours > 0);
  const perLit = (r: typeof usable[number]) => r.energy_expense! / (r.light_hours! * 30);
  const burden = (r: typeof usable[number]) => (r.income && r.income > 0 && r.energy_expense != null ? (r.energy_expense / r.income) * 100 : null);

  const agg = (set: typeof usable) => {
    const burdens = set.map(burden).filter((v): v is number => v != null);
    return {
      n: set.length,
      median_spend_per_lit_hour: median(set.map(perLit)),
      avg_burden_pct: burdens.length ? burdens.reduce((a, b) => a + b, 0) / burdens.length : null,
    };
  };

  const byState = new Map<string, typeof usable>();
  for (const r of usable) {
    if (!r.state_name) continue;
    if (!byState.has(r.state_name)) byState.set(r.state_name, []);
    byState.get(r.state_name)!.push(r);
  }

  // Supply side: the receiving series, honest about how much they hold.
  const { data: supply } = await db()
    .from("energy_records")
    .select("series_type_id")
    .in("series_type_id", ["ppa_tariff", "solar_capex_tender"]);
  const counts = new Map<string, number>();
  for (const r of supply ?? []) counts.set(r.series_type_id, (counts.get(r.series_type_id) ?? 0) + 1);

  return {
    computed_at: new Date().toISOString(),
    method: `Median household spend per hour of electricity received (monthly energy expense ÷ (daily supply hours × 30)) and average energy burden (expense ÷ income). Verified assessment responses only; any state under the ${K_ANON_MIN}-response privacy floor is withheld.`,
    national: usable.length >= K_ANON_MIN ? agg(usable) : null,
    by_state: [...byState.entries()]
      .filter(([, set]) => set.length >= K_ANON_MIN)
      .map(([state, set]) => ({ state, ...agg(set) }))
      .sort((a, b) => (b.median_spend_per_lit_hour ?? 0) - (a.median_spend_per_lit_hour ?? 0)),
    supply_side: [
      { series: "ppa_tariff", name: "PPA Tariff (Signed)", records: counts.get("ppa_tariff") ?? 0 },
      { series: "solar_capex_tender", name: "Solar Tender Capex (Awarded)", records: counts.get("solar_capex_tender") ?? 0 },
    ],
  };
}
