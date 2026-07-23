// ── lib/nbs-benchmarks.ts ───────────────────────────────────────────────────
// NBS reference statistics for PENA coverage and poverty benchmarking.
// The live values are ADMIN-EDITABLE in the nbs_benchmarks table (036),
// managed at /admin/pena/benchmarks and served by /api/pena/benchmarks.
// This file holds the seed/fallback defaults (used until the table has rows)
// and the lookup/index helpers every consumer goes through.
//
// Default sources:
//  • Population — UN World Population Prospects 2024 revision, mid-2026
//    national estimate (242.43m), distributed across states by NPC/NBS 2006
//    census shares (no newer official per-state census exists).
//  • Poverty — NBS NLSS 2018/19 poverty headcount per state (the latest
//    published per-state monetary poverty table; Borno not published).

import { normLga } from "@/lib/geo";

export const NBS_POP_SOURCE = "UN WPP 2024 (mid-2026, 242.4m) distributed by NPC 2006 census shares";
export const NBS_POVERTY_SOURCE = "NBS NLSS 2018/19 poverty headcount";

export type NbsRow = {
  state_name: string;
  lga_name?: string | null;          // '' or null = state-level row
  population: number | null;
  poverty_rate: number | null;
  source?: string | null;
};

const DEFAULT_ROW_SOURCE = "UN WPP 2024 (mid-2026) distributed by 2006 census shares; NLSS 2018/19";

export const DEFAULT_NBS_ROWS: NbsRow[] = [
  { state_name: "NIGERIA", population: 242_430_000, poverty_rate: 40.1, source: "UN World Population Prospects 2024, mid-2026 estimate; NLSS 2018/19 national headcount" },
  { state_name: "Abia", population: 4_891_000, poverty_rate: 30.7, source: DEFAULT_ROW_SOURCE },
  { state_name: "Adamawa", population: 5_471_000, poverty_rate: 75.4, source: DEFAULT_ROW_SOURCE },
  { state_name: "Akwa Ibom", population: 6_767_000, poverty_rate: 26.8, source: DEFAULT_ROW_SOURCE },
  { state_name: "Anambra", population: 7_219_000, poverty_rate: 14.8, source: DEFAULT_ROW_SOURCE },
  { state_name: "Bauchi", population: 8_074_000, poverty_rate: 61.5, source: DEFAULT_ROW_SOURCE },
  { state_name: "Bayelsa", population: 2_940_000, poverty_rate: 22.6, source: DEFAULT_ROW_SOURCE },
  { state_name: "Benue", population: 7_283_000, poverty_rate: 32.9, source: DEFAULT_ROW_SOURCE },
  { state_name: "Borno", population: 7_166_000, poverty_rate: null, source: DEFAULT_ROW_SOURCE },
  { state_name: "Cross River", population: 4_987_000, poverty_rate: 36.3, source: DEFAULT_ROW_SOURCE },
  { state_name: "Delta", population: 7_074_000, poverty_rate: 6.0, source: DEFAULT_ROW_SOURCE },
  { state_name: "Ebonyi", population: 3_753_000, poverty_rate: 79.8, source: DEFAULT_ROW_SOURCE },
  { state_name: "Edo", population: 5_555_000, poverty_rate: 12.0, source: DEFAULT_ROW_SOURCE },
  { state_name: "Ekiti", population: 4_116_000, poverty_rate: 28.0, source: DEFAULT_ROW_SOURCE },
  { state_name: "Enugu", population: 5_623_000, poverty_rate: 58.1, source: DEFAULT_ROW_SOURCE },
  { state_name: "Gombe", population: 4_064_000, poverty_rate: 62.3, source: DEFAULT_ROW_SOURCE },
  { state_name: "Imo", population: 6_793_000, poverty_rate: 28.9, source: DEFAULT_ROW_SOURCE },
  { state_name: "Jigawa", population: 7_506_000, poverty_rate: 87.0, source: DEFAULT_ROW_SOURCE },
  { state_name: "Kaduna", population: 10_472_000, poverty_rate: 43.5, source: DEFAULT_ROW_SOURCE },
  { state_name: "Kano", population: 16_200_000, poverty_rate: 55.1, source: DEFAULT_ROW_SOURCE },
  { state_name: "Katsina", population: 9_999_000, poverty_rate: 56.4, source: DEFAULT_ROW_SOURCE },
  { state_name: "Kebbi", population: 5_592_000, poverty_rate: 50.2, source: DEFAULT_ROW_SOURCE },
  { state_name: "Kogi", population: 5_659_000, poverty_rate: 28.5, source: DEFAULT_ROW_SOURCE },
  { state_name: "Kwara", population: 4_093_000, poverty_rate: 20.4, source: DEFAULT_ROW_SOURCE },
  { state_name: "Lagos", population: 15_561_000, poverty_rate: 4.5, source: DEFAULT_ROW_SOURCE },
  { state_name: "Nasarawa", population: 3_216_000, poverty_rate: 57.3, source: DEFAULT_ROW_SOURCE },
  { state_name: "Niger", population: 6_819_000, poverty_rate: 66.1, source: DEFAULT_ROW_SOURCE },
  { state_name: "Ogun", population: 6_436_000, poverty_rate: 9.3, source: DEFAULT_ROW_SOURCE },
  { state_name: "Ondo", population: 5_940_000, poverty_rate: 12.5, source: DEFAULT_ROW_SOURCE },
  { state_name: "Osun", population: 5_909_000, poverty_rate: 8.5, source: DEFAULT_ROW_SOURCE },
  { state_name: "Oyo", population: 9_652_000, poverty_rate: 9.8, source: DEFAULT_ROW_SOURCE },
  { state_name: "Plateau", population: 5_488_000, poverty_rate: 55.1, source: DEFAULT_ROW_SOURCE },
  { state_name: "Rivers", population: 8_951_000, poverty_rate: 23.9, source: DEFAULT_ROW_SOURCE },
  { state_name: "Sokoto", population: 6_382_000, poverty_rate: 87.7, source: DEFAULT_ROW_SOURCE },
  { state_name: "Taraba", population: 3_971_000, poverty_rate: 87.7, source: DEFAULT_ROW_SOURCE },
  { state_name: "Yobe", population: 4_009_000, poverty_rate: 72.3, source: DEFAULT_ROW_SOURCE },
  { state_name: "Zamfara", population: 5_628_000, poverty_rate: 74.0, source: DEFAULT_ROW_SOURCE },
  { state_name: "Federal Capital Territory", population: 2_425_000, poverty_rate: 38.7, source: DEFAULT_ROW_SOURCE },
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
