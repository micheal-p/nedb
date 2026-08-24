// ── lib/necal-policy.ts ─────────────────────────────────────────────────────
// The modules that turn a capacity projection into a policy tool: instruments
// you can switch on, sector targets you can set and be measured against,
// economic consequences, and the international climate accounting a country
// actually has to report.
//
// Every coefficient here is an explicit, editable assumption with a stated
// basis. None of it is fitted to Nigerian data, because that data does not
// exist in NEDB — and saying so is the difference between a planning tool and
// a black box.

import type { PlanResult, PlanningDrivers } from "@/lib/necal";

// ── Policy instruments ──────────────────────────────────────────────────────
// Each instrument modifies the drivers the core model already runs on, rather
// than adding a separate fudge term, so its effect is traceable to a mechanism.

export type InstrumentId =
  | "efficiency_standards"
  | "loss_reduction"
  | "carbon_price"
  | "fossil_subsidy_reform"
  | "renewable_auction"
  | "clean_cooking"
  | "grid_investment"
  | "captive_to_grid";

export type Instrument = {
  id: InstrumentId;
  label: string;
  lever: string;              // what the policy actually is
  mechanism: string;          // how it reaches the model
  basis: string;              // where the coefficient comes from
  /** Strength 0–100 maps onto the effect below. */
  effect: {
    intensityPctPerYear?: number;   // added to energy-intensity change at full strength
    tdLossTargetDelta?: number;     // percentage points off the loss target
    cleanShareBoost?: number;       // percentage points added to the clean mix target
    demandDelta?: number;           // percent change to final demand
    capexMultiplier?: number;       // capital cost multiplier at full strength
    revenuePerTonneUsd?: number;    // fiscal instrument
  };
};

export const INSTRUMENTS: Instrument[] = [
  {
    id: "efficiency_standards",
    label: "Appliance and building efficiency standards",
    lever: "Minimum energy performance standards on appliances, and a building code applied to new construction.",
    mechanism: "Improves the rate of energy-intensity decline, so the same activity needs less electricity.",
    basis: "Assumption. Programmes elsewhere report 0.5 to 1.5 percentage points a year of additional intensity improvement; the model uses the middle of that range at full strength.",
    effect: { intensityPctPerYear: -1.0 },
  },
  {
    id: "loss_reduction",
    label: "Loss reduction programme",
    lever: "Metering, feeder rehabilitation and revenue protection across the distribution network.",
    mechanism: "Lowers the transmission and distribution loss target, so less must be generated to deliver the same demand.",
    basis: "Assumption. Sets the loss target up to 6 percentage points below your baseline at full strength.",
    effect: { tdLossTargetDelta: -6 },
  },
  {
    id: "carbon_price",
    label: "Carbon price on power generation",
    lever: "A price per tonne of CO₂e on grid generation, rising over the plan period.",
    mechanism: "Shifts the capacity mix toward non-emitting sources and raises fiscal revenue against residual emissions.",
    basis: "Assumption. Effect on the mix and the revenue per tonne are both user-visible; no Nigerian carbon price exists to calibrate against.",
    effect: { cleanShareBoost: 12, revenuePerTonneUsd: 25 },
  },
  {
    id: "fossil_subsidy_reform",
    label: "Fossil fuel subsidy reform",
    lever: "Removal of consumption subsidies on petroleum products.",
    mechanism: "Raises the effective price of self-generation, suppressing some demand and improving the economics of grid supply.",
    basis: "Assumption. Demand response to price is not estimated for Nigeria in NEDB; the model applies a modest suppression and says so.",
    effect: { demandDelta: -4, intensityPctPerYear: -0.3 },
  },
  {
    id: "renewable_auction",
    label: "Competitive renewable auctions",
    lever: "Reverse auctions for utility-scale solar and wind with a firm offtake.",
    mechanism: "Raises the renewable share of the capacity target and lowers the capital cost achieved.",
    basis: "Assumption. Auction programmes elsewhere have cut clearing prices materially; the model applies a 15% capital cost reduction at full strength.",
    effect: { cleanShareBoost: 15, capexMultiplier: 0.85 },
  },
  {
    id: "clean_cooking",
    label: "Clean cooking transition",
    lever: "LPG and electric cooking substitution for fuelwood and charcoal.",
    mechanism: "Raises electricity demand modestly while displacing household biomass.",
    basis: "Assumption. The displacement is real but its electricity component depends on the LPG-to-electric split, which the model exposes rather than fixes.",
    effect: { demandDelta: 3 },
  },
  {
    id: "grid_investment",
    label: "Transmission and distribution capital programme",
    lever: "Sustained investment in wheeling capacity and distribution network build-out.",
    mechanism: "Lowers losses and lifts the availability that installed capacity actually delivers.",
    basis: "Assumption. Modelled as a loss reduction plus a capital cost uplift, since network capital is not in the per-technology costs.",
    effect: { tdLossTargetDelta: -3, capexMultiplier: 1.18 },
  },
  {
    id: "captive_to_grid",
    label: "Captive generation migration",
    lever: "Moving self-generation behind meters onto the grid as reliability improves.",
    mechanism: "Adds recorded demand to the grid that the country is already consuming off it.",
    basis: "Assumption. Self-generation is not measured in NEDB, so the size of this pool is an input, not a finding.",
    effect: { demandDelta: 8 },
  },
];

