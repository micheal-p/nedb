"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearTokens, isLoggedIn, getFullName, getRole, getDashboardProfile, getTokenFresh } from "@/lib/auth";
import type { BuilderTab } from "@/lib/dashboard-builder";
import dynamic from "next/dynamic";
import CoatOfArms from "@/components/layout/CoatOfArms";

const SectorChart = dynamic(() => import("@/components/datapoint/SectorChart"), { ssr: false });
const NigeriaMap  = dynamic(() => import("@/components/datapoint/NigeriaMap"),  { ssr: false });
const PenaPanel   = dynamic(() => import("@/components/datapoint/panels/PenaPanel"), { ssr: false });
const ApexAI      = dynamic(() => import("@/components/datapoint/ApexAI"),      { ssr: false });
const DashboardWidget = dynamic(() => import("@/components/datapoint/DashboardWidget"), { ssr: false });

// ── Real data types ────────────────────────────────────────────
type SeriesRow = { period: string; value: number; unit?: string };
type DashData  = Record<string, SeriesRow[]>;

function mergeSeries(pairs: { data: SeriesRow[]; key: string }[]): { period: string; [key: string]: string | number }[] {
  const map = new Map<string, { period: string; [key: string]: string | number }>();
  for (const { data, key } of pairs) {
    for (const row of data) {
      if (!map.has(row.period)) map.set(row.period, { period: row.period });
      map.get(row.period)![key] = row.value;
    }
  }
  return [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function EmptyChart({ seriesName }: { seriesName: string }) {
  return (
    <div style={{ height: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "var(--ink-5)" }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink-4)" }}>No data for {seriesName}</div>
      <div style={{ fontSize: "0.72rem" }}>Add records via Admin → Data Entry</div>
    </div>
  );
}

// ── Profile definitions ────────────────────────────────────────
interface KPIDef { label: string; series: string; unit: string; higherIsBetter?: boolean }
interface KPI    { label: string; value: string; unit: string; change: string; up: boolean; period: string }
interface Alert  { level: string; msg: string; time: string }

interface ProfileDef {
  label: string; roleTitle: string; color: string; accent: string;
  persona: string; defaultView: string; navOrder: string[];
  kpis: KPIDef[];
}

const SERIES_LABELS: Record<string, string> = {
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
};

function computeAnomalies(data: DashData): Alert[] {
  const alerts: Alert[] = [];
  for (const [id, rows] of Object.entries(data)) {
    if (!rows.length) continue;
    const label  = SERIES_LABELS[id] ?? id;
    const latest = rows[rows.length - 1];

    if (rows.length >= 4) {
      const window3 = rows.slice(-4, -1);
      const avg3    = window3.reduce((s, r) => s + r.value, 0) / window3.length;
      if (avg3 !== 0) {
        const dev = ((latest.value - avg3) / Math.abs(avg3)) * 100;
        if (Math.abs(dev) >= 15) {
          const dir = dev > 0 ? "above" : "below";
          alerts.push({
            level: Math.abs(dev) >= 25 ? "high" : "medium",
            msg:   `${label} is ${Math.abs(dev).toFixed(0)}% ${dir} its 3-period rolling average.`,
            time:  latest.period,
          });
        }
      }
    }

    if (rows.length >= 3) {
      const [r0, r1, r2] = rows.slice(-3);
      if (r0.value > r1.value && r1.value > r2.value && r0.value !== 0) {
        const drop = ((r0.value - r2.value) / r0.value) * 100;
        if (drop > 5) {
          alerts.push({
            level: drop > 20 ? "medium" : "low",
            msg:   `${label} declining 3 consecutive periods (−${drop.toFixed(1)}% cumulative).`,
            time:  r2.period,
          });
        }
      }
    }
  }
  const ord: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => (ord[a.level] ?? 3) - (ord[b.level] ?? 3));
}

function fmtKpiValue(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "T";
  if (v >= 1_000)     return (v / 1_000).toFixed(1) + "K";
  if (v < 10)         return v.toFixed(2);
  return v.toFixed(1);
}

function computeKPI(def: KPIDef, data: DashData): KPI {
  const rows = data[def.series] ?? [];
  if (!rows.length) return { label: def.label, value: "—", unit: def.unit, change: "", up: true, period: "No data yet" };
  const latest = rows[rows.length - 1];
  const prev   = rows.length >= 2 ? rows[rows.length - 2] : null;
  let change = ""; let up = true;
  if (prev && prev.value !== 0) {
    const pct = ((latest.value - prev.value) / Math.abs(prev.value)) * 100;
    change = Math.abs(pct).toFixed(1) + "%";
    up = def.higherIsBetter !== false ? pct >= 0 : pct <= 0;
  }
  return { label: def.label, value: fmtKpiValue(latest.value), unit: def.unit, change, up, period: latest.period };
}

const ALL_NAV = ["overview","downstream","upstream","midstream","power","renewable","bioenergy","revenue","faac"];

const PROFILE_MAP: Record<string, ProfileDef> = {
  presidency: {
    label: "State House — Presidency", roleTitle: "National Energy Security Intelligence Brief",
    color: "#1B2A4A", accent: "rgba(27,42,74,0.06)",
    persona: "Strategic energy intelligence for the Presidency. Cross-sector overview covering national energy security, production benchmarks and fiscal performance.",
    defaultView: "overview", navOrder: ALL_NAV,
    kpis: [
      { label: "Crude Oil Production",   series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Oil Revenue (FAAC)",     series: "faac_oil_revenue",       unit: "₦ Billion" },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Natural Gas Produced",   series: "natural_gas_production", unit: "Bcf" },
    ],
  },
  ecn: {
    label: "ECN — Energy Commission of Nigeria", roleTitle: "ECN National Energy Policy Intelligence",
    color: "#0E7A3C", accent: "rgba(14,122,60,0.06)",
    persona: "All-sector energy intelligence for ECN leadership. Policy monitoring across petroleum, electricity, gas, renewables and biomass sectors.",
    defaultView: "overview", navOrder: ALL_NAV,
    kpis: [
      { label: "Renewable Capacity",   series: "renewable_energy",       unit: "MW" },
      { label: "Natural Gas Produced", series: "natural_gas_production", unit: "Bcf" },
      { label: "Fuelwood Consumption", series: "fuelwood_consumption",   unit: "M m³",  higherIsBetter: false },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
    ],
  },
  nerc: {
    label: "NERC — Electricity Regulatory Commission", roleTitle: "NERC Electricity Market Regulatory Dashboard",
    color: "#1D4ED8", accent: "rgba(29,78,216,0.05)",
    persona: "Regulatory intelligence for NERC. DisCo compliance, market settlement, tariff performance and grid reliability monitoring.",
    defaultView: "power", navOrder: ["power","downstream","midstream","overview","upstream","renewable","bioenergy","faac","revenue"],
    kpis: [
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Electricity Sent Out",   series: "electricity_sent_out",   unit: "GWh" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
      { label: "Upstream Royalties",     series: "upstream_royalties",     unit: "₦ Billion" },
    ],
  },
  nuprc: {
    label: "NUPRC — Upstream Petroleum Regulator", roleTitle: "NUPRC Upstream Petroleum Regulatory Dashboard",
    color: "#78350F", accent: "rgba(120,53,15,0.05)",
    persona: "Upstream regulatory intelligence for NUPRC. Crude oil production, OML block performance, licensing, royalty compliance and flare reduction monitoring.",
    defaultView: "upstream", navOrder: ["upstream","revenue","overview","downstream","midstream","faac","power","renewable","bioenergy"],
    kpis: [
      { label: "Crude Oil Production", series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Natural Gas Produced", series: "natural_gas_production", unit: "Bcf" },
      { label: "Upstream Royalties",   series: "upstream_royalties",     unit: "₦ Billion" },
      { label: "FAAC Oil Revenue",     series: "faac_oil_revenue",       unit: "₦ Billion" },
    ],
  },
  nmdpra: {
    label: "NMDPRA — Midstream & Downstream Regulator", roleTitle: "NMDPRA Midstream & Downstream Regulatory Dashboard",
    color: "#0369A1", accent: "rgba(3,105,161,0.05)",
    persona: "Midstream and downstream regulatory intelligence. Refinery throughput, product distribution, pipeline performance and retail compliance.",
    defaultView: "downstream", navOrder: ["downstream","midstream","overview","upstream","revenue","power","renewable","bioenergy","faac"],
    kpis: [
      { label: "PMS (Petrol) Sales",  series: "pms_sales",     unit: "M Litres" },
      { label: "AGO (Diesel) Sales",  series: "ago_sales",     unit: "M Litres" },
      { label: "LPG Sales",           series: "lpg_sales",     unit: "MT" },
      { label: "Kerosene (DPK) Sales",series: "kerosine_sales",unit: "M Litres" },
    ],
  },
  nnpcl: {
    label: "NNPC Limited", roleTitle: "NNPC Limited Operational Intelligence Dashboard",
    color: "#065F46", accent: "rgba(6,95,70,0.05)",
    persona: "Operational and commercial intelligence for NNPC Limited. Production performance, equity crude, gas monetisation and downstream operations.",
    defaultView: "upstream", navOrder: ["upstream","downstream","midstream","revenue","overview","power","renewable","bioenergy","faac"],
    kpis: [
      { label: "Crude Oil Production", series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Natural Gas Produced", series: "natural_gas_production", unit: "Bcf" },
      { label: "PMS (Petrol) Sales",   series: "pms_sales",              unit: "M Litres" },
      { label: "FAAC Oil Revenue",     series: "faac_oil_revenue",       unit: "₦ Billion" },
    ],
  },
  nemic: {
    label: "NEMIC — Energy Management & Infrastructure", roleTitle: "NEMIC National Energy Management Intelligence",
    color: "#4338CA", accent: "rgba(67,56,202,0.05)",
    persona: "Infrastructure and management intelligence. Energy infrastructure investment, grid capacity, emergency response and critical asset monitoring.",
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
    persona: "Statistical intelligence for natural resources reporting. Production volumes, consumption trends, cross-sector comparisons and data quality monitoring.",
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
    persona: "Rural electrification and off-grid intelligence. Mini-grid rollout, solar penetration, off-grid connections and clean energy access by state.",
    defaultView: "renewable", navOrder: ["renewable","bioenergy","power","overview","downstream","upstream","midstream","faac","revenue"],
    kpis: [
      { label: "Renewable Capacity",   series: "renewable_energy",     unit: "MW" },
      { label: "LPG Sales",            series: "lpg_sales",            unit: "MT" },
      { label: "Fuelwood Consumption", series: "fuelwood_consumption", unit: "M m³", higherIsBetter: false },
      { label: "Electricity Generation",series: "electricity_generation",unit: "GWh" },
    ],
  },
  tcn: {
    label: "TCN — Transmission Company of Nigeria", roleTitle: "TCN Grid Transmission Intelligence Dashboard",
    color: "#B45309", accent: "rgba(180,83,9,0.05)",
    persona: "Transmission grid intelligence for TCN management. Grid capacity, wheeling capacity, system stability, constraint management and capital projects.",
    defaultView: "power", navOrder: ["power","midstream","downstream","overview","upstream","renewable","bioenergy","faac","revenue"],
    kpis: [
      { label: "Electricity Sent Out",  series: "electricity_sent_out",   unit: "GWh" },
      { label: "Electricity Generation",series: "electricity_generation", unit: "GWh" },
      { label: "Electricity Consumed",  series: "electricity_consumption",unit: "GWh" },
      { label: "Renewable Capacity",    series: "renewable_energy",       unit: "MW" },
    ],
  },
  firs: {
    label: "FIRS — Federal Inland Revenue Service", roleTitle: "FIRS Energy Sector Tax & Revenue Dashboard",
    color: "#9F1239", accent: "rgba(159,18,57,0.05)",
    persona: "Energy sector tax and revenue intelligence. Petroleum Profit Tax, royalties, CITA from energy companies and FAAC energy contribution tracking.",
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
    persona: "Energy sector statistical intelligence for NBS. Cross-sector data validation, trend analysis and national accounts reconciliation.",
    defaultView: "overview", navOrder: ALL_NAV,
    kpis: [
      { label: "Crude Oil Production",   series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Natural Gas Produced",   series: "natural_gas_production", unit: "Bcf" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
    ],
  },
  executive: {
    label: "Executive Overview", roleTitle: "National Energy Intelligence Dashboard",
    color: "#0E7A3C", accent: "rgba(14,122,60,0.06)",
    persona: "Cross-sector overview for executive leadership and national policy decision-makers.",
    defaultView: "overview", navOrder: ["overview","downstream","revenue","upstream","power","midstream","renewable","bioenergy","faac"],
    kpis: [
      { label: "Crude Oil Production",   series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "PMS (Petrol) Sales",     series: "pms_sales",              unit: "M Litres" },
      { label: "Natural Gas Produced",   series: "natural_gas_production", unit: "Bcf" },
    ],
  },
  petroleum: {
    label: "Petroleum & Gas Analyst", roleTitle: "Petroleum & Upstream Intelligence Dashboard",
    color: "#92400E", accent: "rgba(146,64,14,0.05)",
    persona: "Upstream crude production, downstream product distribution and retail sales analytics.",
    defaultView: "downstream", navOrder: ["downstream","upstream","revenue","overview","midstream","power","renewable","bioenergy","faac"],
    kpis: [
      { label: "Crude Oil Production", series: "crude_oil_production", unit: "M Barrels" },
      { label: "PMS (Petrol) Sales",   series: "pms_sales",            unit: "M Litres" },
      { label: "AGO (Diesel) Sales",   series: "ago_sales",            unit: "M Litres" },
      { label: "LPG Sales",            series: "lpg_sales",            unit: "MT" },
    ],
  },
  electricity: {
    label: "Power & Grid Analyst", roleTitle: "Power Sector Intelligence Dashboard",
    color: "#1D4ED8", accent: "rgba(29,78,216,0.05)",
    persona: "Generation capacity, grid transmission, distribution losses and market financial settlement.",
    defaultView: "power", navOrder: ["power","downstream","midstream","overview","upstream","renewable","bioenergy","faac","revenue"],
    kpis: [
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Electricity Sent Out",   series: "electricity_sent_out",   unit: "GWh" },
      { label: "Electricity Consumed",   series: "electricity_consumption",unit: "GWh" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
    ],
  },
  renewables: {
    label: "Clean Energy Analyst", roleTitle: "Renewables & Clean Energy Intelligence Dashboard",
    color: "#059669", accent: "rgba(5,150,105,0.05)",
    persona: "Renewable capacity, natural gas production, biomass and clean energy transition metrics.",
    defaultView: "renewable", navOrder: ["renewable","bioenergy","overview","power","upstream","downstream","midstream","faac","revenue"],
    kpis: [
      { label: "Natural Gas Produced", series: "natural_gas_production", unit: "Bcf" },
      { label: "Renewable Capacity",   series: "renewable_energy",       unit: "MW" },
      { label: "Fuelwood Consumption", series: "fuelwood_consumption",   unit: "M m³", higherIsBetter: false },
      { label: "LPG Sales",            series: "lpg_sales",              unit: "MT" },
    ],
  },
  fiscal: {
    label: "Fiscal & Revenue Analyst", roleTitle: "Fiscal Revenue Intelligence Dashboard",
    color: "#7C3AED", accent: "rgba(124,58,237,0.05)",
    persona: "FAAC energy contribution, upstream revenue flows, royalty collections and producing company financial intelligence.",
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
    label: "FDI Intelligence", roleTitle: "Foreign Direct Investment Intelligence Dashboard",
    color: "#1B2A4A", accent: "rgba(27,42,74,0.06)",
    persona: "Investment-grade intelligence for international energy companies and sovereign wealth funds evaluating Nigeria upstream, midstream and power sector assets.",
    defaultView: "upstream", navOrder: ["upstream","revenue","overview","power","downstream","renewable","midstream","bioenergy","faac"],
    kpis: [
      { label: "Crude Oil Production", series: "crude_oil_production",   unit: "M Barrels" },
      { label: "FAAC Oil Revenue",     series: "faac_oil_revenue",       unit: "₦ Billion" },
      { label: "Upstream Royalties",   series: "upstream_royalties",     unit: "₦ Billion" },
      { label: "Natural Gas Produced", series: "natural_gas_production", unit: "Bcf" },
    ],
  },
  investor_capital: {
    label: "Capital Markets", roleTitle: "Energy Sector Capital Markets Intelligence Dashboard",
    color: "#0C4A6E", accent: "rgba(12,74,110,0.06)",
    persona: "Financial intelligence for portfolio investors, equity analysts and fixed income managers tracking Nigerian energy sector assets and revenue flows.",
    defaultView: "revenue", navOrder: ["revenue","faac","overview","upstream","downstream","power","renewable","midstream","bioenergy"],
    kpis: [
      { label: "FAAC Oil Revenue",     series: "faac_oil_revenue",       unit: "₦ Billion" },
      { label: "Upstream Royalties",   series: "upstream_royalties",     unit: "₦ Billion" },
      { label: "Crude Oil Production", series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Electricity Generation",series: "electricity_generation",unit: "GWh" },
    ],
  },
  investor_infra: {
    label: "Infrastructure / Power", roleTitle: "Power & Infrastructure Investor Intelligence Dashboard",
    color: "#B45309", accent: "rgba(180,83,9,0.06)",
    persona: "Due diligence intelligence for IPPs, GenCo acquirers, DisCo investors and infrastructure funds evaluating Nigerian power sector assets.",
    defaultView: "power", navOrder: ["power","revenue","downstream","overview","upstream","renewable","midstream","bioenergy","faac"],
    kpis: [
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Electricity Sent Out",   series: "electricity_sent_out",   unit: "GWh" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
      { label: "FAAC Oil Revenue",       series: "faac_oil_revenue",       unit: "₦ Billion" },
    ],
  },
  investor_renewable: {
    label: "Renewable Investors", roleTitle: "Clean Energy Investment Intelligence Dashboard",
    color: "#059669", accent: "rgba(5,150,105,0.06)",
    persona: "Investment intelligence for solar, wind, mini-grid and clean energy developers. Capacity gap analysis, FiT obligations, REA pipeline and off-grid market intelligence.",
    defaultView: "renewable", navOrder: ["renewable","overview","power","revenue","upstream","downstream","midstream","bioenergy","faac"],
    kpis: [
      { label: "Renewable Capacity",   series: "renewable_energy",     unit: "MW" },
      { label: "LPG Sales",            series: "lpg_sales",            unit: "MT" },
      { label: "Fuelwood Consumption", series: "fuelwood_consumption", unit: "M m³", higherIsBetter: false },
      { label: "Electricity Generation",series: "electricity_generation",unit: "GWh" },
    ],
  },
};

// ── Sidebar nav items ──────────────────────────────────────────
const NAV_ITEMS: Record<string, { label: string; section: string }> = {
  overview:   { label: "Overview",              section: "National Intelligence" },
  brief:      { label: "Energy Brief (PDF)",    section: "National Intelligence" },
  downstream: { label: "Downstream Markets",    section: "Energy Sectors" },
  upstream:   { label: "Upstream Petroleum",    section: "Energy Sectors" },
  midstream:  { label: "Midstream",             section: "Energy Sectors" },
  power:      { label: "Power Generation",      section: "Energy Sectors" },
  renewable:  { label: "Renewable Energy",      section: "Energy Sectors" },
  bioenergy:  { label: "Bioenergy & Biomass",   section: "Energy Sectors" },
  revenue:    { label: "Revenue Portal",        section: "Fiscal Analysis" },
  faac:       { label: "FAAC Contribution",     section: "Fiscal Analysis" },
};
const SOON_VIEWS = new Set(["midstream", "bioenergy", "faac"]);


function downloadTableCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Period navigator ───────────────────────────────────────────
function PeriodNav({ year, setYear, availYears, loading }: { year: number; setYear: (y: number) => void; availYears: number[]; loading?: boolean }) {
  // Show at most the 10 most recent years as chips; ‹ still steps further back
  const allYears = availYears.length ? availYears : [year];
  const years = allYears.slice(-10);
  const minY  = Math.min(...allYears);
  const maxY  = Math.max(...allYears);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: "1.25rem", flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.72rem", color: "var(--ink-4)", fontWeight: 600, marginRight: 4 }}>Period</span>
      <button onClick={() => setYear(Math.max(minY, year - 1))} disabled={year <= minY} style={{ width: 28, height: 28, border: "1px solid var(--border)", borderRadius: 4, background: "transparent", cursor: year > minY ? "pointer" : "not-allowed", color: "var(--ink-4)", fontSize: "0.85rem" }}>‹</button>
      {years.map((y) => (
        <button key={y} onClick={() => setYear(y)} style={{ height: 28, padding: "0 10px", border: `1px solid ${y === year ? "var(--green)" : "var(--border)"}`, borderRadius: 4, background: y === year ? "var(--green)" : "transparent", color: y === year ? "#fff" : "var(--ink-4)", fontSize: "0.75rem", fontWeight: y === year ? 700 : 400, cursor: "pointer" }}>{y}</button>
      ))}
      <button onClick={() => setYear(Math.min(maxY, year + 1))} disabled={year >= maxY} style={{ width: 28, height: 28, border: "1px solid var(--border)", borderRadius: 4, background: "transparent", cursor: year < maxY ? "pointer" : "not-allowed", color: "var(--ink-4)", fontSize: "0.85rem" }}>›</button>
      {loading && <span style={{ marginLeft: 8, fontSize: "0.7rem", color: "var(--ink-5)", fontStyle: "italic" }}>Loading…</span>}
      {!loading && !availYears.length && <span style={{ marginLeft: 8, fontSize: "0.7rem", color: "var(--amber)", fontStyle: "italic" }}>No records yet — add data via Admin → Data Entry</span>}
    </div>
  );
}

// ── Fiscal "coming soon" panels ───────────────────────────────
const FISCAL_PANELS = [
  { id: "upstream",  title: "Upstream Revenue Intelligence",  caption: "Royalties, PPT, profit oil splits and signature bonuses per OML block.", agencies: ["NUPRC","FIRS","NNPC"],  color: "#0E7A3C" },
  { id: "midstream", title: "Midstream Throughput & Tariff",  caption: "Pipeline tariff revenue, GDSO shortfall cost recovery, refinery throughput.", agencies: ["NGC","NMDPRA"],          color: "#1D4ED8" },
  { id: "power",     title: "Power Sector Settlement",        caption: "GenCo invoices vs payments, market shortfall deficit, ATC&C losses in ₦.", agencies: ["NERC","NBET","TCN"],    color: "#B45309" },
  { id: "renewable", title: "Renewable Energy Investment",    caption: "Solar/wind capacity trends, FiT obligations vs actual payments, mini-grid capex.", agencies: ["REA","NERC"],     color: "#0E7A3C" },
  { id: "bioenergy", title: "Bioenergy & Solid Fuels",        caption: "Biomass consumption by state, coal export earnings, fuelwood displacement by LPG.", agencies: ["ECN","MMSD"],  color: "#78350F" },
  { id: "faac",      title: "FAAC Energy Contribution",       caption: "Monthly oil revenue share of FAAC pool vs Federal budget projection.", agencies: ["RMAFC","DMO","CBN"],        color: "#C0392B" },
];

// ── Main dashboard ─────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
  const [view, setView]             = useState("");
  const [clock, setClock]           = useState("");
  const [staffName, setStaffName]   = useState("");
  const [staffRole, setStaffRole]   = useState("");
  const [profile, setProfile]       = useState<ProfileDef>(PROFILE_MAP.executive);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [customTabs, setCustomTabs] = useState<BuilderTab[]>([]);
  const [dashData, setDashData]     = useState<DashData>({});
  const [stateMap, setStateMap]     = useState<Record<string, Record<string, number>>>({});
  const [availYears, setAvailYears] = useState<number[]>([2026]);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/data-point/dashboard"); return; }
    const name    = getFullName() || "Staff";
    const role    = getRole() || "viewer";
    const profKey = getDashboardProfile() || "executive";
    const prof    = PROFILE_MAP[profKey] ?? PROFILE_MAP.executive;
    setStaffName(name); setStaffRole(role); setProfile(prof); setView(prof.defaultView);
    (async () => {
      try {
        const token = await getTokenFresh();
        const r = await fetch(`/api/dashboard/tabs?profile=${profKey}`, { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
        if (r.ok) { const j = await r.json(); setCustomTabs(j.tabs ?? []); }
      } catch { /* custom tabs are additive; ignore */ }
    })();
    const tick = () => setClock(new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [router]);

  const didAutoYear = useRef(false);
  useEffect(() => {
    setDataLoading(true);
    fetch(`/api/dashboard-data?year=${selectedYear}`)
      .then((r) => r.json())
      .then((payload) => {
        setDashData(payload.series ?? {});
        setStateMap(payload.stateMap ?? {});
        if (payload.years?.length) {
          setAvailYears(payload.years);
          // First load: if the default year has no records, snap to the most
          // recent year that actually has data so the dashboard never opens empty.
          if (!didAutoYear.current) {
            didAutoYear.current = true;
            if (!Object.keys(payload.series ?? {}).length) {
              setSelectedYear(Math.max(...(payload.years as number[])));
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, [selectedYear]);

  // Convenience aliases — empty array if not yet uploaded
  const s = (id: string): SeriesRow[] => dashData[id] ?? [];

  function logout() { clearTokens(); router.replace("/data-point/login"); }
  function navigate(id: string) { setView(id); setSidebarOpen(false); }

  const orderedNav = [
    ...profile.navOrder.map((id) => ({ id, ...NAV_ITEMS[id] })),
    ...customTabs.map((tb) => ({ id: `custom:${tb.id}`, label: tb.label, section: "Custom Tabs" })),
  ];
  const sections   = [...new Set(orderedNav.map((n) => n.section))];
  const activeCustom = view.startsWith("custom:") ? customTabs.find((tb) => `custom:${tb.id}` === view) : undefined;
  const viewLabel = activeCustom ? activeCustom.label : (NAV_ITEMS[view]?.label ?? view);

  return (
    <div className="dash-wrap">
      <div className={`dash-sidebar-backdrop${sidebarOpen ? " is-open" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* ── SIDEBAR ── */}
      <aside className={`dash-sidebar${sidebarOpen ? " is-open" : ""}`}>
        <div className="sb-brand">
          <div className="sb-seal"><CoatOfArms size={28} /></div>
          <div><div className="sb-name">NEDB</div><div className="sb-system">Intelligence Suite</div></div>
        </div>
        <div style={{ margin: "0 0.75rem 0.5rem", padding: "0.6rem 0.75rem", background: `${profile.color}18`, border: `1px solid ${profile.color}30`, borderRadius: "var(--r-md)" }}>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: profile.color, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Dashboard Profile</div>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.3 }}>{profile.label}</div>
        </div>
        {sections.map((sec) => (
          <div key={sec}>
            <div className="sb-section">{sec}</div>
            {orderedNav.filter((n) => n.section === sec).map((item) => {
              const soon = SOON_VIEWS.has(item.id);
              return (
                <button key={item.id} className={`sb-link${view === item.id ? " active" : ""}`}
                  onClick={() => !soon && navigate(item.id)}
                  style={soon ? { opacity: 0.4, cursor: "not-allowed" } : undefined}>
                  <span className="sb-label">{item.label}</span>
                  {soon && <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", padding: "1px 5px", borderRadius: 3 }}>SOON</span>}
                </button>
              );
            })}
          </div>
        ))}
        <div style={{ marginTop: "auto" }}>
          <div style={{ padding: "0.875rem 1rem", borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{staffName}</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {staffRole === "admin" ? "Administrator" : profile.label}
            </div>
          </div>
          <div style={{ padding: "0.5rem 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {staffRole === "admin" && (
              <Link href="/admin" className="sb-link">
                <span className="sb-label">Manage Staff Accounts</span>
                <span style={{ fontSize: "0.6rem", background: "var(--green)", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>ADMIN</span>
              </Link>
            )}
            <Link href="/data-point/scenario" className="sb-link">
              <span className="sb-label">Scenario Studio</span>
              <span style={{ fontSize: "0.6rem", background: "#1B2A4A", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>NECAL</span>
            </Link>
            <Link href="/data-point/pena" className="sb-link">
              <span className="sb-label">Energy Assessments</span>
              <span style={{ fontSize: "0.6rem", background: "var(--green)", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>PENA</span>
            </Link>
            <Link href="/" className="sb-link"><span className="sb-label">Public Data Bank</span></Link>
            <button className="sb-link" onClick={logout} style={{ color: "rgba(192,57,43,0.8)" }}><span className="sb-label">Sign Out</span></button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="dash-main">
        <div className="dash-topbar">
          <button className="mob-sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{viewLabel}</span>
            <span style={{ marginLeft: 12, fontSize: "0.72rem", color: "var(--ink-4)", display: "inline" }} className="topbar-subtitle">NEDB &nbsp;·&nbsp; ECN</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.72rem", color: profile.color, fontWeight: 600, background: `${profile.color}12`, padding: "2px 8px", borderRadius: 4, border: `1px solid ${profile.color}30` }} className="topbar-subtitle">{profile.label}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--ink-4)" }}>{staffName}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--ink-3)" }}>{clock}</span>
            <span className="tag tag-green"><span className="live-dot" />Live</span>
          </div>
        </div>

        <div className="dash-content">
          {/* Profile hero */}
          <div style={{ background: `linear-gradient(135deg, ${profile.color}08 0%, ${profile.color}03 100%)`, border: `1px solid ${profile.color}20`, borderRadius: "var(--r-lg)", padding: "1.25rem 1.5rem", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, color: profile.color, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>{profile.label}</div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem", fontWeight: 400, color: "var(--ink)", lineHeight: 1.2, marginBottom: "0.3rem" }}>{profile.roleTitle}</h2>
              <p style={{ fontSize: "0.78rem", color: "var(--ink-4)", lineHeight: 1.5, maxWidth: 540 }}>{profile.persona}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Welcome back</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>{staffName}</div>
            </div>
          </div>

          {/* KPI strip — computed live from dashData */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden", marginBottom: "1.5rem" }}>
            {profile.kpis.map((def) => { const m = computeKPI(def, dashData); return (
              <div key={m.label} className="metric-card" style={{ border: "none", borderRadius: 0 }}>
                <div className="mc-label">{m.label}</div>
                <div className="mc-value">{m.value}{m.unit && m.value !== "—" && <span style={{ fontSize: "0.75rem", color: "var(--ink-4)", fontFamily: "var(--font-sans)", marginLeft: 4 }}>{m.unit}</span>}</div>
                <div className={`mc-trend ${m.up ? "up" : "down"}`} style={{ color: m.value === "—" ? "var(--ink-5)" : undefined }}>
                  {m.value === "—" ? "Upload data to populate" : <>{m.change && (m.up ? "+" : "−")}{m.change}{m.period && <span style={{ fontWeight: 400, color: "var(--ink-5)" }}> · {m.period}</span>}</>}
                </div>
              </div>
            ); })}
          </div>

          {/* ── OVERVIEW ── */}
          {view === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <PeriodNav year={selectedYear} setYear={setSelectedYear} availYears={availYears} loading={dataLoading} />
              <PenaPanel />
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.25rem" }}>
                {s("crude_oil_production").length ? <SectorChart title="Crude Oil Production" subtitle={`Monthly volumes · ${selectedYear}`} source="NUPRC" data={s("crude_oil_production")} series={[{ key: "value", label: "Production", color: profile.color }]} unit="M Barrels" filename="crude-oil-production" /> : <EmptyChart seriesName="Crude Oil Production" />}
                <div className="panel">
                  {(() => { const liveAlerts = computeAnomalies(dashData); const highCount = liveAlerts.filter((a) => a.level === "high").length; return (<>
                  <div className="panel-header">
                    <span className="panel-title">Anomaly Feed</span>
                    {liveAlerts.length > 0 && <span className="tag tag-red" style={{ fontSize: "0.6rem" }}>{highCount} High</span>}
                  </div>
                  <div className="panel-body" style={{ padding: "0 1.25rem" }}>
                    {liveAlerts.length ? liveAlerts.map((a, i) => (
                      <div key={i} className="alert-row">
                        <span className={`alert-dot ${a.level}`} />
                        <div className="alert-body">{a.msg}<div className="alert-time">{a.time}</div></div>
                      </div>
                    )) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.4rem", padding: "1.5rem 0", color: "var(--ink-5)" }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-4)" }}>No anomalies detected</div>
                        <div style={{ fontSize: "0.7rem", textAlign: "center", lineHeight: 1.4 }}>Upload energy records to enable live anomaly monitoring.</div>
                      </div>
                    )}
                  </div>
                  </>)})()}
                </div>
              </div>
              <NigeriaMap stateData={stateMap["electricity_generation"] ?? {}} id="electricity-access" title="Electricity Generation by State" unit="GWh" colorLow="#FEF3C7" colorHigh="#0E7A3C" higherIsBetter={true} source="NERC / ECN" />
              {(s("pms_sales").length || s("ago_sales").length || s("lpg_sales").length) ? <SectorChart title="Downstream Products — Multi-series" subtitle={`PMS · AGO · LPG monthly volumes · ${selectedYear}`} source="NMDPRA / NNPCL" data={mergeSeries([{ data: s("pms_sales"), key: "pms" }, { data: s("ago_sales"), key: "ago" }, { data: s("lpg_sales"), key: "lpg" }])} series={[{ key: "pms", label: "PMS", color: "#0E7A3C" }, { key: "ago", label: "AGO", color: "#1D4ED8" }, { key: "lpg", label: "LPG", color: "#B45309" }]} unit="M Litres" filename="downstream-products" /> : <EmptyChart seriesName="Downstream Products" />}
              <div>
                <div className="sec-hd" style={{ marginBottom: "1rem" }}>
                  <h2>Fiscal Intelligence Panels</h2>
                  <span className="sec-hd-meta">Data integration in progress</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1.25rem" }}>
                  {FISCAL_PANELS.map((panel) => (
                    <div key={panel.id} className="cs-panel">
                      <div className="cs-ghost">{[70,40,55,30,60,45,80,35,50].map((w, i) => <div key={i} className="cs-ghost-bar" style={{ width: `${w}%` }} />)}</div>
                      <div className="cs-overlay">
                        <div className="cs-agencies">{panel.agencies.map((ag) => <span key={ag} className="cs-agency-tag" style={{ background: `${panel.color}18`, color: panel.color, border: `1px solid ${panel.color}30` }}>{ag}</span>)}</div>
                        <h4>{panel.title}</h4><p>{panel.caption}</p>
                        <span className="tag tag-amber" style={{ marginTop: "0.25rem" }}>Coming Soon</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── DOWNSTREAM ── */}
          {view === "downstream" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <PeriodNav year={selectedYear} setYear={setSelectedYear} availYears={availYears} loading={dataLoading} />
              {(s("pms_sales").length || s("ago_sales").length || s("lpg_sales").length) ? <SectorChart title="Downstream Products — Monthly Trend" subtitle={`PMS · AGO · LPG volumes · ${selectedYear}`} source="NMDPRA / NNPCL" data={mergeSeries([{ data: s("pms_sales"), key: "pms" }, { data: s("ago_sales"), key: "ago" }, { data: s("lpg_sales"), key: "lpg" }])} series={[{ key: "pms", label: "PMS (M L)", color: "#0E7A3C" }, { key: "ago", label: "AGO (M L)", color: "#1D4ED8" }, { key: "lpg", label: "LPG (MT)", color: "#B45309" }]} unit="" filename="downstream-products" /> : <EmptyChart seriesName="Downstream Products" />}
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Distribution Companies — ATC&amp;C Performance</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>Awaiting NERC data submission</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2.5rem 1rem", gap: "0.5rem", color: "var(--ink-5)" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25 }}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-4)" }}>No DisCo performance data yet</div>
                  <div style={{ fontSize: "0.72rem", textAlign: "center", maxWidth: 380, lineHeight: 1.5 }}>ATC&amp;C loss and collection efficiency records will appear here once submitted by NERC or uploaded via Admin → Data Entry.</div>
                </div>
              </div>
            </div>
          )}

          {/* ── UPSTREAM ── */}
          {view === "upstream" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <PeriodNav year={selectedYear} setYear={setSelectedYear} availYears={availYears} loading={dataLoading} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                {s("crude_oil_production").length ? <SectorChart title="Crude Oil Production" subtitle={`Monthly barrels · ${selectedYear}`} source="NUPRC" data={s("crude_oil_production")} series={[{ key: "value", label: "Production", color: "#78350F" }]} unit="M Barrels" filename="crude-oil-production" /> : <EmptyChart seriesName="Crude Oil Production" />}
                {s("natural_gas_production").length ? <SectorChart title="Natural Gas Production" subtitle={`Monthly volumes · ${selectedYear}`} source="NUPRC / NNPCL" data={s("natural_gas_production")} series={[{ key: "value", label: "Gas", color: "#0E7A3C" }]} unit="Bcf" filename="natural-gas-production" /> : <EmptyChart seriesName="Natural Gas Production" />}
              </div>
              <NigeriaMap stateData={stateMap["crude_oil_production"] ?? {}} id="crude-production" title="Crude Oil Production by State" unit="M Barrels" colorLow="#FEF3C7" colorHigh="#78350F" higherIsBetter={true} source="NUPRC" />
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">OML Block Performance Summary</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>Awaiting NUPRC data submission</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2.5rem 1rem", gap: "0.5rem", color: "var(--ink-5)" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25 }}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-4)" }}>No OML block data yet</div>
                  <div style={{ fontSize: "0.72rem", textAlign: "center", maxWidth: 380, lineHeight: 1.5 }}>Block-level production and royalty records will appear here once NUPRC data is submitted or uploaded via Admin → Data Entry.</div>
                </div>
              </div>
            </div>
          )}

          {/* ── POWER ── */}
          {view === "power" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <PeriodNav year={selectedYear} setYear={setSelectedYear} availYears={availYears} loading={dataLoading} />
              {(s("electricity_generation").length || s("electricity_sent_out").length) ? <SectorChart title="Electricity Generation vs. Sent Out" subtitle={`Monthly GWh · ${selectedYear}`} source="NERC / TCN" data={mergeSeries([{ data: s("electricity_generation"), key: "generation" }, { data: s("electricity_sent_out"), key: "sent_out" }])} series={[{ key: "generation", label: "Generation (GWh)", color: "#1D4ED8" }, { key: "sent_out", label: "Sent Out (GWh)", color: "#0E7A3C" }]} unit="GWh" filename="electricity-generation" /> : <EmptyChart seriesName="Electricity Generation" />}
              <NigeriaMap stateData={stateMap["electricity_sent_out"] ?? {}} id="atc-loss" title="Electricity Sent Out by State" unit="GWh" colorLow="#DCFCE7" colorHigh="#1D4ED8" higherIsBetter={true} source="TCN / NERC" />
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Distribution Companies — ATC&amp;C Performance</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>Awaiting NERC data submission</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2.5rem 1rem", gap: "0.5rem", color: "var(--ink-5)" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25 }}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-4)" }}>No DisCo performance data yet</div>
                  <div style={{ fontSize: "0.72rem", textAlign: "center", maxWidth: 380, lineHeight: 1.5 }}>ATC&amp;C loss and collection efficiency records will appear here once submitted by NERC or uploaded via Admin → Data Entry.</div>
                </div>
              </div>
            </div>
          )}

          {/* ── RENEWABLE ── */}
          {view === "renewable" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <PeriodNav year={selectedYear} setYear={setSelectedYear} availYears={availYears} loading={dataLoading} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                {s("renewable_energy").length ? <SectorChart title="Renewable Energy Capacity" subtitle={`Quarterly installed MW · ${selectedYear}`} source="REA / NERC" data={s("renewable_energy")} series={[{ key: "value", label: "Capacity (MW)", color: "#059669" }]} unit="MW" filename="renewable-capacity" /> : <EmptyChart seriesName="Renewable Energy" />}
                {s("fuelwood_consumption").length ? <SectorChart title="Fuelwood Consumption" subtitle={`Quarterly volumes · ${selectedYear}`} source="ECN / NBS" data={s("fuelwood_consumption")} series={[{ key: "value", label: "Fuelwood (M m³)", color: "#78350F" }]} unit="M m³" filename="fuelwood-consumption" /> : <EmptyChart seriesName="Fuelwood Consumption" />}
              </div>
              <NigeriaMap stateData={stateMap["renewable_energy"] ?? {}} id="renewable-capacity" title="Renewable Energy Capacity by State" unit="MW" colorLow="#D1FAE5" colorHigh="#065F46" higherIsBetter={true} source="REA / ECN" />
              <div className="panel" style={{ padding: "1.25rem 1.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
                  {([
                    { label: "Renewable Capacity",   series: "renewable_energy",     unit: "MW" },
                    { label: "LPG Sales",            series: "lpg_sales",            unit: "MT" },
                    { label: "Fuelwood Consumption", series: "fuelwood_consumption", unit: "M m³", higherIsBetter: false },
                  ] as KPIDef[]).map((def) => { const m = computeKPI(def, dashData); return (
                    <div key={m.label}>
                      <div className="kpi-label">{m.label}</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                        {m.value} {m.value !== "—" && <span style={{ fontSize: "0.75rem", color: "var(--ink-4)", fontFamily: "var(--font-sans)" }}>{m.unit}</span>}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: m.value === "—" ? "var(--ink-5)" : m.up ? "var(--green)" : "var(--red)", fontWeight: 600, marginTop: 2 }}>
                        {m.value === "—" ? "Upload data to populate" : `${m.change ? (m.up ? "+" : "−") + m.change : ""} · ${m.period}`}
                      </div>
                    </div>
                  );})}
                </div>
              </div>
            </div>
          )}

          {/* ── REVENUE ── */}
          {view === "revenue" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <PeriodNav year={selectedYear} setYear={setSelectedYear} availYears={availYears} loading={dataLoading} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                {s("faac_oil_revenue").length ? <SectorChart title="Oil Revenue — FAAC Contribution" subtitle={`Quarterly ₦B · ${selectedYear}`} source="RMAFC / CBN" data={s("faac_oil_revenue")} series={[{ key: "value", label: "FAAC Oil Revenue (₦B)", color: "#7C3AED" }]} unit="₦B" filename="faac-oil-revenue" /> : <EmptyChart seriesName="FAAC Oil Revenue" />}
                {s("upstream_royalties").length ? <SectorChart title="Upstream Royalties Collected" subtitle={`Quarterly ₦B · ${selectedYear}`} source="NUPRC / FIRS" data={s("upstream_royalties")} series={[{ key: "value", label: "Royalties (₦B)", color: "#9F1239" }]} unit="₦B" filename="upstream-royalties" /> : <EmptyChart seriesName="Upstream Royalties" />}
              </div>
              <div style={{ padding: "0.875rem 1rem", background: "var(--amber-tint)", border: "1px solid rgba(180,83,0.2)", borderRadius: "var(--r-md)", fontSize: "0.82rem", color: "var(--amber)" }}>
                Revenue Portal under active development. Producing companies registry is live. Financial flow data will be published upon completion of agency data agreements.
              </div>
              <RevenueRegistryTable />
            </div>
          )}

          {/* ── CUSTOM TABS (admin-composed via Dashboard Builder) ── */}
          {activeCustom && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <PeriodNav year={selectedYear} setYear={setSelectedYear} availYears={availYears} loading={dataLoading} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.25rem", alignItems: "start" }}>
                {activeCustom.widgets.map((w, i) => (
                  <DashboardWidget key={i} widget={{ kind: w.kind, title: w.title, config: w.config }} dashData={dashData} stateMap={stateMap} year={selectedYear} />
                ))}
              </div>
            </div>
          )}

          {/* ── ENERGY BRIEF (Presidency / Reporting profiles) ── */}
          {view === "brief" && (
            <PresidencyBrief staffName={staffName} profileLabel={profile.label} roleTitle={profile.roleTitle} kpis={profile.kpis.map((d) => computeKPI(d, dashData))} alerts={computeAnomalies(dashData)} selectedYear={selectedYear} setSelectedYear={setSelectedYear} availYears={availYears} dataLoading={dataLoading} dashData={dashData} />
          )}

        </div>
      </div>

      <ApexAI
        currentView={view}
        profileLabel={profile.label}
        screenContext={`Data Point dashboard — ${profile.label}. Section: ${viewLabel}. Year: ${selectedYear}. Visible KPIs: ${profile.kpis.map((d) => { const m = computeKPI(d, dashData); return `${m.label}: ${m.value}${m.unit && m.value !== "—" ? " " + m.unit : ""}${m.change ? ` (${m.up ? "+" : "-"}${m.change} vs prev, ${m.period})` : ""}`; }).join("; ")}`}
      />
    </div>
  );
}

// ── Presidency Energy Brief ────────────────────────────────────

function PresidencyBrief({ staffName, profileLabel, roleTitle, kpis, alerts, selectedYear, setSelectedYear, availYears, dataLoading, dashData }: {
  staffName: string; profileLabel: string; roleTitle: string;
  kpis: KPI[]; alerts: Alert[]; selectedYear: number; setSelectedYear: (y: number) => void;
  availYears: number[]; dataLoading: boolean; dashData: DashData;
}) {
  const [classification, setClassification] = useState("FOR OFFICIAL USE ONLY");
  const briefDate = new Date().toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });

  function printBrief() {
    window.print();
  }

  const STAT_DEFS: { section: string; items: KPIDef[] }[] = [
    { section: "Petroleum Sector",      items: [
      { label: "Crude Oil Production",   series: "crude_oil_production",   unit: "M Barrels" },
      { label: "Natural Gas Produced",   series: "natural_gas_production", unit: "Bcf" },
      { label: "PMS National Sales",     series: "pms_sales",              unit: "M Litres" },
      { label: "AGO (Diesel) Sales",     series: "ago_sales",              unit: "M Litres" },
    ]},
    { section: "Electricity Sector",    items: [
      { label: "Electricity Generation", series: "electricity_generation", unit: "GWh" },
      { label: "Electricity Sent Out",   series: "electricity_sent_out",   unit: "GWh" },
      { label: "Electricity Consumed",   series: "electricity_consumption",unit: "GWh" },
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
    ]},
    { section: "Revenue & Fiscal",      items: [
      { label: "FAAC Oil Revenue",       series: "faac_oil_revenue",       unit: "₦ Billion" },
      { label: "Upstream Royalties",     series: "upstream_royalties",     unit: "₦ Billion" },
      { label: "LPG Sales",              series: "lpg_sales",              unit: "MT" },
      { label: "Kerosene Sales",         series: "kerosine_sales",         unit: "M Litres" },
    ]},
    { section: "Clean Energy & Biomass",items: [
      { label: "Renewable Capacity",     series: "renewable_energy",       unit: "MW" },
      { label: "LPG Sales",              series: "lpg_sales",              unit: "MT" },
      { label: "Fuelwood Consumption",   series: "fuelwood_consumption",   unit: "M m³", higherIsBetter: false },
      { label: "Natural Gas Produced",   series: "natural_gas_production", unit: "Bcf" },
    ]},
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Controls toolbar — screen only */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem", background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
        <div style={{ flex: 1, fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)" }}>Energy Brief — Print-Ready Report</div>
        <PeriodNav year={selectedYear} setYear={setSelectedYear} availYears={availYears} loading={dataLoading} />
        <select value={classification} onChange={(e) => setClassification(e.target.value)} style={{ padding: "4px 8px", fontSize: "0.72rem", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", color: "var(--ink)", cursor: "pointer" }}>
          <option>FOR OFFICIAL USE ONLY</option>
          <option>CONFIDENTIAL</option>
          <option>RESTRICTED</option>
          <option>UNCLASSIFIED</option>
        </select>
        <button onClick={printBrief} style={{ padding: "6px 16px", fontSize: "0.78rem", fontWeight: 700, background: "var(--ink)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print / Save PDF
        </button>
      </div>

      {/* The printable brief */}
      <div id="energy-brief" style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: "#1B2A4A", color: "#fff", padding: "2rem 2.5rem" }} className="brief-header">
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1.5rem", marginBottom: "1.5rem" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.5rem" }}>🇳🇬</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: "0.25rem" }}>Federal Republic of Nigeria</div>
              <div style={{ fontSize: "1.4rem", fontFamily: "var(--font-serif)", fontWeight: 400, lineHeight: 1.2, color: "#fff", marginBottom: "0.25rem" }}>National Energy Data Bank</div>
              <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)" }}>Energy Commission of Nigeria — Intelligence Directorate</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.4)", marginBottom: "0.25rem" }}>CLASSIFICATION</div>
              <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#FFD700", letterSpacing: "0.06em" }}>{classification}</div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#fff" }}>{roleTitle}</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: "0.2rem" }}>Reporting Period: {selectedYear} &nbsp;·&nbsp; Prepared for: {staffName} ({profileLabel})</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)" }}>Date Issued</div>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#fff" }}>{briefDate}</div>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div style={{ padding: "1.5rem 2.5rem", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>Executive Summary</div>
          {kpis.some((k) => k.value !== "—") ? (
            <p style={{ fontSize: "0.85rem", color: "var(--ink)", lineHeight: 1.7, maxWidth: 780 }}>
              Nigeria energy sector intelligence brief for {selectedYear}.{" "}
              {kpis.filter((k) => k.value !== "—").map((k) => `${k.label}: ${k.value} ${k.unit}${k.change ? ` (${k.up ? "+" : "−"}${k.change})` : ""}`).join("; ")}.{" "}
              {alerts.length > 0 ? `${alerts.filter((a) => a.level === "high").length} high-priority anomalies detected from committed data.` : "No anomalies detected in committed data."}
            </p>
          ) : (
            <p style={{ fontSize: "0.85rem", color: "var(--ink-5)", lineHeight: 1.7, maxWidth: 780, fontStyle: "italic" }}>
              Executive summary will populate automatically once energy records are uploaded for {selectedYear}. Use Admin → Data Entry to commit data.
            </p>
          )}
        </div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderBottom: "1px solid var(--border)" }}>
          {kpis.map((m) => (
            <div key={m.label} style={{ padding: "1.25rem", borderRight: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.62rem", color: "var(--ink-5)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>{m.label}</div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>{m.value}</div>
              {m.unit && <div style={{ fontSize: "0.68rem", color: "var(--ink-4)", marginTop: 2 }}>{m.unit}</div>}
              <div style={{ fontSize: "0.72rem", fontWeight: 600, color: m.up ? "var(--green)" : "var(--red)", marginTop: 4 }}>{m.change} &nbsp;<span style={{ fontWeight: 400, color: "var(--ink-5)" }}>{m.period}</span></div>
            </div>
          ))}
        </div>

        {/* Sector-by-sector stats — computed from live data */}
        <div style={{ padding: "1.5rem 2.5rem" }}>
          {STAT_DEFS.map((sec) => (
            <div key={sec.section} style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#1B2A4A", textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "2px solid #1B2A4A", paddingBottom: "0.4rem", marginBottom: "0.875rem" }}>{sec.section}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {sec.items.map((def) => { const m = computeKPI(def, dashData); const hasVal = m.value !== "—"; return (
                  <div key={def.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0.5rem 0.75rem", background: hasVal && !m.up ? "rgba(192,57,43,0.04)" : "var(--surface)", borderRadius: 4, border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--ink-4)" }}>{def.label}</span>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "1rem" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: hasVal ? "var(--ink)" : "var(--ink-5)", fontFamily: "var(--font-mono)" }}>{m.value}{hasVal ? ` ${def.unit}` : ""}</div>
                      <div style={{ fontSize: "0.65rem", color: !hasVal ? "var(--ink-5)" : m.up ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                        {!hasVal ? "No data" : m.change ? `${m.up ? "+" : "−"}${m.change} · ${m.period}` : m.period}
                      </div>
                    </div>
                  </div>
                );})}
              </div>
            </div>
          ))}
        </div>

        {/* Alerts / Advisories */}
        <div style={{ padding: "0 2.5rem 1.5rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#9F1239", textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "2px solid #9F1239", paddingBottom: "0.4rem", marginBottom: "0.875rem" }}>Priority Advisories</div>
          {alerts.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "baseline", padding: "0.5rem 0", borderBottom: i < alerts.length - 1 ? "1px solid var(--border)" : "none" }}>
              <span style={{ fontSize: "0.65rem", fontWeight: 700, minWidth: 60, color: a.level === "high" ? "#9F1239" : a.level === "medium" ? "#B45309" : "var(--ink-4)", textTransform: "uppercase" }}>{a.level}</span>
              <span style={{ fontSize: "0.78rem", color: "var(--ink)", flex: 1 }}>{a.msg}</span>
              <span style={{ fontSize: "0.65rem", color: "var(--ink-5)", flexShrink: 0 }}>{a.time}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "1rem 2.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "0.65rem", color: "var(--ink-5)" }}>NEDB · Energy Commission of Nigeria · This document is classified <strong>{classification}</strong> and is intended solely for the named recipient.</div>
          <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>NEDB-{selectedYear}-{Math.floor(Math.random() * 9000 + 1000)}</div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .dash-sidebar, .dash-topbar, .dash-sidebar-backdrop { display: none !important; }
          .dash-main { margin: 0 !important; }
          .dash-content { padding: 0 !important; }
          #energy-brief { border: none !important; border-radius: 0 !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function RevenueRegistryTable() {
  const [companies, setCompanies] = useState<{ id: number; company: string; oml_blocks: string | null; operator_type: string; sector: string; status: string }[]>([]);
  const load = useCallback(() => { fetch("/api/registry").then((r) => r.json()).then(setCompanies).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Producing Companies Registry</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>{companies.length} companies</span>
          <button onClick={() => downloadTableCSV("producing-companies", ["Company","OML Blocks","Operator Type","Sector","Status"], companies.map((c) => [c.company, c.oml_blocks ?? "", c.operator_type, c.sector, c.status]))} style={{ padding: "3px 10px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid var(--green-line)", borderRadius: 4, background: "var(--green-strong)", color: "var(--green-deep)", cursor: "pointer" }}>↓ CSV</button>
        </div>
      </div>
      <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
        <table className="data-table">
          <thead><tr><th>Company</th><th>OML Block(s)</th><th>Operator Type</th><th>Sector</th><th>Status</th></tr></thead>
          <tbody>{companies.map((row) => (
            <tr key={row.id}>
              <td className="td-primary">{row.company}</td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{row.oml_blocks ?? "—"}</td>
              <td>{row.operator_type}</td>
              <td><span className="tag tag-green" style={{ fontSize: "0.62rem" }}>{row.sector}</span></td>
              <td><span className="live-dot" style={{ marginRight: 6 }} />{row.status}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
