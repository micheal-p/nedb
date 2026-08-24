// ── lib/dashboard-profiles.ts ───────────────────────────────────────────────
// Single source of truth for the per-entity dashboard profiles. Consumed by
// the live dashboard (app/data-point/dashboard) and the admin Dashboard
// Directory (app/admin/dashboards). Persona lines are factual descriptions of
// what the profile shows, not marketing copy.

export interface KPIDef { label: string; series: string; unit: string; higherIsBetter?: boolean }

export interface ProfileDef {
  label: string; roleTitle: string; color: string; accent: string;
  persona: string; defaultView: string; navOrder: string[];
  kpis: KPIDef[];
}

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
  faac_oil_revenue:       "FAAC oil revenue",
  upstream_royalties:     "Upstream royalties",
  hydrocarbon_tax:        "Hydrocarbon tax receipts",
  cit_energy:             "CIT from energy companies",
  gas_flare_penalties:    "Gas flaring penalties",
};

export const ALL_NAV = ["overview","downstream","upstream","midstream","power","renewable","bioenergy","revenue","faac"];

export const PROFILE_MAP: Record<string, ProfileDef> = {
  presidency: {
    label: "State House — Presidency", roleTitle: "National Energy Security Brief",
    color: "#1B2A4A", accent: "rgba(27,42,74,0.06)",
    persona: "Cross-sector headline indicators prepared for the Presidency: crude production, FAAC oil revenue, electricity generation and gas output.",
    defaultView: "overview", navOrder: ALL_NAV,
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
    persona: "All-sector indicators for ECN leadership across petroleum, electricity, gas, renewables and biomass.",
    defaultView: "overview", navOrder: ALL_NAV,
    kpis: [
      { label: "Renewable Capacity",   series: "renewable_energy",       unit: "MW" },
      { label: "Natural Gas Produced", series: "natural_gas_production", unit: "Bcf" },
      { label: "Fuelwood Consumption", series: "fuelwood_consumption",   unit: "M m³",  higherIsBetter: false },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
    ],
  },
  nerc: {
    label: "NERC — Electricity Regulatory Commission", roleTitle: "NERC Electricity Market Dashboard",
    color: "#1D4ED8", accent: "rgba(29,78,216,0.05)",
    persona: "Electricity market indicators for NERC: generation, energy sent out, renewable capacity and settlement-related series.",
    defaultView: "power", navOrder: ["power","downstream","midstream","overview","upstream","renewable","bioenergy","faac","revenue"],
    kpis: [
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Electricity Sent Out",   series: "electricity_sent_out",   unit: "GWh" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
      { label: "Upstream Royalties",     series: "upstream_royalties",     unit: "₦ Billion" },
    ],
  },
  nuprc: {
    label: "NUPRC — Upstream Petroleum Regulator", roleTitle: "NUPRC Upstream Petroleum Dashboard",
    color: "#78350F", accent: "rgba(120,53,15,0.05)",
    persona: "Upstream indicators for NUPRC: crude production, gas production, royalties and FAAC oil revenue.",
    defaultView: "upstream", navOrder: ["upstream","revenue","overview","downstream","midstream","faac","power","renewable","bioenergy"],
    kpis: [
      { label: "Crude Oil Production", series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Natural Gas Produced", series: "natural_gas_production", unit: "Bcf" },
      { label: "Upstream Royalties",   series: "upstream_royalties",     unit: "₦ Billion" },
      { label: "FAAC Oil Revenue",     series: "faac_oil_revenue",       unit: "₦ Billion" },
    ],
  },
  nmdpra: {
    label: "NMDPRA — Midstream & Downstream Regulator", roleTitle: "NMDPRA Midstream & Downstream Dashboard",
    color: "#0369A1", accent: "rgba(3,105,161,0.05)",
    persona: "Midstream and downstream indicators for NMDPRA: PMS, AGO, LPG and kerosene distribution volumes.",
    defaultView: "downstream", navOrder: ["downstream","midstream","overview","upstream","revenue","power","renewable","bioenergy","faac"],
    kpis: [
      { label: "PMS (Petrol) Sales",  series: "pms_sales",     unit: "M Litres" },
      { label: "AGO (Diesel) Sales",  series: "ago_sales",     unit: "M Litres" },
      { label: "LPG Sales",           series: "lpg_sales",     unit: "MT" },
      { label: "Kerosene (DPK) Sales",series: "kerosine_sales",unit: "M Litres" },
    ],
  },
  nnpcl: {
    label: "NNPC Limited", roleTitle: "NNPC Limited Operations Dashboard",
    color: "#065F46", accent: "rgba(6,95,70,0.05)",
    persona: "Operational indicators for NNPC Limited: production, product sales and revenue series.",
    defaultView: "upstream", navOrder: ["upstream","downstream","midstream","revenue","overview","power","renewable","bioenergy","faac"],
    kpis: [
      { label: "Crude Oil Production", series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Natural Gas Produced", series: "natural_gas_production", unit: "Bcf" },
      { label: "PMS (Petrol) Sales",   series: "pms_sales",              unit: "M Litres" },
      { label: "FAAC Oil Revenue",     series: "faac_oil_revenue",       unit: "₦ Billion" },
    ],
  },
  nemic: {
    label: "NEMIC — Energy Management & Infrastructure", roleTitle: "NEMIC Energy Management Dashboard",
    color: "#4338CA", accent: "rgba(67,56,202,0.05)",
    persona: "Infrastructure indicators for NEMIC: generation, energy sent out, renewable capacity and biomass use.",
    defaultView: "power", navOrder: ["power","midstream","renewable","overview","downstream","upstream","bioenergy","faac","revenue"],
    kpis: [
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Electricity Sent Out",   series: "electricity_sent_out",   unit: "GWh" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
      { label: "Fuelwood Consumption",   series: "fuelwood_consumption",   unit: "M m³", higherIsBetter: false },
    ],
  },
  nrs: {
    label: "NRS — Natural Resources Statistics", roleTitle: "NRS Natural Resources Statistical Dashboard",
    color: "#6B21A8", accent: "rgba(107,33,168,0.05)",
    persona: "Statistical series for natural resources reporting: production and consumption volumes across sectors.",
    defaultView: "overview", navOrder: ALL_NAV,
    kpis: [
      { label: "Crude Oil Production",   series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Natural Gas Produced",   series: "natural_gas_production", unit: "Bcf" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
    ],
  },
  rea: {
    label: "REA — Rural Electrification Agency", roleTitle: "REA Rural Electrification & Off-Grid Dashboard",
    color: "#15803D", accent: "rgba(21,128,61,0.05)",
    persona: "Rural electrification indicators for REA: renewable capacity, LPG uptake and fuelwood displacement.",
    defaultView: "renewable", navOrder: ["renewable","bioenergy","power","overview","downstream","upstream","midstream","faac","revenue"],
    kpis: [
      { label: "Renewable Capacity",   series: "renewable_energy",     unit: "MW" },
      { label: "LPG Sales",            series: "lpg_sales",            unit: "MT" },
      { label: "Fuelwood Consumption", series: "fuelwood_consumption", unit: "M m³", higherIsBetter: false },
      { label: "Electricity Generation",series: "electricity_generation",unit: "GWh" },
    ],
  },
  tcn: {
    label: "TCN — Transmission Company of Nigeria", roleTitle: "TCN Grid Transmission Dashboard",
    color: "#B45309", accent: "rgba(180,83,9,0.05)",
    persona: "Grid indicators for TCN: energy sent out, generation, consumption and renewable capacity.",
    defaultView: "power", navOrder: ["power","midstream","downstream","overview","upstream","renewable","bioenergy","faac","revenue"],
    kpis: [
      { label: "Electricity Sent Out",  series: "electricity_sent_out",   unit: "GWh" },
      { label: "Electricity Generation",series: "electricity_generation", unit: "GWh" },
      { label: "Electricity Consumed",  series: "electricity_consumption",unit: "GWh" },
      { label: "Renewable Capacity",    series: "renewable_energy",       unit: "MW" },
    ],
  },
  // Key stays "firs" because it is stored on staff accounts; FIRS became the
  // Nigeria Revenue Service on 1 Jan 2026 (NRS (Establishment) Act 2025).
  firs: {
    label: "Nigeria Revenue Service (formerly FIRS)", roleTitle: "Energy Sector Tax & Revenue Dashboard",
    color: "#9F1239", accent: "rgba(159,18,57,0.05)",
    persona: "Energy sector revenue series for the Nigeria Revenue Service: FAAC oil revenue, upstream royalties and the production volumes behind them.",
    defaultView: "revenue", navOrder: ["revenue","faac","upstream","overview","downstream","midstream","power","renewable","bioenergy"],
    kpis: [
      { label: "FAAC Oil Revenue",   series: "faac_oil_revenue",       unit: "₦ Billion" },
      { label: "Upstream Royalties", series: "upstream_royalties",     unit: "₦ Billion" },
      { label: "Crude Oil Produced", series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Natural Gas",        series: "natural_gas_production", unit: "Bcf" },
    ],
  },
  nbs: {
    label: "NBS — National Bureau of Statistics", roleTitle: "NBS Energy Sector Statistical Dashboard",
    color: "#0C4A6E", accent: "rgba(12,74,110,0.05)",
    persona: "Energy statistics for NBS: production, generation, gas and renewable capacity series for national accounts work.",
    defaultView: "overview", navOrder: ALL_NAV,
    kpis: [
      { label: "Crude Oil Production",   series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Natural Gas Produced",   series: "natural_gas_production", unit: "Bcf" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
    ],
  },
  executive: {
    label: "Executive Overview", roleTitle: "National Energy Dashboard",
    color: "#0E7A3C", accent: "rgba(14,122,60,0.06)",
    persona: "Cross-sector headline indicators for executive users.",
    defaultView: "overview", navOrder: ["overview","downstream","revenue","upstream","power","midstream","renewable","bioenergy","faac"],
    kpis: [
      { label: "Crude Oil Production",   series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "PMS (Petrol) Sales",     series: "pms_sales",              unit: "M Litres" },
      { label: "Natural Gas Produced",   series: "natural_gas_production", unit: "Bcf" },
    ],
  },
  petroleum: {
    label: "Petroleum & Gas Analyst", roleTitle: "Petroleum & Upstream Dashboard",
    color: "#92400E", accent: "rgba(146,64,14,0.05)",
    persona: "Petroleum series: crude production and PMS, AGO and LPG sales.",
    defaultView: "downstream", navOrder: ["downstream","upstream","revenue","overview","midstream","power","renewable","bioenergy","faac"],
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
    defaultView: "power", navOrder: ["power","downstream","midstream","overview","upstream","renewable","bioenergy","faac","revenue"],
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
    persona: "Clean energy series: renewable capacity, gas production, LPG sales and fuelwood consumption.",
    defaultView: "renewable", navOrder: ["renewable","bioenergy","overview","power","upstream","downstream","midstream","faac","revenue"],
    kpis: [
      { label: "Natural Gas Produced", series: "natural_gas_production", unit: "Bcf" },
      { label: "Renewable Capacity",   series: "renewable_energy",       unit: "MW" },
      { label: "Fuelwood Consumption", series: "fuelwood_consumption",   unit: "M m³", higherIsBetter: false },
      { label: "LPG Sales",            series: "lpg_sales",              unit: "MT" },
    ],
  },
  fiscal: {
    label: "Fiscal & Revenue Analyst", roleTitle: "Fiscal Revenue Dashboard",
    color: "#7C3AED", accent: "rgba(124,58,237,0.05)",
    persona: "Fiscal series: FAAC oil revenue, upstream royalties and the producing companies registry.",
    defaultView: "revenue", navOrder: ["revenue","faac","upstream","overview","downstream","midstream","power","renewable","bioenergy"],
    kpis: [
      { label: "FAAC Oil Revenue",   series: "faac_oil_revenue",       unit: "₦ Billion" },
      { label: "Upstream Royalties", series: "upstream_royalties",     unit: "₦ Billion" },
      { label: "Crude Oil Produced", series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Natural Gas",        series: "natural_gas_production", unit: "Bcf" },
    ],
  },

  // ── Investor profiles ──────────────────────────────────────────
  investor_fdi: {
    label: "FDI Intelligence", roleTitle: "Foreign Direct Investment Dashboard",
    color: "#1B2A4A", accent: "rgba(27,42,74,0.06)",
    persona: "Upstream and revenue series relevant to foreign direct investment appraisal.",
    defaultView: "upstream", navOrder: ["upstream","revenue","overview","power","downstream","renewable","midstream","bioenergy","faac"],
    kpis: [
      { label: "Crude Oil Production", series: "crude_oil_production",   unit: "M Barrels" },
      { label: "FAAC Oil Revenue",     series: "faac_oil_revenue",       unit: "₦ Billion" },
      { label: "Upstream Royalties",   series: "upstream_royalties",     unit: "₦ Billion" },
      { label: "Natural Gas Produced", series: "natural_gas_production", unit: "Bcf" },
    ],
  },
  investor_capital: {
    label: "Capital Markets", roleTitle: "Energy Sector Capital Markets Dashboard",
    color: "#0C4A6E", accent: "rgba(12,74,110,0.06)",
    persona: "Revenue and production series relevant to portfolio and fixed income analysis.",
    defaultView: "revenue", navOrder: ["revenue","faac","overview","upstream","downstream","power","renewable","midstream","bioenergy"],
    kpis: [
      { label: "FAAC Oil Revenue",     series: "faac_oil_revenue",       unit: "₦ Billion" },
      { label: "Upstream Royalties",   series: "upstream_royalties",     unit: "₦ Billion" },
      { label: "Crude Oil Production", series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Electricity Generation",series: "electricity_generation",unit: "GWh" },
    ],
  },
  investor_infra: {
    label: "Infrastructure / Power", roleTitle: "Power & Infrastructure Investor Dashboard",
    color: "#B45309", accent: "rgba(180,83,9,0.06)",
    persona: "Power sector series relevant to generation and distribution asset appraisal.",
    defaultView: "power", navOrder: ["power","revenue","downstream","overview","upstream","renewable","midstream","bioenergy","faac"],
    kpis: [
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Electricity Sent Out",   series: "electricity_sent_out",   unit: "GWh" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
      { label: "FAAC Oil Revenue",       series: "faac_oil_revenue",       unit: "₦ Billion" },
    ],
  },
  investor_renewable: {
    label: "Renewable Investors", roleTitle: "Clean Energy Investment Dashboard",
    color: "#059669", accent: "rgba(5,150,105,0.06)",
    persona: "Renewable capacity and clean energy series relevant to project developers.",
    defaultView: "renewable", navOrder: ["renewable","overview","power","revenue","upstream","downstream","midstream","bioenergy","faac"],
    kpis: [
      { label: "Renewable Capacity",   series: "renewable_energy",     unit: "MW" },
      { label: "LPG Sales",            series: "lpg_sales",            unit: "MT" },
      { label: "Fuelwood Consumption", series: "fuelwood_consumption", unit: "M m³", higherIsBetter: false },
      { label: "Electricity Generation",series: "electricity_generation",unit: "GWh" },
    ],
  },
};
