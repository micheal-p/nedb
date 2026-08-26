// ── lib/necal.ts ────────────────────────────────────────────────────────────
// NECAL2050 planning engine.
//
// The previous scenario tool applied a single growth rate to one series and
// drew the line forward. That is extrapolation, not planning: it cannot answer
// what capacity must be built, what it costs, what it emits, or whether the
// system balances.
//
// This engine plans the way an energy ministry does — from drivers down:
//
//   drivers (population, GDP, efficiency, access)
//        ↓
//   final electricity demand
//        ↓  ÷ (1 − T&D losses)
//   required generation                      ← ENERGY BALANCE holds here
//        ↓  ÷ (8760 × availability) × (1 + reserve margin)
//   required installed capacity
//        ↓  × fuel mix pathway
//   capacity by technology → additions per year
//        ↓  × capex per kW            × emission factor
//   investment requirement             emissions trajectory
//
// Every coefficient is an explicit, citable assumption exposed to the user.
// A planning tool whose assumptions are buried is a black box, and nobody
// should sign a capital plan off the back of one.

export type PlanningDrivers = {
  baseYear: number;
  horizon: number;
  /** Population at base year, millions. */
  population: number;
  populationGrowthPct: number;
  /** Real GDP growth, drives commercial and industrial demand. */
  gdpGrowthPct: number;
  /** Annual change in energy intensity (negative = efficiency improving). */
  energyIntensityChangePct: number;
  /** Share of population with electricity access at base year. */
  accessPct: number;
  /** Access target at horizon — closing this gap adds demand. */
  accessTargetPct: number;
  /** Transmission and distribution losses now, and the target at horizon. */
  tdLossPct: number;
  tdLossTargetPct: number;
  /** Planning reserve margin over peak requirement. */
  reserveMarginPct: number;
  /** Fleet-average availability: what share of installed capacity actually delivers. */
  availabilityPct: number;
  /** Suppressed demand: consumption today understates need because supply is short. */
  suppressedDemandPct: number;
};

export type Technology = "gas" | "hydro" | "solar" | "wind" | "oil" | "other";

/** Mix shares at the horizon, in percent. Base-year mix is derived from data. */
export type MixTargets = Record<Technology, number>;

/** Planning assumptions per technology. Shown to the user, not hidden. */
export const TECH_ASSUMPTIONS: Record<Technology, {
  label: string;
  capexUsdPerKw: number;      // overnight capital cost
  emissionFactor: number;     // gCO2e per kWh generated, lifecycle
  capacityFactorPct: number;  // realistic annual output share
  color: string;
}> = {
  gas:   { label: "Natural gas",   capexUsdPerKw: 1100, emissionFactor: 450, capacityFactorPct: 55, color: "#0369A1" },
  hydro: { label: "Hydro",         capexUsdPerKw: 2200, emissionFactor: 24,  capacityFactorPct: 45, color: "#0891B2" },
  solar: { label: "Solar PV",      capexUsdPerKw: 900,  emissionFactor: 45,  capacityFactorPct: 20, color: "#CA8A04" },
  wind:  { label: "Wind",          capexUsdPerKw: 1400, emissionFactor: 11,  capacityFactorPct: 30, color: "#059669" },
  oil:   { label: "Oil / diesel",  capexUsdPerKw: 800,  emissionFactor: 700, capacityFactorPct: 30, color: "#B45309" },
  other: { label: "Other",         capexUsdPerKw: 1500, emissionFactor: 300, capacityFactorPct: 40, color: "#6B7280" },
};

export const TECHNOLOGIES: Technology[] = ["gas", "hydro", "solar", "wind", "oil", "other"];

export const DEFAULT_DRIVERS: PlanningDrivers = {
  baseYear: new Date().getFullYear() - 1,
  horizon: 2050,
  population: 230,
  populationGrowthPct: 2.4,
  gdpGrowthPct: 3.2,
  energyIntensityChangePct: -0.8,
  accessPct: 61,
  accessTargetPct: 100,
  tdLossPct: 15,
  tdLossTargetPct: 8,
  reserveMarginPct: 15,
  availabilityPct: 45,
  suppressedDemandPct: 35,
};

export const DEFAULT_MIX: MixTargets = { gas: 45, hydro: 20, solar: 22, wind: 5, oil: 3, other: 5 };

export type PlanYear = {
  year: number;
  population: number;
  gdpIndex: number;
  accessPct: number;
  /** Final demand delivered to consumers, GWh. */
  demandGwh: number;
  tdLossPct: number;
  /** Generation required to deliver that demand after losses, GWh. */
  generationGwh: number;
  /** Installed capacity required, MW, including reserve margin. */
  capacityMw: number;
  capacityByTech: Record<Technology, number>;
  /** Capacity added this year by technology, MW. */
  additionsByTech: Record<Technology, number>;
  /** Capital requirement for this year's additions, USD million. */
  capexUsdM: number;
  /** Emissions from the generation mix, million tonnes CO2e. */
  emissionsMt: number;
  /** Share of generation from non-emitting sources, percent. */
  cleanSharePct: number;
};

