// ── lib/dashboard-profiles.ts ───────────────────────────────────────────────
// Single source of truth for the per-entity dashboards.
//
// MANDATE SCOPING is the rule here: every profile declares the sectors it is
// mandated over, and everything else is DERIVED from that — which sections
// appear in the sidebar, which KPIs compute, which charts render, which
// anomalies alert. A power-sector regulator has no business seeing petroleum
// production on its dashboard, and the way to guarantee that is to stop
// hand-listing navigation per profile (which drifts) and derive it instead.
//
// Cross-sector bodies (Presidency, ECN, NBS) declare every sector explicitly —
// they are national co-ordinating or statistical bodies, so breadth is their
// mandate, not an oversight.

export type Sector = "petroleum" | "gas" | "electricity" | "renewable" | "biomass" | "fiscal";

export const SECTORS: { id: Sector; label: string }[] = [
  { id: "petroleum",   label: "Petroleum" },
  { id: "gas",         label: "Natural Gas" },
  { id: "electricity", label: "Electricity" },
  { id: "renewable",   label: "Renewables" },
  { id: "biomass",     label: "Biomass & Solid Fuels" },
  { id: "fiscal",      label: "Fiscal & Revenue" },
];

export interface KPIDef { label: string; series: string; unit: string; higherIsBetter?: boolean }

export interface ProfileDef {
  label: string;
  roleTitle: string;
  color: string;
  accent: string;
  persona: string;
  /** Sectors this entity is mandated over. Drives nav, KPIs, charts, alerts. */
  mandate: Sector[];
  defaultView: string;
  kpis: KPIDef[];
  /** Optional: shown on the profile header as the legal basis for the mandate. */
  basis?: string;
  /**
   * Sections that are not sector-derived but belong to this entity's function:
   * "compliance" for revenue and upstream regulators, "deals" for investors,
   * "necal" for the bodies that actually do national energy planning.
   */
  extraViews?: string[];
}

// ── Series → sector map ─────────────────────────────────────────────────────
// Every series belongs to exactly one sector. Scoping reads from this, so a
// new series is scoped the moment it is registered here.
export const SERIES_SECTOR: Record<string, Sector> = {
  crude_oil_production:    "petroleum",
  pms_sales:               "petroleum",
  ago_sales:               "petroleum",
  kerosine_sales:          "petroleum",
  natural_gas_production:  "gas",
  lpg_sales:               "gas",
  electricity_generation:  "electricity",
  electricity_sent_out:    "electricity",
  electricity_consumption: "electricity",
  renewable_energy:        "renewable",
  fuelwood_consumption:    "biomass",
  charcoal_consumption:    "biomass",
  coal_consumption:        "biomass",
  coal_export:             "biomass",
  faac_oil_revenue:        "fiscal",
  upstream_royalties:      "fiscal",
  hydrocarbon_tax:         "fiscal",
  cit_energy:              "fiscal",
  gas_flare_penalties:     "fiscal",
};

export const SERIES_LABELS: Record<string, string> = {
  crude_oil_production:   "Crude oil production",
  natural_gas_production: "Natural gas production",
  pms_sales:              "PMS sales volume",
  ago_sales:              "AGO (diesel) sales",
  kerosine_sales:         "Kerosene (DPK) sales",
  lpg_sales:              "LPG sales",
  electricity_generation: "Electricity generation",
  electricity_sent_out:   "Electricity sent out",
  electricity_consumption:"Electricity consumption",
  renewable_energy:       "Renewable energy capacity",
  fuelwood_consumption:   "Fuelwood consumption",
  charcoal_consumption:   "Charcoal consumption",
  coal_consumption:       "Coal consumption",
  coal_export:            "Coal export",
  faac_oil_revenue:       "FAAC oil revenue",
  upstream_royalties:     "Upstream royalties",
  hydrocarbon_tax:        "Hydrocarbon tax receipts",
  cit_energy:             "CIT from energy companies",
  gas_flare_penalties:    "Gas flaring penalties",
};

