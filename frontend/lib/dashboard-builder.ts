// ── lib/dashboard-builder.ts ────────────────────────────────────────────────
// Shared types + the energy-series catalogue for the no-code dashboard
// builder. Used by the composer (/admin/dashboards), the config API and the
// widget renderer, so every side agrees on the same series, units and widget
// shape.

export type WidgetKind = "chart" | "kpi" | "map";
export type ChartType = "line" | "bar" | "area" | "column";

export type WidgetConfig = {
  series: string[];            // energy series ids (1 for kpi/map, 1+ for chart)
  chartType?: ChartType;       // charts only
  unit?: string;
  higherIsBetter?: boolean;    // kpi/map coloring
};

export type BuilderWidget = {
  id?: number;
  kind: WidgetKind;
  title: string;
  config: WidgetConfig;
  display_order: number;
};

export type BuilderTab = {
  id?: number;
  scope: "profile" | "account";
  profile_key?: string | null;
  owner_username?: string | null;
  label: string;
  slug: string;
  display_order: number;
  widgets: BuilderWidget[];
};

// The energy series admins can drop into widgets — id, label, default unit,
// a source label and whether higher is better (drives KPI arrows / map ramp).
export const SERIES_CATALOG: { id: string; label: string; unit: string; source: string; higherIsBetter?: boolean }[] = [
  { id: "crude_oil_production",    label: "Crude oil production",     unit: "M Barrels", source: "NUPRC",          higherIsBetter: true },
  { id: "natural_gas_production",  label: "Natural gas production",   unit: "Bcf",       source: "NUPRC / NNPCL",  higherIsBetter: true },
  { id: "pms_sales",              label: "PMS (petrol) sales",        unit: "M Litres",  source: "NMDPRA",         higherIsBetter: true },
  { id: "ago_sales",              label: "AGO (diesel) sales",        unit: "M Litres",  source: "NMDPRA",         higherIsBetter: true },
  { id: "kerosine_sales",         label: "Kerosene (DPK) sales",      unit: "M Litres",  source: "NMDPRA",         higherIsBetter: true },
  { id: "lpg_sales",              label: "LPG sales",                 unit: "MT",        source: "NMDPRA",         higherIsBetter: true },
  { id: "electricity_generation", label: "Electricity generation",    unit: "GWh",       source: "NERC / TCN",     higherIsBetter: true },
  { id: "electricity_sent_out",   label: "Electricity sent out",      unit: "GWh",       source: "TCN / NERC",     higherIsBetter: true },
  { id: "electricity_consumption",label: "Electricity consumption",   unit: "GWh",       source: "NERC",           higherIsBetter: true },
  { id: "renewable_energy",       label: "Renewable energy capacity", unit: "MW",        source: "REA / NERC",     higherIsBetter: true },
  { id: "fuelwood_consumption",   label: "Fuelwood consumption",      unit: "M m³",      source: "ECN / NBS",      higherIsBetter: false },
  { id: "faac_oil_revenue",       label: "FAAC oil revenue",          unit: "₦ Billion", source: "RMAFC / CBN",    higherIsBetter: true },
  { id: "upstream_royalties",     label: "Upstream royalties",        unit: "₦ Billion", source: "NUPRC / FIRS",   higherIsBetter: true },
];

export const seriesMeta = (id: string) => SERIES_CATALOG.find((s) => s.id === id);

// The multi-series palette for chart widgets (matches the dashboard's colors).
export const WIDGET_COLORS = ["#0E7A3C", "#1D4ED8", "#B45309", "#7C3AED", "#0891B2"];

export function builderSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// The 21 built-in dashboard profiles a custom tab can target (key + label).
export const DASHBOARD_PROFILES: { key: string; label: string }[] = [
  { key: "presidency", label: "State House — Presidency" },
  { key: "ecn", label: "ECN — Energy Commission of Nigeria" },
  { key: "nerc", label: "NERC — Electricity Regulatory Commission" },
  { key: "nuprc", label: "NUPRC — Upstream Petroleum Regulator" },
  { key: "nmdpra", label: "NMDPRA — Midstream & Downstream Regulator" },
  { key: "nnpcl", label: "NNPC Limited" },
  { key: "nemic", label: "NEMIC — Energy Management & Infrastructure" },
  { key: "nrs", label: "NRS — Natural Resources Statistics" },
  { key: "rea", label: "REA — Rural Electrification Agency" },
  { key: "tcn", label: "TCN — Transmission Company of Nigeria" },
  { key: "firs", label: "FIRS — Federal Inland Revenue Service" },
  { key: "nbs", label: "NBS — National Bureau of Statistics" },
  { key: "executive", label: "Executive Overview" },
  { key: "petroleum", label: "Petroleum & Gas Analyst" },
  { key: "electricity", label: "Power & Grid Analyst" },
  { key: "renewables", label: "Clean Energy Analyst" },
  { key: "fiscal", label: "Fiscal & Revenue Analyst" },
  { key: "investor_fdi", label: "FDI Intelligence" },
  { key: "investor_capital", label: "Capital Markets" },
  { key: "investor_infra", label: "Infrastructure / Power" },
  { key: "investor_renewable", label: "Renewable Investors" },
];