export type PlanResult = {
  years: PlanYear[];
  totals: {
    capexUsdBn: number;
    capacityAddedMw: number;
    peakEmissionsMt: number;
    horizonEmissionsMt: number;
    horizonCleanPct: number;
    demandGrowthMultiple: number;
  };
  warnings: string[];
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));

/** Normalise a mix so shares always sum to 100. */
export function normaliseMix(mix: MixTargets): MixTargets {
  const total = TECHNOLOGIES.reduce((a, t) => a + (mix[t] || 0), 0);
  if (total <= 0) return { ...DEFAULT_MIX };
  const out = {} as MixTargets;
  for (const t of TECHNOLOGIES) out[t] = ((mix[t] || 0) / total) * 100;
  return out;
}

/**
 * The starting position the plan is anchored on.
 *
 * Installed capacity is deliberately NOT part of this. The model derives the
 * capacity that must exist from required generation, fleet availability and the
 * reserve margin, so an installed-capacity figure passed in here would either be
 * ignored or quietly contradict the derivation. Anything the caller knows about
 * today's fleet belongs in `baseMix`, which the walk actually uses.
 */
export type PlanBase = { generationGwh: number; baseMix?: Partial<MixTargets> };

export function runPlan(
  drivers: PlanningDrivers,
  mixTarget: MixTargets,
  base: PlanBase
): PlanResult {
  const warnings: string[] = [];
  const years: PlanYear[] = [];

  if (drivers.horizon <= drivers.baseYear) {
    return { years: [], totals: { capexUsdBn: 0, capacityAddedMw: 0, peakEmissionsMt: 0, horizonEmissionsMt: 0, horizonCleanPct: 0, demandGrowthMultiple: 0 }, warnings: ["The horizon must be after the base year."] };
  }
  if (base.generationGwh <= 0) {
    warnings.push("No committed generation data for the base year, so the plan is anchored on a nominal starting point. Commit generation records to anchor it on the real position.");
  }

  const span = drivers.horizon - drivers.baseYear;
  const target = normaliseMix(mixTarget);

  // Base-year mix: use observed shares where supplied, otherwise assume the
  // system starts where it is today rather than where we want it to be.
  const startMix = normaliseMix({
    gas:   base.baseMix?.gas   ?? 75,
    hydro: base.baseMix?.hydro ?? 18,
    solar: base.baseMix?.solar ?? 2,
    wind:  base.baseMix?.wind  ?? 0,
    oil:   base.baseMix?.oil   ?? 4,
    other: base.baseMix?.other ?? 1,
  });

  // Demand today is suppressed: people consume what is available, not what
  // they need. Planning off observed consumption alone under-builds the system.
  const baseGeneration = base.generationGwh > 0 ? base.generationGwh : 40000;
  const baseDemand = baseGeneration * (1 - drivers.tdLossPct / 100) * (1 + drivers.suppressedDemandPct / 100);

  let prevCapacityByTech: Record<Technology, number> | null = null;
  let totalCapex = 0;
  let totalAdded = 0;

  for (let y = drivers.baseYear; y <= drivers.horizon; y++) {
    const n = y - drivers.baseYear;
    const t = span === 0 ? 1 : n / span;

    const population = drivers.population * Math.pow(1 + drivers.populationGrowthPct / 100, n);
    const gdpIndex   = Math.pow(1 + drivers.gdpGrowthPct / 100, n);
    const intensity  = Math.pow(1 + drivers.energyIntensityChangePct / 100, n);
    const accessPct  = lerp(drivers.accessPct, drivers.accessTargetPct, t);

    // Demand is driven, not extrapolated: population growth, economic activity,
    // efficiency, and the demand unlocked by extending access.
    const populationFactor = population / drivers.population;
    const accessFactor     = accessPct / Math.max(1, drivers.accessPct);
    const demandGwh = baseDemand * populationFactor * gdpIndex * intensity * accessFactor;

    // Energy balance: what must be generated to deliver that demand.
    const tdLossPct = lerp(drivers.tdLossPct, drivers.tdLossTargetPct, t);
    const generationGwh = demandGwh / Math.max(0.5, 1 - tdLossPct / 100);

    // Capacity required to generate it, at fleet availability, plus reserve.
    const availability = Math.max(0.1, drivers.availabilityPct / 100);
    const capacityMw = (generationGwh * 1000) / (8760 * availability) * (1 + drivers.reserveMarginPct / 100);

    // Mix walks from where the system is to where the scenario targets.
    const capacityByTech = {} as Record<Technology, number>;
    for (const tech of TECHNOLOGIES) {
      const share = lerp(startMix[tech], target[tech], t);
      capacityByTech[tech] = (capacityMw * share) / 100;
    }

    const additionsByTech = {} as Record<Technology, number>;
    let capexUsdM = 0;
    for (const tech of TECHNOLOGIES) {
      const added = prevCapacityByTech ? Math.max(0, capacityByTech[tech] - prevCapacityByTech[tech]) : 0;
      additionsByTech[tech] = added;
      capexUsdM += (added * 1000 * TECH_ASSUMPTIONS[tech].capexUsdPerKw) / 1_000_000;
      totalAdded += added;
    }
    totalCapex += capexUsdM;

    // Emissions follow generation, apportioned by each technology's realistic
    // contribution rather than by installed capacity — solar capacity does not
    // generate like gas capacity.
    let weighted = 0;
    let cleanGen = 0;
    let totalGenShare = 0;
    for (const tech of TECHNOLOGIES) {
      const potential = capacityByTech[tech] * (TECH_ASSUMPTIONS[tech].capacityFactorPct / 100);
      totalGenShare += potential;
    }
    for (const tech of TECHNOLOGIES) {
      const potential = capacityByTech[tech] * (TECH_ASSUMPTIONS[tech].capacityFactorPct / 100);
      const genShare = totalGenShare > 0 ? potential / totalGenShare : 0;
      const genFromTech = generationGwh * genShare;
      weighted += genFromTech * TECH_ASSUMPTIONS[tech].emissionFactor;
      if (TECH_ASSUMPTIONS[tech].emissionFactor < 100) cleanGen += genFromTech;
    }
    // GWh × gCO2/kWh → tonnes: ×1e6 kWh/GWh ÷ 1e6 g/tonne, then to Mt.
    const emissionsMt = weighted / 1_000_000;
    const cleanSharePct = generationGwh > 0 ? (cleanGen / generationGwh) * 100 : 0;

    years.push({
      year: y, population, gdpIndex, accessPct,
      demandGwh, tdLossPct, generationGwh, capacityMw,
      capacityByTech, additionsByTech, capexUsdM, emissionsMt, cleanSharePct,
    });

    prevCapacityByTech = capacityByTech;
  }

  const first = years[0];
  const last = years[years.length - 1];

  if (drivers.availabilityPct < 30) {
    warnings.push("Fleet availability below 30% implies most installed capacity never delivers, which inflates the build requirement sharply. Check the assumption before citing the capital figure.");
  }
  if (drivers.tdLossTargetPct >= drivers.tdLossPct) {
    warnings.push("Transmission and distribution losses are not assumed to improve, so every unit of new demand carries today's loss rate with it.");
  }
  if (target.solar + target.wind > 60) {
    warnings.push("Variable renewables above 60% of capacity require storage and system flexibility that this model does not cost. Treat the capital figure as a floor.");
  }

  return {
    years,
    totals: {
      capexUsdBn: totalCapex / 1000,
      capacityAddedMw: totalAdded,
      peakEmissionsMt: Math.max(...years.map((x) => x.emissionsMt)),
      horizonEmissionsMt: last?.emissionsMt ?? 0,
      horizonCleanPct: last?.cleanSharePct ?? 0,
      demandGrowthMultiple: first && first.demandGwh > 0 ? (last?.demandGwh ?? 0) / first.demandGwh : 0,
    },
    warnings,
  };
}