// ── View → sector map ───────────────────────────────────────────────────────
// A dashboard section appears only when the profile's mandate intersects the
// sectors that section covers. Sections with an empty list are universal.
export const VIEW_SECTORS: Record<string, Sector[]> = {
  overview:   [],                          // always available
  brief:      [],                          // always available
  upstream:   ["petroleum", "gas"],
  downstream: ["petroleum"],
  midstream:  ["petroleum", "gas"],
  power:      ["electricity"],
  renewable:  ["renewable"],
  bioenergy:  ["biomass"],
  revenue:    ["fiscal"],
  faac:       ["fiscal"],
  // Function-specific sections, granted through extraViews rather than sector.
  compliance: [],
  deals:      [],
};

/** Sections granted only by an explicit extraViews entry, never by sector. */
const FUNCTION_VIEWS = new Set(["compliance", "deals"]);

/**
 * Capabilities are granted through the same extraViews list but are NOT
 * dashboard sections — they gate a separate route. Keeping them out of
 * VIEW_ORDER is what stops them rendering as an empty nav tab.
 */
export const CAPABILITIES = new Set(["necal"]);

/** Does this profile hold a named capability, such as the NECAL2050 model? */
export function hasCapability(profile: ProfileDef, capability: string): boolean {
  return profile.extraViews?.includes(capability) ?? false;
}

/** Sections in their canonical running order. Profiles get a filtered slice. */
const VIEW_ORDER = ["overview", "brief", "upstream", "midstream", "downstream", "power", "renewable", "bioenergy", "revenue", "faac", "compliance", "deals"];

/** Sections this profile may see, in canonical order. */
export function allowedViews(profile: ProfileDef): string[] {
  return VIEW_ORDER.filter((v) => {
    if (CAPABILITIES.has(v)) return false;   // capabilities are routes, not tabs
    if (FUNCTION_VIEWS.has(v)) return profile.extraViews?.includes(v) ?? false;
    const need = VIEW_SECTORS[v] ?? [];
    if (need.length === 0) return true;
    return need.some((s) => profile.mandate.includes(s));
  });
}

/** True when this series falls inside the profile's mandate. */
export function seriesInMandate(profile: ProfileDef, seriesId: string): boolean {
  const sector = SERIES_SECTOR[seriesId];
  if (!sector) return false;          // unmapped series stay out of scope by default
  return profile.mandate.includes(sector);
}

/** Strip every out-of-mandate series from a dashboard data payload. */
export function scopeData<T>(profile: ProfileDef, data: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [id, rows] of Object.entries(data)) {
    if (seriesInMandate(profile, id)) out[id] = rows;
  }
  return out;
}

/** Human-readable mandate line, e.g. "Electricity · Renewables". */
export function mandateLabel(profile: ProfileDef): string {
  return profile.mandate
    .map((s) => SECTORS.find((x) => x.id === s)?.label ?? s)
    .join(" · ");
}