/** Instrument settings: id → strength 0–100. */
export type PolicyMix = Partial<Record<InstrumentId, number>>;

/** Fold the active instruments into the drivers the core model runs on. */
export function applyInstruments(
  base: PlanningDrivers,
  mix: PolicyMix,
  mixTargetCleanPct: number
): { drivers: PlanningDrivers; cleanBoost: number; capexMultiplier: number; carbonPriceUsd: number; demandDeltaPct: number; active: Instrument[] } {
  const drivers = { ...base };
  let cleanBoost = 0;
  let capexMultiplier = 1;
  let carbonPriceUsd = 0;
  let demandDeltaPct = 0;
  const active: Instrument[] = [];

  for (const inst of INSTRUMENTS) {
    const strength = (mix[inst.id] ?? 0) / 100;
    if (strength <= 0) continue;
    active.push(inst);
    const e = inst.effect;

    if (e.intensityPctPerYear) drivers.energyIntensityChangePct += e.intensityPctPerYear * strength;
    if (e.tdLossTargetDelta)   drivers.tdLossTargetPct = Math.max(4, drivers.tdLossTargetPct + e.tdLossTargetDelta * strength);
    if (e.cleanShareBoost)     cleanBoost += e.cleanShareBoost * strength;
    if (e.demandDelta)         demandDeltaPct += e.demandDelta * strength;
    if (e.capexMultiplier)     capexMultiplier *= 1 + (e.capexMultiplier - 1) * strength;
    if (e.revenuePerTonneUsd)  carbonPriceUsd += e.revenuePerTonneUsd * strength;
  }

  // Demand response reaches the model through suppressed demand, which is the
  // term that already scales base demand.
  drivers.suppressedDemandPct = Math.max(0, drivers.suppressedDemandPct + demandDeltaPct);

  return {
    drivers,
    cleanBoost: Math.min(100 - mixTargetCleanPct, cleanBoost),
    capexMultiplier,
    carbonPriceUsd,
    demandDeltaPct,
    active,
  };
}

// ── Sector goal setting ─────────────────────────────────────────────────────
export type SectorGoal = {
  id: string;
  label: string;
  unit: string;
  /** What the plan delivers, read out of the result. */
  read: (p: PlanResult) => number | null;
  /** Higher is better? Drives how the gap reads. */
  higherIsBetter: boolean;
  /** A published national commitment, where one exists. */
  reference?: { value: number; label: string };
  hint: string;
};

