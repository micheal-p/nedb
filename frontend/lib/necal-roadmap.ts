// ── lib/necal-roadmap.ts ────────────────────────────────────────────────────
// The plan turned into the two artefacts officials act on:
//
//   the ROADMAP — milestones with a date, the responsible body, and the NEDB
//     series that will MEASURE whether the milestone was met, so every promise
//     ships with its own scorecard;
//   the PROCUREMENT SCHEDULE — the tender pipeline. plan.years[].additionsByTech
//     has been computed since the model was built and only ever used for capex
//     totals; surfaced, it is literally what must be procured, by when.
//
// Both are pure derivations from a PlanResult. Nothing here is typed by hand.

import { TECH_ASSUMPTIONS, TECHNOLOGIES, type PlanResult, type Technology } from "@/lib/necal";

/** Who answers for each technology's build, and which series measures it. */
export const TECH_RESPONSIBLE: Record<Technology, { agency: string; series: string | null }> = {
  gas:   { agency: "NGC / IPP developers, NERC licensing", series: "natural_gas_production" },
  hydro: { agency: "Federal Ministry of Power, hydro concessionaires", series: "renewable_capacity" },
  solar: { agency: "REA and private developers, NBET offtake", series: "renewable_capacity" },
  wind:  { agency: "REA and private developers, NBET offtake", series: "renewable_capacity" },
  oil:   { agency: "Legacy plant operators, NERC", series: "electricity_generation" },
  other: { agency: "Project-specific sponsors", series: "installed_capacity" },
};

export type Milestone = {
  year: number;
  headline: string;
  detail: string;
  responsible: string;
  measured_by: string;   // series id or plain description
};

export type ProcurementRow = {
  year: number;
  tech: Technology;
  addMw: number;
  capexUsdM: number;
  responsible: string;
};

/** Five-yearly milestones with responsibility and the measuring series. */
export function buildRoadmap(plan: PlanResult): Milestone[] {
  const out: Milestone[] = [];
  for (const y of plan.years) {
    if (y.year % 5 !== 0) continue;
    const dominant = TECHNOLOGIES.reduce((a, b) => (y.additionsByTech[b] > y.additionsByTech[a] ? b : a));
    out.push({
      year: y.year,
      headline: `${Math.round(y.capacityMw).toLocaleString()} MW installed · ${Math.round(y.accessPct)}% access · ${Math.round(y.cleanSharePct)}% clean`,
      detail: `Demand ${Math.round(y.demandGwh).toLocaleString()} GWh after ${y.tdLossPct.toFixed(1)}% losses; the build to this point is led by ${TECH_ASSUMPTIONS[dominant].label.toLowerCase()}.`,
      responsible: TECH_RESPONSIBLE[dominant].agency,
      measured_by: TECH_RESPONSIBLE[dominant].series ?? "installed_capacity",
    });
  }
  return out;
}

/** The tender pipeline: additions above the noise floor, largest first per year. */
export function buildProcurement(plan: PlanResult, floorMw = 25): ProcurementRow[] {
  const rows: ProcurementRow[] = [];
  for (const y of plan.years) {
    for (const t of TECHNOLOGIES) {
      const add = y.additionsByTech[t];
      if (add >= floorMw) {
        rows.push({
          year: y.year,
          tech: t,
          addMw: Math.round(add),
          capexUsdM: Math.round(add * TECH_ASSUMPTIONS[t].capexUsdPerKw / 1000),
          responsible: TECH_RESPONSIBLE[t].agency,
        });
      }
    }
  }
  return rows;
}

/** Yearly totals for the procurement chart and its capex line. */
export function procurementByYear(plan: PlanResult) {
  return plan.years
    .map((y) => ({ year: y.year, addMw: Math.round(TECHNOLOGIES.reduce((s, t) => s + y.additionsByTech[t], 0)), capexUsdM: Math.round(y.capexUsdM) }))
    .filter((r) => r.addMw > 0);
}