export const PROFILE_MAP: Record<string, ProfileDef> = {
  // ── National co-ordinating and statistical bodies: full mandate ──────────
  presidency: {
    label: "State House — Presidency", roleTitle: "National Energy Security Brief",
    color: "#1B2A4A", accent: "rgba(27,42,74,0.06)",
    persona: "Cross-sector headline indicators prepared for the Presidency.",
    basis: "National oversight — all energy sectors",
    mandate: ["petroleum", "gas", "electricity", "renewable", "biomass", "fiscal"],
    defaultView: "overview",
    extraViews: ["necal"],
    kpis: [
      { label: "Crude Oil Production",   series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Oil Revenue (FAAC)",     series: "faac_oil_revenue",       unit: "₦ Billion" },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Natural Gas Produced",   series: "natural_gas_production", unit: "Bcf" },
    ],
  },
  ecn: {
    label: "ECN — Energy Commission of Nigeria", roleTitle: "ECN National Energy Policy Dashboard",
    color: "#0E7A3C", accent: "rgba(14,122,60,0.06)",
    persona: "All-sector indicators for ECN leadership across every energy carrier.",
    basis: "ECN Act, CAP. E10 LFN 2004 — co-ordination across all energy carriers",
    mandate: ["petroleum", "gas", "electricity", "renewable", "biomass", "fiscal"],
    defaultView: "overview",
    extraViews: ["necal"],
    kpis: [
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
      { label: "Natural Gas Produced",   series: "natural_gas_production", unit: "Bcf" },
      { label: "Fuelwood Consumption",   series: "fuelwood_consumption",   unit: "M m³",  higherIsBetter: false },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
    ],
  },
  nbs: {
    label: "NBS — National Bureau of Statistics", roleTitle: "NBS Energy Sector Statistical Dashboard",
    color: "#0C4A6E", accent: "rgba(12,74,110,0.05)",
    persona: "Energy statistics across all carriers for national accounts work.",
    basis: "National statistical compilation — all energy sectors",
    mandate: ["petroleum", "gas", "electricity", "renewable", "biomass", "fiscal"],
    defaultView: "overview",
    kpis: [
      { label: "Crude Oil Production",   series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Natural Gas Produced",   series: "natural_gas_production", unit: "Bcf" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
    ],
  },
  nrs: {
    label: "NRS — Natural Resources Statistics", roleTitle: "NRS Natural Resources Statistical Dashboard",
    color: "#6B21A8", accent: "rgba(107,33,168,0.05)",
    persona: "Production and consumption volumes across extractive and energy carriers.",
    basis: "Natural resources statistical reporting",
    mandate: ["petroleum", "gas", "electricity", "renewable", "biomass"],
    defaultView: "overview",
    kpis: [
      { label: "Crude Oil Production",   series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Natural Gas Produced",   series: "natural_gas_production", unit: "Bcf" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
    ],
  },

  // ── Sector regulators: scoped to their statutory remit ──────────────────
  nerc: {
    label: "NERC — Electricity Regulatory Commission", roleTitle: "NERC Electricity Market Dashboard",
    color: "#1D4ED8", accent: "rgba(29,78,216,0.05)",
    persona: "Electricity market indicators: generation, energy sent out, consumption and grid-connected renewables.",
    basis: "EPSRA 2005 — electricity generation, transmission and distribution",
    mandate: ["electricity", "renewable"],
    defaultView: "power",
    kpis: [
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Electricity Sent Out",   series: "electricity_sent_out",   unit: "GWh" },
      { label: "Electricity Consumed",   series: "electricity_consumption",unit: "GWh" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
    ],
  },
  nuprc: {
    label: "NUPRC — Upstream Petroleum Regulator", roleTitle: "NUPRC Upstream Petroleum Dashboard",
    color: "#78350F", accent: "rgba(120,53,15,0.05)",
    persona: "Upstream indicators: crude and gas production, royalties and flaring penalties.",
    basis: "PIA 2021 — upstream petroleum operations and royalties",
    mandate: ["petroleum", "gas", "fiscal"],
    defaultView: "upstream",
    extraViews: ["compliance"],
    kpis: [
      { label: "Crude Oil Production", series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Natural Gas Produced", series: "natural_gas_production", unit: "Bcf" },
      { label: "Upstream Royalties",   series: "upstream_royalties",     unit: "₦ Billion" },
      { label: "Gas Flaring Penalties",series: "gas_flare_penalties",    unit: "₦ Billion", higherIsBetter: false },
    ],
  },
  nmdpra: {
    label: "NMDPRA — Midstream & Downstream Regulator", roleTitle: "NMDPRA Midstream & Downstream Dashboard",
    color: "#0369A1", accent: "rgba(3,105,161,0.05)",
    persona: "Midstream and downstream indicators: PMS, AGO, kerosene and LPG distribution volumes.",
    basis: "PIA 2021 — midstream and downstream petroleum operations",
    mandate: ["petroleum", "gas"],
    defaultView: "downstream",
    kpis: [
      { label: "PMS (Petrol) Sales",   series: "pms_sales",     unit: "M Litres" },
      { label: "AGO (Diesel) Sales",   series: "ago_sales",     unit: "M Litres" },
      { label: "LPG Sales",            series: "lpg_sales",     unit: "MT" },
      { label: "Kerosene (DPK) Sales", series: "kerosine_sales",unit: "M Litres" },
    ],
  },
  nnpcl: {
    label: "NNPC Limited", roleTitle: "NNPC Limited Operations Dashboard",
    color: "#065F46", accent: "rgba(6,95,70,0.05)",
    persona: "Operational indicators for petroleum and gas: production and product sales.",
    basis: "Petroleum and gas operations",
    mandate: ["petroleum", "gas"],
    defaultView: "upstream",
    kpis: [
      { label: "Crude Oil Production", series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Natural Gas Produced", series: "natural_gas_production", unit: "Bcf" },
      { label: "PMS (Petrol) Sales",   series: "pms_sales",              unit: "M Litres" },
      { label: "AGO (Diesel) Sales",   series: "ago_sales",              unit: "M Litres" },
    ],
  },
  nemic: {
    label: "NEMIC — Energy Management & Infrastructure", roleTitle: "NEMIC Energy Management Dashboard",
    color: "#4338CA", accent: "rgba(67,56,202,0.05)",
    persona: "Infrastructure indicators for grid capacity, renewables and household biomass use.",
    basis: "Energy management and infrastructure",
    mandate: ["electricity", "renewable", "biomass"],
    defaultView: "power",
    extraViews: ["necal"],
    kpis: [
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Electricity Sent Out",   series: "electricity_sent_out",   unit: "GWh" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
      { label: "Fuelwood Consumption",   series: "fuelwood_consumption",   unit: "M m³", higherIsBetter: false },
    ],
  },
  rea: {
    label: "REA — Rural Electrification Agency", roleTitle: "REA Rural Electrification & Off-Grid Dashboard",
    color: "#15803D", accent: "rgba(21,128,61,0.05)",
    persona: "Rural electrification indicators: renewable capacity, grid supply and fuelwood displacement.",
    basis: "Rural electrification and off-grid access",
    mandate: ["renewable", "electricity", "biomass"],
    defaultView: "renewable",
    kpis: [
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
      { label: "Electricity Consumed",   series: "electricity_consumption",unit: "GWh" },
      { label: "Fuelwood Consumption",   series: "fuelwood_consumption",   unit: "M m³", higherIsBetter: false },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
    ],
  },
  tcn: {
    label: "TCN — Transmission Company of Nigeria", roleTitle: "TCN Grid Transmission Dashboard",
    color: "#B45309", accent: "rgba(180,83,9,0.05)",
    persona: "Grid indicators: energy sent out, generation, consumption and connected renewables.",
    basis: "Grid transmission and system operation",
    mandate: ["electricity", "renewable"],
    defaultView: "power",
    kpis: [
      { label: "Electricity Sent Out",   series: "electricity_sent_out",   unit: "GWh" },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Electricity Consumed",   series: "electricity_consumption",unit: "GWh" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
    ],
  },
  // Key stays "firs" because it is stored on staff accounts; FIRS became the
  // Nigeria Revenue Service on 1 Jan 2026 (NRS (Establishment) Act 2025).
  firs: {
    label: "Nigeria Revenue Service (formerly FIRS)", roleTitle: "Energy Sector Tax & Revenue Dashboard",
    color: "#9F1239", accent: "rgba(159,18,57,0.05)",
    persona: "Energy sector revenue: hydrocarbon tax, CIT, royalties and the production volumes that assessments are computed from.",
    basis: "NRS (Establishment) Act 2025 — energy sector tax administration",
    mandate: ["fiscal", "petroleum", "gas"],
    defaultView: "revenue",
    extraViews: ["compliance"],
    kpis: [
      { label: "Hydrocarbon Tax",    series: "hydrocarbon_tax",      unit: "₦ Billion" },
      { label: "CIT — Energy",       series: "cit_energy",           unit: "₦ Billion" },
      { label: "Upstream Royalties", series: "upstream_royalties",   unit: "₦ Billion" },
      { label: "FAAC Oil Revenue",   series: "faac_oil_revenue",     unit: "₦ Billion" },
    ],
  },

  // ── Analyst personas ────────────────────────────────────────────────────
  executive: {
    label: "Executive Overview", roleTitle: "National Energy Dashboard",
    color: "#0E7A3C", accent: "rgba(14,122,60,0.06)",
    persona: "Cross-sector headline indicators for executive users.",
    basis: "Cross-sector executive view",
    mandate: ["petroleum", "gas", "electricity", "renewable", "biomass", "fiscal"],
    defaultView: "overview",
    // No NECAL2050 here on purpose. "executive" is the profile every account
    // falls back to when none was assigned, so a restricted capability granted
    // here would be granted to everybody by accident. Planning access is held
    // by the presidency, ECN and NEMIC profiles, which are assigned deliberately.
    kpis: [
      { label: "Crude Oil Production",   series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "PMS (Petrol) Sales",     series: "pms_sales",              unit: "M Litres" },
      { label: "Natural Gas Produced",   series: "natural_gas_production", unit: "Bcf" },
    ],
  },
  petroleum: {
    label: "Petroleum & Gas Analyst", roleTitle: "Petroleum & Gas Dashboard",
    color: "#92400E", accent: "rgba(146,64,14,0.05)",
    persona: "Petroleum and gas series: production and product sales.",
    basis: "Petroleum and gas analysis",
    mandate: ["petroleum", "gas"],
    defaultView: "upstream",
    kpis: [
      { label: "Crude Oil Production", series: "crude_oil_production", unit: "M Barrels" },
      { label: "PMS (Petrol) Sales",   series: "pms_sales",            unit: "M Litres" },
      { label: "AGO (Diesel) Sales",   series: "ago_sales",            unit: "M Litres" },
      { label: "LPG Sales",            series: "lpg_sales",            unit: "MT" },
    ],
  },
  electricity: {
    label: "Power & Grid Analyst", roleTitle: "Power Sector Dashboard",
    color: "#1D4ED8", accent: "rgba(29,78,216,0.05)",
    persona: "Power sector series: generation, energy sent out, consumption and renewable capacity.",
    basis: "Power sector analysis",
    mandate: ["electricity", "renewable"],
    defaultView: "power",
    kpis: [
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Electricity Sent Out",   series: "electricity_sent_out",   unit: "GWh" },
      { label: "Electricity Consumed",   series: "electricity_consumption",unit: "GWh" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
    ],
  },
  renewables: {
    label: "Clean Energy Analyst", roleTitle: "Renewables & Clean Energy Dashboard",
    color: "#059669", accent: "rgba(5,150,105,0.05)",
    persona: "Clean energy series: renewable capacity, LPG uptake and biomass displacement.",
    basis: "Clean energy transition analysis",
    mandate: ["renewable", "biomass", "gas", "electricity"],
    defaultView: "renewable",
    kpis: [
      { label: "Renewable Capacity",   series: "renewable_energy",       unit: "MW" },
      { label: "Natural Gas Produced", series: "natural_gas_production", unit: "Bcf" },
      { label: "Fuelwood Consumption", series: "fuelwood_consumption",   unit: "M m³", higherIsBetter: false },
      { label: "LPG Sales",            series: "lpg_sales",              unit: "MT" },
    ],
  },
  fiscal: {
    label: "Fiscal & Revenue Analyst", roleTitle: "Fiscal Revenue Dashboard",
    color: "#7C3AED", accent: "rgba(124,58,237,0.05)",
    persona: "Fiscal series: revenue lines and the production volumes behind them.",
    basis: "Energy fiscal analysis",
    mandate: ["fiscal", "petroleum", "gas"],
    defaultView: "revenue",
    extraViews: ["compliance"],
    kpis: [
      { label: "FAAC Oil Revenue",   series: "faac_oil_revenue",     unit: "₦ Billion" },
      { label: "Upstream Royalties", series: "upstream_royalties",   unit: "₦ Billion" },
      { label: "Hydrocarbon Tax",    series: "hydrocarbon_tax",      unit: "₦ Billion" },
      { label: "CIT — Energy",       series: "cit_energy",           unit: "₦ Billion" },
    ],
  },

  // ── Investor profiles ───────────────────────────────────────────────────
  investor_fdi: {
    label: "FDI Intelligence", roleTitle: "Foreign Direct Investment Dashboard",
    color: "#1B2A4A", accent: "rgba(27,42,74,0.06)",
    persona: "Upstream and fiscal series relevant to direct investment appraisal.",
    basis: "Investor access — upstream, gas and fiscal",
    mandate: ["petroleum", "gas", "fiscal"],
    defaultView: "upstream",
    extraViews: ["deals"],
    kpis: [
      { label: "Crude Oil Production", series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Natural Gas Produced", series: "natural_gas_production", unit: "Bcf" },
      { label: "Upstream Royalties",   series: "upstream_royalties",     unit: "₦ Billion" },
      { label: "FAAC Oil Revenue",     series: "faac_oil_revenue",       unit: "₦ Billion" },
    ],
  },
  investor_capital: {
    label: "Capital Markets", roleTitle: "Energy Sector Capital Markets Dashboard",
    color: "#0C4A6E", accent: "rgba(12,74,110,0.06)",
    persona: "Revenue and production series relevant to portfolio and fixed income analysis.",
    basis: "Investor access — fiscal, petroleum and power",
    mandate: ["fiscal", "petroleum", "gas", "electricity"],
    defaultView: "revenue",
    extraViews: ["deals"],
    kpis: [
      { label: "FAAC Oil Revenue",      series: "faac_oil_revenue",       unit: "₦ Billion" },
      { label: "Upstream Royalties",    series: "upstream_royalties",     unit: "₦ Billion" },
      { label: "Crude Oil Production",  series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Electricity Generation",series: "electricity_generation", unit: "GWh" },
    ],
  },
  investor_infra: {
    label: "Infrastructure / Power", roleTitle: "Power & Infrastructure Investor Dashboard",
    color: "#B45309", accent: "rgba(180,83,9,0.06)",
    persona: "Power sector series relevant to generation and distribution asset appraisal.",
    basis: "Investor access — electricity and renewables",
    mandate: ["electricity", "renewable"],
    defaultView: "power",
    extraViews: ["deals"],
    kpis: [
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Electricity Sent Out",   series: "electricity_sent_out",   unit: "GWh" },
      { label: "Electricity Consumed",   series: "electricity_consumption",unit: "GWh" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
    ],
  },
  investor_renewable: {
    label: "Renewable Investors", roleTitle: "Clean Energy Investment Dashboard",
    color: "#059669", accent: "rgba(5,150,105,0.06)",
    persona: "Renewable capacity and clean energy series relevant to project developers.",
    basis: "Investor access — renewables, power and biomass",
    mandate: ["renewable", "electricity", "biomass"],
    defaultView: "renewable",
    extraViews: ["deals"],
    kpis: [
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Electricity Consumed",   series: "electricity_consumption",unit: "GWh" },
      { label: "Fuelwood Consumption",   series: "fuelwood_consumption",   unit: "M m³", higherIsBetter: false },
    ],
  },
};

/** Every profile key, for admin pickers. */
export const PROFILE_KEYS = Object.keys(PROFILE_MAP);