export const SECTOR_GOALS: SectorGoal[] = [
  {
    id: "clean_share", label: "Clean generation share", unit: "%",
    read: (p) => p.totals.horizonCleanPct,
    higherIsBetter: true,
    reference: { value: 90, label: "Implied by a net-zero-by-2060 power sector" },
    hint: "Share of generation from non-emitting sources at the horizon.",
  },
  {
    id: "emissions", label: "Power sector emissions", unit: "Mt CO₂e",
    read: (p) => p.totals.horizonEmissionsMt,
    higherIsBetter: false,
    hint: "Annual emissions from the generation mix at the horizon.",
  },
  {
    id: "capacity", label: "Installed capacity", unit: "MW",
    read: (p) => p.years[p.years.length - 1]?.capacityMw ?? null,
    higherIsBetter: true,
    hint: "Capacity that must exist at the horizon to meet demand with reserve.",
  },
  {
    id: "access", label: "Electricity access", unit: "%",
    read: (p) => p.years[p.years.length - 1]?.accessPct ?? null,
    higherIsBetter: true,
    reference: { value: 100, label: "Universal access commitment" },
    hint: "Share of the population with electricity access at the horizon.",
  },
  {
    id: "losses", label: "Network losses", unit: "%",
    read: (p) => p.years[p.years.length - 1]?.tdLossPct ?? null,
    higherIsBetter: false,
    reference: { value: 8, label: "A functioning-grid benchmark" },
    hint: "Transmission and distribution losses at the horizon.",
  },
];

// ── Economic modelling ──────────────────────────────────────────────────────
export type EconomicAssumptions = {
  /** Direct and indirect jobs per MW built, by broad technology class. */
  jobsPerMwBuild: number;
  jobsPerMwOperate: number;
  /** Share of capital spend that stays in the domestic economy. */
  localContentPct: number;
  /** Discount rate for the present-value view. */
  discountRatePct: number;
  /** Naira per US dollar, for the fiscal read-out. */
  fxNgnPerUsd: number;
};

export const DEFAULT_ECONOMICS: EconomicAssumptions = {
  jobsPerMwBuild: 5.5,
  jobsPerMwOperate: 0.4,
  localContentPct: 35,
  discountRatePct: 10,
  fxNgnPerUsd: 1550,
};

export type EconomicResult = {
  capexUsdBn: number;
  capexNgnTn: number;
  presentValueUsdBn: number;
  domesticSpendUsdBn: number;
  constructionJobYears: number;
  operatingJobsAtHorizon: number;
  carbonRevenueUsdBn: number;
  annualCapexUsdBn: { year: number; value: number }[];
};

export function economics(
  plan: PlanResult,
  econ: EconomicAssumptions,
  capexMultiplier: number,
  carbonPriceUsd: number
): EconomicResult {
  const base = plan.years[0]?.year ?? 0;
  let pv = 0;
  let constructionJobYears = 0;
  let carbonRevenueUsd = 0;
  const annual: { year: number; value: number }[] = [];

  for (const y of plan.years) {
    const capex = y.capexUsdM * capexMultiplier;
    annual.push({ year: y.year, value: capex / 1000 });
    const n = y.year - base;
    pv += capex / Math.pow(1 + econ.discountRatePct / 100, n);

    const added = Object.values(y.additionsByTech).reduce((a, v) => a + v, 0);
    constructionJobYears += added * econ.jobsPerMwBuild;

    if (carbonPriceUsd > 0) carbonRevenueUsd += y.emissionsMt * 1_000_000 * carbonPriceUsd;
  }

  const capexUsdM = plan.totals.capexUsdBn * 1000 * capexMultiplier;
  const horizonCapacity = plan.years[plan.years.length - 1]?.capacityMw ?? 0;

  return {
    capexUsdBn: capexUsdM / 1000,
    capexNgnTn: (capexUsdM / 1000) * econ.fxNgnPerUsd / 1000,
    presentValueUsdBn: pv / 1000,
    domesticSpendUsdBn: (capexUsdM / 1000) * (econ.localContentPct / 100),
    constructionJobYears,
    operatingJobsAtHorizon: horizonCapacity * econ.jobsPerMwOperate,
    carbonRevenueUsdBn: carbonRevenueUsd / 1_000_000_000,
    annualCapexUsdBn: annual,
  };
}