/** Named pathways an analyst can start from, then adjust. */
export const PRESETS: { id: string; label: string; description: string; drivers: Partial<PlanningDrivers>; mix: MixTargets }[] = [
  {
    id: "current",
    label: "Current trajectory",
    description: "Access and losses improve only as fast as they have been. The mix stays gas-dominant. This is the counterfactual, not a plan.",
    drivers: { accessTargetPct: 78, tdLossTargetPct: 13, energyIntensityChangePct: -0.2 },
    mix: { gas: 70, hydro: 18, solar: 6, wind: 1, oil: 3, other: 2 },
  },
  {
    id: "access",
    label: "Universal access",
    description: "Access reaches everyone by the horizon and losses are brought to a functioning-grid level. Demand rises fastest here.",
    drivers: { accessTargetPct: 100, tdLossTargetPct: 8, energyIntensityChangePct: -0.8 },
    mix: { gas: 50, hydro: 20, solar: 20, wind: 4, oil: 2, other: 4 },
  },
  {
    id: "transition",
    label: "Energy transition",
    description: "Universal access with an aggressive shift to non-emitting generation, in line with a net-zero-by-2060 pathway.",
    drivers: { accessTargetPct: 100, tdLossTargetPct: 7, energyIntensityChangePct: -1.4 },
    mix: { gas: 30, hydro: 22, solar: 34, wind: 8, oil: 0, other: 6 },
  },
  {
    id: "gas",
    label: "Gas-led industrialisation",
    description: "Domestic gas is monetised into power to drive industrial demand, with renewables in a supporting role.",
    drivers: { accessTargetPct: 95, gdpGrowthPct: 4.5, tdLossTargetPct: 9, energyIntensityChangePct: -0.4 },
    mix: { gas: 62, hydro: 16, solar: 15, wind: 2, oil: 1, other: 4 },
  },
];
