// ── lib/nbs-benchmarks.ts ───────────────────────────────────────────────────
// NBS reference statistics for PENA coverage and poverty benchmarking.
// The live values are ADMIN-EDITABLE in the nbs_benchmarks table (036),
// managed at /admin/pena/benchmarks and served by /api/pena/benchmarks.
// This file holds the seed/fallback defaults (used until the table has rows)
// and the lookup/index helpers every consumer goes through.
//
// Default sources:
//  • Population — NPC/NBS 2006 census projected to the NBS 2022 national
//    estimate (~216.8m) by census shares.
//  • Poverty — NBS NLSS 2018/19 poverty headcount per state (the latest
//    published per-state monetary poverty table; Borno not published).

import { normLga } from "@/lib/geo";

export const NBS_POP_SOURCE = "NPC/NBS 2006 Census projected to NBS 2022 estimate";
export const NBS_POVERTY_SOURCE = "NBS NLSS 2018/19 poverty headcount";

export type NbsRow = {
  state_name: string;
  lga_name?: string | null;          // '' or null = state-level row
  population: number | null;
  poverty_rate: number | null;
};

export const DEFAULT_NBS_ROWS: NbsRow[] = [
  { state_name: "NIGERIA", population: 216_783_400, poverty_rate: 40.1 },
  { state_name: "Abia", population: 4_373_000, poverty_rate: 30.7 },
  { state_name: "Adamawa", population: 4_892_000, poverty_rate: 75.4 },
  { state_name: "Akwa Ibom", population: 6_051_000, poverty_rate: 26.8 },
  { state_name: "Anambra", population: 6_456_000, poverty_rate: 14.8 },
  { state_name: "Bauchi", population: 7_220_000, poverty_rate: 61.5 },
  { state_name: "Bayelsa", population: 2_629_000, poverty_rate: 22.6 },
  { state_name: "Benue", population: 6_513_000, poverty_rate: 32.9 },
  { state_name: "Borno", population: 6_408_000, poverty_rate: null },
  { state_name: "Cross River", population: 4_460_000, poverty_rate: 36.3 },
  { state_name: "Delta", population: 6_326_000, poverty_rate: 6.0 },
  { state_name: "Ebonyi", population: 3_356_000, poverty_rate: 79.8 },
  { state_name: "Edo", population: 4_968_000, poverty_rate: 12.0 },
  { state_name: "Ekiti", population: 3_680_000, poverty_rate: 28.0 },
  { state_name: "Enugu", population: 5_028_000, poverty_rate: 58.1 },
  { state_name: "Gombe", population: 3_634_000, poverty_rate: 62.3 },
  { state_name: "Imo", population: 6_074_000, poverty_rate: 28.9 },
  { state_name: "Jigawa", population: 6_712_000, poverty_rate: 87.0 },
  { state_name: "Kaduna", population: 9_364_000, poverty_rate: 43.5 },
  { state_name: "Kano", population: 14_486_000, poverty_rate: 55.1 },
  { state_name: "Katsina", population: 8_941_000, poverty_rate: 56.4 },
  { state_name: "Kebbi", population: 5_000_000, poverty_rate: 50.2 },
  { state_name: "Kogi", population: 5_060_000, poverty_rate: 28.5 },
  { state_name: "Kwara", population: 3_660_000, poverty_rate: 20.4 },
  { state_name: "Lagos", population: 13_915_000, poverty_rate: 4.5 },
  { state_name: "Nasarawa", population: 2_876_000, poverty_rate: 57.3 },
  { state_name: "Niger", population: 6_098_000, poverty_rate: 66.1 },
  { state_name: "Ogun", population: 5_755_000, poverty_rate: 9.3 },
  { state_name: "Ondo", population: 5_312_000, poverty_rate: 12.5 },
  { state_name: "Osun", population: 5_284_000, poverty_rate: 8.5 },
  { state_name: "Oyo", population: 8_631_000, poverty_rate: 9.8 },
  { state_name: "Plateau", population: 4_907_000, poverty_rate: 55.1 },
  { state_name: "Rivers", population: 8_004_000, poverty_rate: 23.9 },
  { state_name: "Sokoto", population: 5_707_000, poverty_rate: 87.7 },
  { state_name: "Taraba", population: 3_551_000, poverty_rate: 87.7 },
  { state_name: "Yobe", population: 3_584_000, poverty_rate: 72.3 },
  { state_name: "Zamfara", population: 5_032_000, poverty_rate: 74.0 },
  { state_name: "Federal Capital Territory", population: 2_169_000, poverty_rate: 38.7 },
];

// FCT appears under several names across data sources and boundary files.
const ALIASES: Record<string, string> = {
  "fct": "federal capital territory",
  "abuja": "federal capital territory",
  "fct abuja": "federal capital territory",
  "abuja federal capital territory": "federal capital territory",
};

export function normStateKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const k = normLga(name);
  return ALIASES[k] ?? k;
}

export type BenchmarkIndex = {
  national: number | null;
  state: (name: string | null | undefined) => { population: number | null; poverty_rate: number | null } | null;
  lga: (lga: string | null | undefined, state: string | null | undefined) => number | null;
};

export function buildBenchmarkIndex(rows: NbsRow[]): BenchmarkIndex {
  const states = new Map<string, { population: number | null; poverty_rate: number | null }>();
  const lgas = new Map<string, number>();
  let national: number | null = null;
  for (const r of rows) {
    const sk = normStateKey(r.state_name);
    if (!sk) continue;
    const lgaName = r.lga_name?.trim();
    if (lgaName) {
      if (r.population != null) lgas.set(`${normLga(lgaName)}|${sk}`, r.population);
    } else if (sk === "nigeria") {
      national = r.population;
    } else {
      states.set(sk, { population: r.population, poverty_rate: r.poverty_rate });
    }
  }
  return {
    national,
    state: (name) => {
      const k = normStateKey(name);
      return k ? states.get(k) ?? null : null;
    },
    lga: (lga, state) => {
      const sk = normStateKey(state);
      if (!lga || !sk) return null;
      return lgas.get(`${normLga(lga)}|${sk}`) ?? null;
    },
  };
}

// Coverage expressed as responses per 100,000 residents — percentages of a
// multi-million population read as 0.000x% and communicate nothing.
export function coveragePer100k(responses: number, population: number | null): number | null {
  if (!population || population <= 0) return null;
  return (responses / population) * 100_000;
}