// ── International climate reporting ─────────────────────────────────────────
// Nigeria's stated commitments, as published. These are reference points the
// plan is measured against, not model outputs.
export const CLIMATE_COMMITMENTS = [
  {
    id: "net_zero_2060",
    label: "Net zero by 2060",
    detail: "Nigeria's stated net-zero target year, announced at COP26 and carried into the Climate Change Act 2021 framework.",
    targetYear: 2060,
    test: "Power sector emissions on a credible path to zero by 2060.",
  },
  {
    id: "ndc_uncond",
    label: "NDC — unconditional",
    detail: "Nigeria's updated Nationally Determined Contribution commits to a 20% reduction against business as usual by 2030, unconditionally.",
    targetYear: 2030,
    reductionPct: 20,
    test: "Emissions at least 20% below the current-trajectory pathway in 2030.",
  },
  {
    id: "ndc_cond",
    label: "NDC — conditional",
    detail: "A 47% reduction against business as usual by 2030, conditional on international support.",
    targetYear: 2030,
    reductionPct: 47,
    test: "Emissions at least 47% below the current-trajectory pathway in 2030.",
  },
  {
    id: "sdg7",
    label: "SDG 7.1 — universal access",
    detail: "Sustainable Development Goal 7.1: universal access to affordable, reliable and modern energy services by 2030.",
    targetYear: 2030,
    test: "Electricity access reaching 100% by 2030.",
  },
] as const;

export type CommitmentCheck = {
  id: string;
  label: string;
  detail: string;
  test: string;
  status: "on_track" | "off_track" | "not_assessable";
  reading: string;
};

export function assessCommitments(plan: PlanResult, counterfactual: PlanResult): CommitmentCheck[] {
  const at = (p: PlanResult, year: number) => p.years.find((y) => y.year === year) ?? null;

  return CLIMATE_COMMITMENTS.map((c) => {
    // 2030 NDC tests
    if ("reductionPct" in c) {
      const mine = at(plan, 2030);
      const bau = at(counterfactual, 2030);
      if (!mine || !bau || bau.emissionsMt === 0) {
        return { id: c.id, label: c.label, detail: c.detail, test: c.test, status: "not_assessable",
          reading: "The plan does not reach 2030, or the comparison pathway produced no emissions to measure against." };
      }
      const cut = ((bau.emissionsMt - mine.emissionsMt) / bau.emissionsMt) * 100;
      const meets = cut >= c.reductionPct;
      return {
        id: c.id, label: c.label, detail: c.detail, test: c.test,
        status: meets ? "on_track" : "off_track",
        reading: `This pathway is ${cut.toFixed(0)}% below the current trajectory in 2030, against a ${c.reductionPct}% commitment. ${meets ? "The commitment is met on power sector emissions." : `A further ${(c.reductionPct - cut).toFixed(0)} percentage points are needed.`}`,
      };
    }

    // Access
    if (c.id === "sdg7") {
      const y = at(plan, 2030);
      if (!y) return { id: c.id, label: c.label, detail: c.detail, test: c.test, status: "not_assessable", reading: "The plan does not reach 2030." };
      const meets = y.accessPct >= 99.5;
      return {
        id: c.id, label: c.label, detail: c.detail, test: c.test,
        status: meets ? "on_track" : "off_track",
        reading: `Access reaches ${y.accessPct.toFixed(0)}% by 2030 on this pathway. ${meets ? "Universal access is met." : `${(100 - y.accessPct).toFixed(0)} percentage points short.`}`,
      };
    }

    // Net zero: is the trajectory falling fast enough to plausibly reach zero?
    const last = plan.years[plan.years.length - 1];
    const peak = plan.totals.peakEmissionsMt;
    if (!last || peak === 0) {
      return { id: c.id, label: c.label, detail: c.detail, test: c.test, status: "not_assessable", reading: "No emissions trajectory to assess." };
    }
    const fromPeak = ((peak - last.emissionsMt) / peak) * 100;
    const yearsLeft = 2060 - last.year;
    const status = last.emissionsMt <= peak * 0.25 ? "on_track" : "off_track";
    return {
      id: c.id, label: c.label, detail: c.detail, test: c.test, status,
      reading: `Emissions at ${last.year} are ${last.emissionsMt.toFixed(1)} Mt, ${fromPeak >= 0 ? `${fromPeak.toFixed(0)}% below` : `${Math.abs(fromPeak).toFixed(0)}% above`} the peak of ${peak.toFixed(1)} Mt. ${
        status === "on_track"
          ? `Residual emissions are small enough that the remaining ${yearsLeft} years to 2060 could close them.`
          : `On this pathway ${last.emissionsMt.toFixed(1)} Mt would still need eliminating in the ${yearsLeft} years to 2060, which this model does not show a route to.`
      }`,
    };
  });
}
