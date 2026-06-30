"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearTokens, isLoggedIn, getFullName, getRole, getDashboardProfile } from "@/lib/auth";
import dynamic from "next/dynamic";
import CoatOfArms from "@/components/layout/CoatOfArms";

const SectorChart = dynamic(() => import("@/components/datapoint/SectorChart"), { ssr: false });
const NigeriaMap  = dynamic(() => import("@/components/datapoint/NigeriaMap"),  { ssr: false });
const ApexAI      = dynamic(() => import("@/components/datapoint/ApexAI"),      { ssr: false });

// ── Mock time-series data generator ───────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const QUARTERS = ["Q1","Q2","Q3","Q4"];

function mkMonthly(base: number, trend: number, noise: number, year: number) {
  return MONTHS.map((m, i) => ({
    period: `${m} ${year}`,
    value: Math.round(base + trend * i + (Math.random() - 0.5) * noise),
  }));
}
function mkQuarterly(values: number[], year: number) {
  return QUARTERS.map((q, i) => ({ period: `${q} ${year}`, value: values[i] }));
}
function mkMulti(keys: string[], base: number[], trend: number[], noise: number, year: number) {
  return MONTHS.map((m, i) => ({
    period: `${m} ${year}`,
    ...Object.fromEntries(keys.map((k, j) => [k, Math.round(base[j] + trend[j] * i + (Math.random() - 0.5) * noise)])),
  }));
}

const YEARS = [2020, 2021, 2022, 2023, 2024];

function buildData(year: number) {
  const offset = year - 2020;
  return {
    crude:        mkMonthly(72 + offset * 2.8, 0.9, 4, year),
    pms:          mkMonthly(1680 + offset * 28, 1.4, 30, year),
    ago:          mkMonthly(540 + offset * 18, 1.1, 20, year),
    lpg:          mkMonthly(160 + offset * 12, 0.9, 10, year),
    generation:   mkMonthly(2800 + offset * 90, 2.2, 60, year),
    sentOut:      mkMonthly(2490 + offset * 82, 2.0, 55, year),
    renewable:    mkQuarterly([1480 + offset*90, 1550+offset*95, 1640+offset*100, 1720+offset*110], year),
    gas:          mkMonthly(148 + offset * 10, 1.1, 8, year),
    fuelwood:     mkQuarterly([18200-offset*120, 17900-offset*130, 17600-offset*140, 17200-offset*150], year),
    downstream:   mkMulti(["pms","ago","lpg"], [1680+offset*28, 540+offset*18, 160+offset*12], [1.4,1.1,0.9], 20, year),
    faac:         mkQuarterly([640+offset*42, 680+offset*45, 720+offset*48, 760+offset*50], year),
    royalties:    mkQuarterly([88+offset*8, 92+offset*9, 96+offset*9, 102+offset*10], year),
  };
}

// ── Profile definitions ────────────────────────────────────────
interface ProfileDef {
  label: string; roleTitle: string; color: string; accent: string;
  persona: string; defaultView: string; navOrder: string[];
  kpis:   { label: string; value: string; unit: string; change: string; up: boolean; period: string }[];
  alerts: { level: string; msg: string; time: string }[];
}

const ALL_NAV = ["overview","downstream","upstream","midstream","power","renewable","bioenergy","revenue","faac"];

const PROFILE_MAP: Record<string, ProfileDef> = {
  presidency: {
    label: "State House — Presidency", roleTitle: "National Energy Security Intelligence Brief",
    color: "#1B2A4A", accent: "rgba(27,42,74,0.06)",
    persona: "Strategic energy intelligence for the Presidency. Cross-sector overview covering national energy security, production benchmarks and fiscal performance.",
    defaultView: "overview", navOrder: ALL_NAV,
    kpis: [
      { label: "Crude Oil Production",    value: "85.1M", unit: "Barrels",  change: "+13.3%", up: true,  period: "Dec 2024" },
      { label: "Energy Access Rate",      value: "57.4%", unit: "Pop.",     change: "+2.1pp", up: true,  period: "2024" },
      { label: "Oil Revenue (FAAC)",      value: "₦2.8T", unit: "",         change: "+9.3%",  up: true,  period: "Q4 2024" },
      { label: "Electricity Generation",  value: "3,241", unit: "GWh",      change: "+4.1%",  up: true,  period: "Q4 2024" },
    ],
    alerts: [
      { level: "high",   msg: "National crude production still 18% below OPEC+ quota.", time: "Today" },
      { level: "high",   msg: "Power sector market shortfall at ₦4.1T — investor risk.", time: "2 days ago" },
      { level: "medium", msg: "LPG penetration at 18.4% — below 25% Decade of Gas target.", time: "3 days ago" },
      { level: "low",    msg: "Renewable energy capacity grew 18.4% YoY.", time: "1 week ago" },
    ],
  },
  ecn: {
    label: "ECN — Energy Commission of Nigeria", roleTitle: "ECN National Energy Policy Intelligence",
    color: "#0E7A3C", accent: "rgba(14,122,60,0.06)",
    persona: "All-sector energy intelligence for ECN leadership. Policy monitoring across petroleum, electricity, gas, renewables and biomass sectors.",
    defaultView: "overview", navOrder: ALL_NAV,
    kpis: [
      { label: "National Energy Mix",   value: "57.4%", unit: "Fossil",  change: "-2.3pp", up: true,  period: "2024" },
      { label: "Renewable Capacity",    value: "2,014", unit: "MW",      change: "+18.4%", up: true,  period: "2024" },
      { label: "Natural Gas Produced",  value: "196.4", unit: "Bcf",     change: "+7.8%",  up: true,  period: "Q4 2024" },
      { label: "Fuelwood Consumption",  value: "71.2M", unit: "m³",      change: "-3.1%",  up: true,  period: "2024" },
    ],
    alerts: [
      { level: "medium", msg: "Energy efficiency target for 2025 at risk — Q3 consumption up 4%.", time: "3 days ago" },
      { level: "medium", msg: "Renewable data for Q4 not yet submitted by 4 state agencies.", time: "4 days ago" },
      { level: "low",    msg: "Gas flaring down 6% YoY — improving utilisation.", time: "1 week ago" },
      { level: "low",    msg: "Biomass reconciliation pending for 7 northern states.", time: "1 week ago" },
    ],
  },
  nerc: {
    label: "NERC — Electricity Regulatory Commission", roleTitle: "NERC Electricity Market Regulatory Dashboard",
    color: "#1D4ED8", accent: "rgba(29,78,216,0.05)",
    persona: "Regulatory intelligence for NERC. DisCo compliance, market settlement, tariff performance and grid reliability monitoring.",
    defaultView: "downstream", navOrder: ["downstream","power","midstream","overview","upstream","renewable","bioenergy","faac","revenue"],
    kpis: [
      { label: "Avg ATC&C Loss",       value: "46.2%",  unit: "",   change: "-1.8pp", up: true,  period: "Q4 2024" },
      { label: "Collection Efficiency",value: "73.5%",  unit: "",   change: "+2.1pp", up: true,  period: "Q4 2024" },
      { label: "Market Shortfall",     value: "₦4.1T",  unit: "",   change: "Cumul.", up: false, period: "FY 2024" },
      { label: "Installed Capacity",   value: "12,522", unit: "MW", change: "+3.2%",  up: true,  period: "Q4 2024" },
    ],
    alerts: [
      { level: "high",   msg: "Abuja DisCo ATC&C exceeded 40% threshold — 3rd consecutive month.", time: "2 hours ago" },
      { level: "high",   msg: "Kano DisCo collection below 65% — regulatory trigger breached.", time: "1 day ago" },
      { level: "medium", msg: "NBET payment shortfall up ₦12B vs. previous month.", time: "4 days ago" },
      { level: "low",    msg: "3 DisCos yet to submit November generation data.", time: "2 days ago" },
    ],
  },
  nuprc: {
    label: "NUPRC — Upstream Petroleum Regulator", roleTitle: "NUPRC Upstream Petroleum Regulatory Dashboard",
    color: "#78350F", accent: "rgba(120,53,15,0.05)",
    persona: "Upstream regulatory intelligence for NUPRC. Crude oil production, OML block performance, licensing, royalty compliance and flare reduction monitoring.",
    defaultView: "upstream", navOrder: ["upstream","revenue","overview","downstream","midstream","faac","power","renewable","bioenergy"],
    kpis: [
      { label: "Crude Oil Production", value: "85.1M", unit: "Barrels", change: "+13.3%", up: true, period: "Dec 2024" },
      { label: "Gas Flared",           value: "1.84",  unit: "Bcf",     change: "-6.1%",  up: true, period: "Q4 2024" },
      { label: "Active OML Blocks",    value: "79",    unit: "",        change: "+3",      up: true, period: "2024" },
      { label: "Royalty Compliance",   value: "84.2%", unit: "",        change: "+5.1pp",  up: true, period: "Q4 2024" },
    ],
    alerts: [
      { level: "high",   msg: "OML 25 royalty remittance overdue 45 days — enforcement pending.", time: "Today" },
      { level: "medium", msg: "Production still 18% below OPEC+ quota.", time: "2 days ago" },
      { level: "medium", msg: "3 marginal field operators missed Q4 reporting deadline.", time: "3 days ago" },
      { level: "low",    msg: "Q4 crude lifting schedule: 3 cargoes deferred.", time: "5 days ago" },
    ],
  },
  nmdpra: {
    label: "NMDPRA — Midstream & Downstream Regulator", roleTitle: "NMDPRA Midstream & Downstream Regulatory Dashboard",
    color: "#0369A1", accent: "rgba(3,105,161,0.05)",
    persona: "Midstream and downstream regulatory intelligence. Refinery throughput, product distribution, pipeline performance and retail compliance.",
    defaultView: "downstream", navOrder: ["downstream","midstream","overview","upstream","revenue","power","renewable","bioenergy","faac"],
    kpis: [
      { label: "PMS Sales Volume",    value: "1.82B",  unit: "Litres",   change: "-2.3%",  up: false, period: "Q3 2024" },
      { label: "AGO (Diesel) Sales",  value: "624M",   unit: "Litres",   change: "+5.1%",  up: true,  period: "Q3 2024" },
      { label: "LPG Consumption",     value: "214K",   unit: "MT",       change: "+11.2%", up: true,  period: "Q3 2024" },
      { label: "Refinery Throughput", value: "38.4%",  unit: "Capacity", change: "+12pp",  up: true,  period: "Q4 2024" },
    ],
    alerts: [
      { level: "high",   msg: "PMS stock below 14-day buffer — supply stress risk.", time: "Yesterday" },
      { level: "medium", msg: "AGO price differential widening — arbitrage risk.", time: "4 days ago" },
      { level: "medium", msg: "4 depot operators non-compliant with Q4 stock reporting.", time: "3 days ago" },
      { level: "low",    msg: "Dangote Refinery at 38.4% nameplate capacity.", time: "1 week ago" },
    ],
  },
  nnpcl: {
    label: "NNPC Limited", roleTitle: "NNPC Limited Operational Intelligence Dashboard",
    color: "#065F46", accent: "rgba(6,95,70,0.05)",
    persona: "Operational and commercial intelligence for NNPC Limited. Production performance, equity crude, gas monetisation and downstream operations.",
    defaultView: "upstream", navOrder: ["upstream","downstream","midstream","revenue","overview","power","renewable","bioenergy","faac"],
    kpis: [
      { label: "Equity Crude Lifted",  value: "42.3M", unit: "Barrels", change: "+8.7%",  up: true, period: "Dec 2024" },
      { label: "Gas Monetised",        value: "114.2", unit: "Bcf",     change: "+12.1%", up: true, period: "Q4 2024" },
      { label: "Refinery Throughput",  value: "38.4%", unit: "Cap.",    change: "+12pp",  up: true, period: "Q4 2024" },
      { label: "Downstream Revenue",   value: "₦1.4T", unit: "",        change: "+18.3%", up: true, period: "Q4 2024" },
    ],
    alerts: [
      { level: "medium", msg: "JV cash calls shortfall — OML 21 production at risk.", time: "2 days ago" },
      { level: "medium", msg: "Gas flaring above threshold in OML 58 — TCO exposure.", time: "3 days ago" },
      { level: "low",    msg: "NLNG Train 7 FID timeline pushed to Q2 2025.", time: "5 days ago" },
      { level: "low",    msg: "Equity crude lifting plan Q1 2025 submitted to NUPRC.", time: "1 week ago" },
    ],
  },
  nemic: {
    label: "NEMIC — Energy Management & Infrastructure", roleTitle: "NEMIC National Energy Management Intelligence",
    color: "#4338CA", accent: "rgba(67,56,202,0.05)",
    persona: "Infrastructure and management intelligence. Energy infrastructure investment, grid capacity, emergency response and critical asset monitoring.",
    defaultView: "power", navOrder: ["power","midstream","renewable","overview","downstream","upstream","bioenergy","faac","revenue"],
    kpis: [
      { label: "Grid Installed Cap.",  value: "12,522", unit: "MW",    change: "+3.2%",  up: true,  period: "Q4 2024" },
      { label: "Transmission Cap.",    value: "7,801",  unit: "MW",    change: "+1.8%",  up: true,  period: "Q4 2024" },
      { label: "Critical Assets",      value: "14",     unit: "Flags", change: "+3",      up: false, period: "Q4 2024" },
      { label: "Infra. Investment",    value: "₦284B",  unit: "",      change: "+22.1%", up: true,  period: "2024" },
    ],
    alerts: [
      { level: "high",   msg: "Kaduna corridor lines at 94% utilisation — overload risk.", time: "6 hours ago" },
      { level: "high",   msg: "Afam IV maintenance overdue — reliability risk.", time: "1 day ago" },
      { level: "medium", msg: "Escravos–Lagos pipeline integrity inspection deferred to Q2 2025.", time: "3 days ago" },
      { level: "low",    msg: "Solar mini-grid rollout at 68% of REA 2024 target.", time: "1 week ago" },
    ],
  },
  nrs: {
    label: "NRS — Natural Resources Statistics", roleTitle: "NRS Natural Resources Statistical Dashboard",
    color: "#6B21A8", accent: "rgba(107,33,168,0.05)",
    persona: "Statistical intelligence for natural resources reporting. Production volumes, consumption trends, cross-sector comparisons and data quality monitoring.",
    defaultView: "overview", navOrder: ALL_NAV,
    kpis: [
      { label: "Series Tracked",      value: "12",    unit: "Active",     change: "",       up: true,  period: "2025" },
      { label: "Records in DB",       value: "4,820", unit: "Rows",       change: "+312",   up: true,  period: "This month" },
      { label: "Data Completeness",   value: "76.4%", unit: "",           change: "+4.1pp", up: true,  period: "Q4 2024" },
      { label: "Agencies Reporting",  value: "9",     unit: "of 12",      change: "",       up: false, period: "Q4 2024" },
    ],
    alerts: [
      { level: "medium", msg: "3 agencies yet to submit Q4 2024 data.", time: "2 days ago" },
      { level: "medium", msg: "Biomass methodology revision pending ECN sign-off.", time: "4 days ago" },
      { level: "low",    msg: "Crude CAGR updated following NUPRC Q4 reconciliation.", time: "3 days ago" },
      { level: "low",    msg: "NBS energy statistics annual report reconciliation scheduled.", time: "1 week ago" },
    ],
  },
  rea: {
    label: "REA — Rural Electrification Agency", roleTitle: "REA Rural Electrification & Off-Grid Dashboard",
    color: "#15803D", accent: "rgba(21,128,61,0.05)",
    persona: "Rural electrification and off-grid intelligence. Mini-grid rollout, solar penetration, off-grid connections and clean energy access by state.",
    defaultView: "renewable", navOrder: ["renewable","bioenergy","power","overview","downstream","upstream","midstream","faac","revenue"],
    kpis: [
      { label: "Off-Grid Connections", value: "2.4M",  unit: "Households", change: "+18.2%", up: true, period: "2024" },
      { label: "Mini-Grids Deployed",  value: "214",   unit: "Sites",      change: "+62",    up: true, period: "2024" },
      { label: "Renewable Capacity",   value: "2,014", unit: "MW",         change: "+18.4%", up: true, period: "2024" },
      { label: "LPG Penetration",      value: "18.4%", unit: "Households", change: "+2.1pp", up: true, period: "2024" },
    ],
    alerts: [
      { level: "medium", msg: "Mini-grid rollout at 68% of 2024 target — 66 sites behind.", time: "3 days ago" },
      { level: "medium", msg: "FiT obligations for wind projects missed Q3 deadline.", time: "1 week ago" },
      { level: "low",    msg: "NREEEP Phase 2 ahead of target in Katsina and Sokoto.", time: "5 days ago" },
      { level: "low",    msg: "World Bank off-grid funding tranche released.", time: "1 week ago" },
    ],
  },
  tcn: {
    label: "TCN — Transmission Company of Nigeria", roleTitle: "TCN Grid Transmission Intelligence Dashboard",
    color: "#B45309", accent: "rgba(180,83,9,0.05)",
    persona: "Transmission grid intelligence for TCN management. Grid capacity, wheeling capacity, system stability, constraint management and capital projects.",
    defaultView: "power", navOrder: ["power","midstream","downstream","overview","upstream","renewable","bioenergy","faac","revenue"],
    kpis: [
      { label: "System Sent Out",      value: "2,890",  unit: "GWh",    change: "+3.8%",  up: true, period: "Q4 2024" },
      { label: "Wheeling Capacity",    value: "7,801",  unit: "MW",     change: "+1.8%",  up: true, period: "Q4 2024" },
      { label: "Transmission Losses",  value: "8.4%",   unit: "",       change: "-0.6pp", up: true, period: "Q4 2024" },
      { label: "Freq. Excursions",     value: "4",      unit: "Events", change: "-2",     up: true, period: "This week" },
    ],
    alerts: [
      { level: "high",   msg: "Kaduna corridor at 94% utilisation — overload risk.", time: "6 hours ago" },
      { level: "high",   msg: "System frequency below 49.5 Hz on 4 occasions this week.", time: "1 day ago" },
      { level: "medium", msg: "330kV Benin–Onitsha maintenance — rerouting required.", time: "3 days ago" },
      { level: "low",    msg: "Ikeja West substation expansion 74% complete.", time: "5 days ago" },
    ],
  },
  firs: {
    label: "FIRS — Federal Inland Revenue Service", roleTitle: "FIRS Energy Sector Tax & Revenue Dashboard",
    color: "#9F1239", accent: "rgba(159,18,57,0.05)",
    persona: "Energy sector tax and revenue intelligence. Petroleum Profit Tax, royalties, CITA from energy companies and FAAC energy contribution tracking.",
    defaultView: "revenue", navOrder: ["revenue","faac","upstream","overview","downstream","midstream","power","renewable","bioenergy"],
    kpis: [
      { label: "PPT Collected",         value: "₦289B", unit: "", change: "+6.8%",  up: true, period: "Q4 2024" },
      { label: "Upstream Royalties",    value: "₦412B", unit: "", change: "+14.1%", up: true, period: "Q4 2024" },
      { label: "CITA (Energy)",         value: "₦74B",  unit: "", change: "+9.2%",  up: true, period: "Q4 2024" },
      { label: "Oil Revenue (FAAC)",    value: "₦2.8T", unit: "", change: "+9.3%",  up: true, period: "Q4 2024" },
    ],
    alerts: [
      { level: "high",   msg: "PPT audit for 2 IOC JVs — ₦38B in dispute.", time: "4 days ago" },
      { level: "medium", msg: "FAAC oil revenue 12% below Q4 budget projection.", time: "2 days ago" },
      { level: "medium", msg: "3 E&P companies yet to file Q4 PPT self-assessment.", time: "5 days ago" },
      { level: "low",    msg: "FIRS energy sector audit programme 2025 published.", time: "1 week ago" },
    ],
  },
  nbs: {
    label: "NBS — National Bureau of Statistics", roleTitle: "NBS Energy Sector Statistical Dashboard",
    color: "#0C4A6E", accent: "rgba(12,74,110,0.05)",
    persona: "Energy sector statistical intelligence for NBS. Cross-sector data validation, trend analysis and national accounts reconciliation.",
    defaultView: "overview", navOrder: ALL_NAV,
    kpis: [
      { label: "Crude Oil (GDP Wt.)", value: "5.4%",   unit: "of GDP", change: "+0.3pp", up: true,  period: "Q4 2024" },
      { label: "Energy Sector CPI",   value: "184.2",  unit: "Index",  change: "+12.4%", up: false, period: "Dec 2024" },
      { label: "Data Completeness",   value: "76.4%",  unit: "",       change: "+4.1pp", up: true,  period: "Q4 2024" },
      { label: "Natural Gas Prod.",   value: "196.4",  unit: "Bcf",    change: "+7.8%",  up: true,  period: "Q4 2024" },
    ],
    alerts: [
      { level: "medium", msg: "Q4 GDP energy contribution pending NUPRC reconciliation.", time: "3 days ago" },
      { level: "medium", msg: "Energy CPI sub-index +12.4% YoY — inflation signal.", time: "4 days ago" },
      { level: "low",    msg: "Energy statistics annual report 2023 for public consultation.", time: "5 days ago" },
      { level: "low",    msg: "Biomass methodology revision pending ECN sign-off.", time: "1 week ago" },
    ],
  },
  executive: {
    label: "Executive Overview", roleTitle: "National Energy Intelligence Dashboard",
    color: "#0E7A3C", accent: "rgba(14,122,60,0.06)",
    persona: "Cross-sector overview for executive leadership and national policy decision-makers.",
    defaultView: "overview", navOrder: ["overview","downstream","revenue","upstream","power","midstream","renewable","bioenergy","faac"],
    kpis: [
      { label: "Crude Oil Production",   value: "85.1M", unit: "Barrels", change: "+13.3%", up: true,  period: "Dec 2024" },
      { label: "Electricity Generation", value: "3,241", unit: "GWh",     change: "+4.1%",  up: true,  period: "Q4 2024" },
      { label: "PMS Sales Volume",       value: "1.82B", unit: "Litres",  change: "-2.3%",  up: false, period: "Q3 2024" },
      { label: "Natural Gas Produced",   value: "196.4", unit: "Bcf",     change: "+7.8%",  up: true,  period: "Q4 2024" },
    ],
    alerts: [
      { level: "high",   msg: "Abuja DisCo ATC&C loss exceeded 40% threshold for 3rd consecutive month.", time: "2 hours ago" },
      { level: "medium", msg: "Natural gas production shows 18% deviation from 3-month rolling average.", time: "6 hours ago" },
      { level: "medium", msg: "PMS national stock below 14-day buffer — potential supply stress.", time: "Yesterday" },
      { level: "low",    msg: "Crude oil production CAGR updated following NUPRC Q4 reconciliation.", time: "3 days ago" },
    ],
  },
  petroleum: {
    label: "Petroleum & Gas Analyst", roleTitle: "Petroleum & Upstream Intelligence Dashboard",
    color: "#92400E", accent: "rgba(146,64,14,0.05)",
    persona: "Upstream crude production, downstream product distribution and retail sales analytics.",
    defaultView: "downstream", navOrder: ["downstream","upstream","revenue","overview","midstream","power","renewable","bioenergy","faac"],
    kpis: [
      { label: "Crude Oil Production", value: "85.1M", unit: "Barrels", change: "+13.3%", up: true,  period: "Dec 2024" },
      { label: "PMS Sales Volume",     value: "1.82B", unit: "Litres",  change: "-2.3%",  up: false, period: "Q3 2024" },
      { label: "AGO (Diesel) Sales",   value: "624M",  unit: "Litres",  change: "+5.1%",  up: true,  period: "Q3 2024" },
      { label: "LPG Consumption",      value: "214K",  unit: "MT",      change: "+11.2%", up: true,  period: "Q3 2024" },
    ],
    alerts: [
      { level: "high",   msg: "PMS stock below 14-day buffer — supply stress.", time: "Yesterday" },
      { level: "medium", msg: "Crude CAGR updated following NUPRC Q4 reconciliation.", time: "3 days ago" },
      { level: "medium", msg: "AGO price differential widening — arbitrage risk.", time: "4 days ago" },
      { level: "low",    msg: "NNPCL Q4 crude lifting: 3 cargoes deferred.", time: "5 days ago" },
    ],
  },
  electricity: {
    label: "Power & Grid Analyst", roleTitle: "Power Sector Intelligence Dashboard",
    color: "#1D4ED8", accent: "rgba(29,78,216,0.05)",
    persona: "Generation capacity, grid transmission, distribution losses and market financial settlement.",
    defaultView: "power", navOrder: ["power","downstream","midstream","overview","upstream","renewable","bioenergy","faac","revenue"],
    kpis: [
      { label: "Electricity Generation", value: "3,241",  unit: "GWh", change: "+4.1%",  up: true,  period: "Q4 2024" },
      { label: "System Sent Out",        value: "2,890",  unit: "GWh", change: "+3.8%",  up: true,  period: "Q4 2024" },
      { label: "Avg ATC&C Loss",         value: "46.2%",  unit: "",    change: "-1.8pp", up: true,  period: "Q4 2024" },
      { label: "Market Shortfall",       value: "₦4.1T",  unit: "",    change: "Cumul.", up: false, period: "FY 2024" },
    ],
    alerts: [
      { level: "high",   msg: "Abuja DisCo ATC&C exceeded 40% — 3rd consecutive month.", time: "2 hours ago" },
      { level: "high",   msg: "Frequency dropped below 49.5 Hz on 4 occasions this week.", time: "1 day ago" },
      { level: "medium", msg: "November generation data not yet submitted by 3 DisCos.", time: "2 days ago" },
      { level: "low",    msg: "NBET shortfall up ₦12B vs. previous month.", time: "4 days ago" },
    ],
  },
  renewables: {
    label: "Clean Energy Analyst", roleTitle: "Renewables & Clean Energy Intelligence Dashboard",
    color: "#059669", accent: "rgba(5,150,105,0.05)",
    persona: "Renewable capacity, natural gas production, biomass and clean energy transition metrics.",
    defaultView: "renewable", navOrder: ["renewable","bioenergy","overview","power","upstream","downstream","midstream","faac","revenue"],
    kpis: [
      { label: "Natural Gas Produced",  value: "196.4", unit: "Bcf",        change: "+7.8%",  up: true, period: "Q4 2024" },
      { label: "Renewable Capacity",    value: "2,014", unit: "MW",          change: "+18.4%", up: true, period: "2024" },
      { label: "Fuelwood Consumption",  value: "71.2M", unit: "m³",          change: "-3.1%",  up: true, period: "2024" },
      { label: "LPG Penetration",       value: "18.4%", unit: "Households",  change: "+2.1pp", up: true, period: "2024" },
    ],
    alerts: [
      { level: "medium", msg: "Gas production shows 18% deviation from rolling average.", time: "6 hours ago" },
      { level: "medium", msg: "Off-grid solar certification pending for REA Q4 sites.", time: "3 days ago" },
      { level: "low",    msg: "Biomass reconciliation pending for 7 northern states.", time: "5 days ago" },
      { level: "low",    msg: "FiT payments for wind projects missed Q3 deadline.", time: "1 week ago" },
    ],
  },
  fiscal: {
    label: "Fiscal & Revenue Analyst", roleTitle: "Fiscal Revenue Intelligence Dashboard",
    color: "#7C3AED", accent: "rgba(124,58,237,0.05)",
    persona: "FAAC energy contribution, upstream revenue flows, royalty collections and producing company financial intelligence.",
    defaultView: "revenue", navOrder: ["revenue","faac","upstream","overview","downstream","midstream","power","renewable","bioenergy"],
    kpis: [
      { label: "Oil Revenue (FAAC)",  value: "₦2.8T", unit: "", change: "+9.3%",  up: true, period: "Q4 2024" },
      { label: "Upstream Royalties",  value: "₦412B", unit: "", change: "+14.1%", up: true, period: "Q4 2024" },
      { label: "PPT Collected",       value: "₦289B", unit: "", change: "+6.8%",  up: true, period: "Q4 2024" },
      { label: "Signature Bonuses",   value: "$340M",  unit: "", change: "FY 2024",up: true, period: "2024" },
    ],
    alerts: [
      { level: "high",   msg: "OML 25 royalty remittance overdue 45 days.", time: "Today" },
      { level: "medium", msg: "FAAC oil revenue 12% below Q4 budget projection.", time: "2 days ago" },
      { level: "medium", msg: "PPT audit for 2 IOC JVs — ₦38B in dispute.", time: "4 days ago" },
      { level: "low",    msg: "2024 marginal field signature bonus schedule published.", time: "1 week ago" },
    ],
  },

  // ── Investor profiles ──────────────────────────────────────────
  investor_fdi: {
    label: "FDI Intelligence", roleTitle: "Foreign Direct Investment Intelligence Dashboard",
    color: "#1B2A4A", accent: "rgba(27,42,74,0.06)",
    persona: "Investment-grade intelligence for international energy companies and sovereign wealth funds evaluating Nigeria upstream, midstream and power sector assets.",
    defaultView: "upstream", navOrder: ["upstream","revenue","overview","power","downstream","renewable","midstream","bioenergy","faac"],
    kpis: [
      { label: "Crude Production CAGR",   value: "+4.2%", unit: "5-yr",    change: "2020-2024", up: true,  period: "Annual" },
      { label: "Proved Reserves",         value: "36.9B", unit: "Barrels", change: "EIA 2024",  up: true,  period: "2024" },
      { label: "FDI in Energy",           value: "$3.8B", unit: "",        change: "+21%",      up: true,  period: "2024" },
      { label: "Regulatory Risk Index",   value: "54",    unit: "/100",    change: "+6pts",     up: true,  period: "2024" },
    ],
    alerts: [
      { level: "high",   msg: "NUPRC issued 3 new OML licenses — bid round open until Mar 2025.", time: "1 day ago" },
      { level: "medium", msg: "PIGB fiscal terms: 30% PPT on non-PSC onshore blocks.", time: "3 days ago" },
      { level: "medium", msg: "Exchange rate stabilised — CBN FX window at ₦1,580/$.", time: "4 days ago" },
      { level: "low",    msg: "NNPCL strategic divestment plan: 4 non-core assets listed.", time: "1 week ago" },
    ],
  },
  investor_capital: {
    label: "Capital Markets", roleTitle: "Energy Sector Capital Markets Intelligence Dashboard",
    color: "#0C4A6E", accent: "rgba(12,74,110,0.06)",
    persona: "Financial intelligence for portfolio investors, equity analysts and fixed income managers tracking Nigerian energy sector assets and revenue flows.",
    defaultView: "revenue", navOrder: ["revenue","faac","overview","upstream","downstream","power","renewable","midstream","bioenergy"],
    kpis: [
      { label: "Oil Revenue (FAAC)",    value: "₦2.8T", unit: "",        change: "+9.3%",  up: true,  period: "Q4 2024" },
      { label: "Seplat EV / EBITDA",   value: "4.2×",  unit: "",        change: "-0.3×",  up: false, period: "FY 2024" },
      { label: "NNPCL Dividend Yield",  value: "N/A",   unit: "",        change: "Pre-IPO", up: false, period: "2024" },
      { label: "Energy GDP Weight",     value: "5.4%",  unit: "of GDP",  change: "+0.3pp", up: true,  period: "Q4 2024" },
    ],
    alerts: [
      { level: "high",   msg: "NNPCL IPO roadshow scheduled Q1 2025 — investor registration open.", time: "Today" },
      { level: "medium", msg: "Seplat AGO acquisition adds ~30kbopd net production.", time: "2 days ago" },
      { level: "medium", msg: "FGN petroleum revenue bond issuance 2025 — indicative $500M.", time: "4 days ago" },
      { level: "low",    msg: "Fitch affirmed Nigeria B energy sovereign outlook 'Stable'.", time: "1 week ago" },
    ],
  },
  investor_infra: {
    label: "Infrastructure / Power", roleTitle: "Power & Infrastructure Investor Intelligence Dashboard",
    color: "#B45309", accent: "rgba(180,83,9,0.06)",
    persona: "Due diligence intelligence for IPPs, GenCo acquirers, DisCo investors and infrastructure funds evaluating Nigerian power sector assets.",
    defaultView: "power", navOrder: ["power","revenue","downstream","overview","upstream","renewable","midstream","bioenergy","faac"],
    kpis: [
      { label: "Installed Capacity",   value: "12,522", unit: "MW",    change: "+3.2%",    up: true,  period: "Q4 2024" },
      { label: "Avg Tariff (Band A)",  value: "₦206",   unit: "/kWh",  change: "+18.4%",   up: true,  period: "2024" },
      { label: "Market Shortfall",     value: "₦4.1T",  unit: "Cum.",  change: "FY 2024",  up: false, period: "2024" },
      { label: "DisCo Avg ATC&C",      value: "46.2%",  unit: "",      change: "-1.8pp",   up: true,  period: "Q4 2024" },
    ],
    alerts: [
      { level: "high",   msg: "World Bank $500M DISREP financing for DisCo privatisation round.", time: "2 days ago" },
      { level: "high",   msg: "NERC approved 40% tariff uplift for Band A customers.", time: "3 days ago" },
      { level: "medium", msg: "Afam IV acquisition tender — 986MW gas plant.", time: "5 days ago" },
      { level: "low",    msg: "ATC&C improvement trajectory: 3 DisCos below 40% threshold.", time: "1 week ago" },
    ],
  },
  investor_renewable: {
    label: "Renewable Investors", roleTitle: "Clean Energy Investment Intelligence Dashboard",
    color: "#059669", accent: "rgba(5,150,105,0.06)",
    persona: "Investment intelligence for solar, wind, mini-grid and clean energy developers. Capacity gap analysis, FiT obligations, REA pipeline and off-grid market intelligence.",
    defaultView: "renewable", navOrder: ["renewable","overview","power","revenue","upstream","downstream","midstream","bioenergy","faac"],
    kpis: [
      { label: "Off-Grid Market Gap",   value: "65M",   unit: "People",   change: "Unelectrified", up: false, period: "2024" },
      { label: "Renewable Capacity",    value: "2,014", unit: "MW",       change: "+18.4%",        up: true,  period: "2024" },
      { label: "Solar IRR Potential",   value: "18-22%",unit: "",         change: "USD terms",     up: true,  period: "2024" },
      { label: "FiT Tariff (Solar)",    value: "₦80",   unit: "/kWh",     change: "NERC 2024",     up: true,  period: "2024" },
    ],
    alerts: [
      { level: "high",   msg: "REA issued RFP for 200 mini-grid sites — deadline Feb 2025.", time: "1 day ago" },
      { level: "medium", msg: "World Bank Distributed Access fund: $150M available.", time: "3 days ago" },
      { level: "medium", msg: "FiT obligations for wind projects missed Q3 payment deadline.", time: "5 days ago" },
      { level: "low",    msg: "NREEEP Phase 2 ahead of target in Katsina and Sokoto.", time: "1 week ago" },
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

const DOWNSTREAM_TABLE = [
  { company: "Abuja DisCo",         atc: 42.3, collection: 78.2, state: "FCT"    },
  { company: "Eko DisCo",           atc: 38.1, collection: 82.5, state: "Lagos"  },
  { company: "Ikeja DisCo",         atc: 35.7, collection: 85.1, state: "Lagos"  },
  { company: "Ibadan DisCo",        atc: 51.2, collection: 68.4, state: "Oyo"    },
  { company: "Enugu DisCo",         atc: 48.6, collection: 71.3, state: "Enugu"  },
  { company: "Port Harcourt DisCo", atc: 44.9, collection: 74.7, state: "Rivers" },
  { company: "Kano DisCo",          atc: 55.3, collection: 62.1, state: "Kano"   },
  { company: "Kaduna DisCo",        atc: 53.8, collection: 65.9, state: "Kaduna" },
];

const OML_TABLE = [
  { block: "OML 60-63", operator: "NUIMS / NNPCL",  prod: 124.2, royalty: 14.2, status: "Active" },
  { block: "OML 11",    operator: "Shell SPDC",      prod: 88.4,  royalty: 9.8,  status: "Active" },
  { block: "OML 130",   operator: "TotalEnergies",   prod: 76.1,  royalty: 8.4,  status: "Active" },
  { block: "OML 4,38,41", operator: "Seplat Energy", prod: 52.8,  royalty: 5.9,  status: "Active" },
  { block: "OML 29",    operator: "Aiteo E&P",       prod: 44.6,  royalty: 5.0,  status: "Active" },
  { block: "OML 49",    operator: "Chevron Nigeria",  prod: 38.2,  royalty: 4.3,  status: "Active" },
];

function downloadTableCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Period navigator ───────────────────────────────────────────
function PeriodNav({ year, setYear }: { year: number; setYear: (y: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: "1.25rem" }}>
      <span style={{ fontSize: "0.72rem", color: "var(--ink-4)", fontWeight: 600, marginRight: 4 }}>Period</span>
      <button onClick={() => setYear(Math.max(2020, year - 1))} disabled={year <= 2020} style={{ width: 28, height: 28, border: "1px solid var(--border)", borderRadius: 4, background: "transparent", cursor: year > 2020 ? "pointer" : "not-allowed", color: "var(--ink-4)", fontSize: "0.85rem" }}>‹</button>
      {YEARS.map((y) => (
        <button key={y} onClick={() => setYear(y)} style={{ height: 28, padding: "0 10px", border: `1px solid ${y === year ? "var(--green)" : "var(--border)"}`, borderRadius: 4, background: y === year ? "var(--green)" : "transparent", color: y === year ? "#fff" : "var(--ink-4)", fontSize: "0.75rem", fontWeight: y === year ? 700 : 400, cursor: "pointer" }}>{y}</button>
      ))}
      <button onClick={() => setYear(Math.min(2024, year + 1))} disabled={year >= 2024} style={{ width: 28, height: 28, border: "1px solid var(--border)", borderRadius: 4, background: "transparent", cursor: year < 2024 ? "pointer" : "not-allowed", color: "var(--ink-4)", fontSize: "0.85rem" }}>›</button>
      <span style={{ marginLeft: 8, fontSize: "0.7rem", color: "var(--ink-5)", fontStyle: "italic" }}>Sample data — real records populate as uploads are committed</span>
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
  const [selectedYear, setSelectedYear] = useState(2024);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/data-point/dashboard"); return; }
    const name    = getFullName() || "Staff";
    const role    = getRole() || "viewer";
    const profKey = getDashboardProfile() || "executive";
    const prof    = PROFILE_MAP[profKey] ?? PROFILE_MAP.executive;
    setStaffName(name); setStaffRole(role); setProfile(prof); setView(prof.defaultView);
    const tick = () => setClock(new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [router]);

  const data = buildData(selectedYear);

  function logout() { clearTokens(); router.replace("/data-point/login"); }
  function navigate(id: string) { setView(id); setSidebarOpen(false); }

  const orderedNav = profile.navOrder.map((id) => ({ id, ...NAV_ITEMS[id] }));
  const sections   = [...new Set(orderedNav.map((n) => n.section))];

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
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{NAV_ITEMS[view]?.label ?? "Overview"}</span>
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

          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden", marginBottom: "1.5rem" }}>
            {profile.kpis.map((m) => (
              <div key={m.label} className="metric-card" style={{ border: "none", borderRadius: 0 }}>
                <div className="mc-label">{m.label}</div>
                <div className="mc-value">{m.value}{m.unit && <span style={{ fontSize: "0.75rem", color: "var(--ink-4)", fontFamily: "var(--font-sans)", marginLeft: 4 }}>{m.unit}</span>}</div>
                <div className={`mc-trend ${m.up ? "up" : "down"}`}>{m.up && m.change ? "+" : ""}{m.change}{m.period && <span style={{ fontWeight: 400, color: "var(--ink-5)" }}> · {m.period}</span>}</div>
              </div>
            ))}
          </div>

          {/* ── OVERVIEW ── */}
          {view === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <PeriodNav year={selectedYear} setYear={setSelectedYear} />
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.25rem" }}>
                <SectorChart title="Crude Oil Production" subtitle={`Monthly volumes · ${selectedYear}`} source="NUPRC" data={data.crude} series={[{ key: "value", label: "Production", color: profile.color }]} unit="M Barrels" filename="crude-oil-production" />
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">Anomaly Feed</span>
                    <span className="tag tag-red" style={{ fontSize: "0.6rem" }}>{profile.alerts.filter((a) => a.level === "high").length} High</span>
                  </div>
                  <div className="panel-body" style={{ padding: "0 1.25rem" }}>
                    {profile.alerts.map((a, i) => (
                      <div key={i} className="alert-row">
                        <span className={`alert-dot ${a.level}`} />
                        <div className="alert-body">{a.msg}<div className="alert-time">{a.time}</div></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <NigeriaMap metric="electricity_access" title="Electricity Access Rate by State" unit="%" colorLow="#FEF3C7" colorHigh="#0E7A3C" higherIsBetter={true} />
              <SectorChart title="Downstream Products — Multi-series" subtitle={`PMS · AGO · LPG monthly volumes · ${selectedYear}`} source="NMDPRA / NNPCL" data={data.downstream} series={[{ key: "pms", label: "PMS", color: "#0E7A3C" }, { key: "ago", label: "AGO", color: "#1D4ED8" }, { key: "lpg", label: "LPG", color: "#B45309" }]} unit="M Litres" filename="downstream-products" />
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
              <PeriodNav year={selectedYear} setYear={setSelectedYear} />
              <SectorChart title="Downstream Products — Monthly Trend" subtitle={`PMS · AGO · LPG volumes · ${selectedYear}`} source="NMDPRA / NNPCL" data={data.downstream} series={[{ key: "pms", label: "PMS (M L)", color: "#0E7A3C" }, { key: "ago", label: "AGO (M L)", color: "#1D4ED8" }, { key: "lpg", label: "LPG (MT)", color: "#B45309" }]} unit="" filename="downstream-products" />
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Distribution Companies — ATC&amp;C Loss & Collection Efficiency</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>NERC Q4 2024</span>
                    <button onClick={() => downloadTableCSV("disco-performance", ["Company","State","ATC&C Loss (%)","Collection Efficiency (%)","Performance"], DOWNSTREAM_TABLE.map((r) => [r.company, r.state, r.atc, r.collection, r.atc < 40 ? "Above Target" : r.atc < 50 ? "Moderate" : "Critical"]))} style={{ padding: "3px 10px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid var(--green-line)", borderRadius: 4, background: "var(--green-strong)", color: "var(--green-deep)", cursor: "pointer" }}>↓ CSV</button>
                  </div>
                </div>
                <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                  <table className="data-table">
                    <thead><tr><th>#</th><th>Distribution Company</th><th>State</th><th className="td-num">ATC&amp;C Loss (%)</th><th className="td-num">Collection Efficiency (%)</th><th>Performance</th></tr></thead>
                    <tbody>{DOWNSTREAM_TABLE.map((row, i) => (
                      <tr key={row.company}>
                        <td style={{ color: "var(--ink-5)", fontSize: "0.72rem" }}>{i + 1}</td>
                        <td className="td-primary">{row.company}</td>
                        <td>{row.state}</td>
                        <td className="td-num td-mono" style={{ color: row.atc > 50 ? "var(--red)" : row.atc > 40 ? "var(--amber)" : "var(--green)" }}>{row.atc.toFixed(1)}%</td>
                        <td className="td-num td-mono" style={{ color: row.collection >= 80 ? "var(--green)" : row.collection >= 70 ? "var(--amber)" : "var(--red)" }}>{row.collection.toFixed(1)}%</td>
                        <td><span className={`tag ${row.atc < 40 ? "tag-green" : row.atc < 50 ? "tag-amber" : "tag-red"}`}>{row.atc < 40 ? "Above Target" : row.atc < 50 ? "Moderate" : "Critical"}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── UPSTREAM ── */}
          {view === "upstream" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <PeriodNav year={selectedYear} setYear={setSelectedYear} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                <SectorChart title="Crude Oil Production" subtitle={`Monthly barrels · ${selectedYear}`} source="NUPRC" data={data.crude} series={[{ key: "value", label: "Production", color: "#78350F" }]} unit="M Barrels" filename="crude-oil-production" />
                <SectorChart title="Natural Gas Production" subtitle={`Monthly volumes · ${selectedYear}`} source="NUPRC / NNPCL" data={data.gas} series={[{ key: "value", label: "Gas", color: "#0E7A3C" }]} unit="Bcf" filename="natural-gas-production" />
              </div>
              <NigeriaMap metric="crude_production" title="Crude Oil Production by State" unit="M Barrels" colorLow="#FEF3C7" colorHigh="#78350F" higherIsBetter={true} />
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">OML Block Performance Summary</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>NUPRC · {selectedYear}</span>
                    <button onClick={() => downloadTableCSV("oml-performance", ["OML Block","Operator","Production (M Bbls)","Royalty (₦B)","Status"], OML_TABLE.map((r) => [r.block, r.operator, r.prod, r.royalty, r.status]))} style={{ padding: "3px 10px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid var(--green-line)", borderRadius: 4, background: "var(--green-strong)", color: "var(--green-deep)", cursor: "pointer" }}>↓ CSV</button>
                  </div>
                </div>
                <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                  <table className="data-table">
                    <thead><tr><th>OML Block(s)</th><th>Operator</th><th className="td-num">Production (M Bbls)</th><th className="td-num">Royalty (₦B)</th><th>Status</th></tr></thead>
                    <tbody>{OML_TABLE.map((row) => (
                      <tr key={row.block}>
                        <td className="td-primary td-mono" style={{ fontSize: "0.75rem" }}>{row.block}</td>
                        <td>{row.operator}</td>
                        <td className="td-num td-mono">{row.prod.toFixed(1)}</td>
                        <td className="td-num td-mono">{row.royalty.toFixed(1)}</td>
                        <td><span className="live-dot" style={{ marginRight: 6 }} />{row.status}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── POWER ── */}
          {view === "power" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <PeriodNav year={selectedYear} setYear={setSelectedYear} />
              <SectorChart title="Electricity Generation vs. Sent Out" subtitle={`Monthly GWh · ${selectedYear}`} source="NERC / TCN" data={data.generation.map((g, i) => ({ period: g.period, generation: g.value, sent_out: data.sentOut[i]?.value ?? 0 }))} series={[{ key: "generation", label: "Generation (GWh)", color: "#1D4ED8" }, { key: "sent_out", label: "Sent Out (GWh)", color: "#0E7A3C" }]} unit="GWh" filename="electricity-generation" />
              <NigeriaMap metric="atc_loss" title="ATC&C Loss Rate by State" unit="%" colorLow="#DCFCE7" colorHigh="#C0392B" higherIsBetter={false} />
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Distribution Companies — ATC&amp;C Loss & Collection Efficiency</span>
                  <button onClick={() => downloadTableCSV("disco-performance", ["Company","State","ATC&C Loss (%)","Collection Efficiency (%)","Performance"], DOWNSTREAM_TABLE.map((r) => [r.company, r.state, r.atc, r.collection, r.atc < 40 ? "Above Target" : r.atc < 50 ? "Moderate" : "Critical"]))} style={{ padding: "3px 10px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid var(--green-line)", borderRadius: 4, background: "var(--green-strong)", color: "var(--green-deep)", cursor: "pointer" }}>↓ CSV</button>
                </div>
                <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                  <table className="data-table">
                    <thead><tr><th>DisCo</th><th>State</th><th className="td-num">ATC&amp;C (%)</th><th className="td-num">Collection (%)</th><th>Rating</th></tr></thead>
                    <tbody>{DOWNSTREAM_TABLE.map((row) => (
                      <tr key={row.company}>
                        <td className="td-primary">{row.company}</td>
                        <td>{row.state}</td>
                        <td className="td-num td-mono" style={{ color: row.atc > 50 ? "var(--red)" : row.atc > 40 ? "var(--amber)" : "var(--green)" }}>{row.atc.toFixed(1)}%</td>
                        <td className="td-num td-mono" style={{ color: row.collection >= 80 ? "var(--green)" : row.collection >= 70 ? "var(--amber)" : "var(--red)" }}>{row.collection.toFixed(1)}%</td>
                        <td><span className={`tag ${row.atc < 40 ? "tag-green" : row.atc < 50 ? "tag-amber" : "tag-red"}`}>{row.atc < 40 ? "Good" : row.atc < 50 ? "Moderate" : "Critical"}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── RENEWABLE ── */}
          {view === "renewable" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <PeriodNav year={selectedYear} setYear={setSelectedYear} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                <SectorChart title="Renewable Energy Capacity" subtitle={`Quarterly installed MW · ${selectedYear}`} source="REA / NERC" data={data.renewable} series={[{ key: "value", label: "Capacity (MW)", color: "#059669" }]} unit="MW" filename="renewable-capacity" />
                <SectorChart title="Fuelwood Consumption" subtitle={`Quarterly volumes · ${selectedYear}`} source="ECN / NBS" data={data.fuelwood} series={[{ key: "value", label: "Fuelwood (M m³)", color: "#78350F" }]} unit="M m³" filename="fuelwood-consumption" />
              </div>
              <NigeriaMap metric="offgrid_penetration" title="Off-Grid Dependence by State" unit="%" colorLow="#D1FAE5" colorHigh="#065F46" higherIsBetter={false} />
              <div className="panel" style={{ padding: "1.25rem 1.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem" }}>
                  {[{ label: "Off-Grid Connections", value: "2.4M", unit: "Households", change: "+18.2%", up: true },{ label: "Mini-Grids Deployed", value: "214", unit: "Sites", change: "+62 vs 2023", up: true },{ label: "LPG Penetration", value: "18.4%", unit: "HH", change: "+2.1pp", up: true }].map((m) => (
                    <div key={m.label}>
                      <div className="kpi-label">{m.label}</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono)", marginTop: 4 }}>{m.value} <span style={{ fontSize: "0.75rem", color: "var(--ink-4)", fontFamily: "var(--font-sans)" }}>{m.unit}</span></div>
                      <div style={{ fontSize: "0.75rem", color: m.up ? "var(--green)" : "var(--red)", fontWeight: 600, marginTop: 2 }}>+{m.change}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── REVENUE ── */}
          {view === "revenue" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <PeriodNav year={selectedYear} setYear={setSelectedYear} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                <SectorChart title="Oil Revenue — FAAC Contribution" subtitle={`Quarterly ₦B · ${selectedYear}`} source="RMAFC / CBN" data={data.faac} series={[{ key: "value", label: "FAAC Oil Revenue (₦B)", color: "#7C3AED" }]} unit="₦B" filename="faac-oil-revenue" />
                <SectorChart title="Upstream Royalties Collected" subtitle={`Quarterly ₦B · ${selectedYear}`} source="NUPRC / FIRS" data={data.royalties} series={[{ key: "value", label: "Royalties (₦B)", color: "#9F1239" }]} unit="₦B" filename="upstream-royalties" />
              </div>
              <div style={{ padding: "0.875rem 1rem", background: "var(--amber-tint)", border: "1px solid rgba(180,83,0.2)", borderRadius: "var(--r-md)", fontSize: "0.82rem", color: "var(--amber)" }}>
                Revenue Portal under active development. Producing companies registry is live. Financial flow data will be published upon completion of agency data agreements.
              </div>
              <RevenueRegistryTable />
            </div>
          )}

          {/* ── ENERGY BRIEF (Presidency / Reporting profiles) ── */}
          {view === "brief" && (
            <PresidencyBrief staffName={staffName} profileLabel={profile.label} roleTitle={profile.roleTitle} kpis={profile.kpis} alerts={profile.alerts} selectedYear={selectedYear} setSelectedYear={setSelectedYear} />
          )}

        </div>
      </div>

      <ApexAI currentView={view} profileLabel={profile.label} />
    </div>
  );
}

// ── Presidency Energy Brief ────────────────────────────────────
interface KPI { label: string; value: string; unit: string; change: string; up: boolean; period: string }
interface Alert { level: string; msg: string; time: string }

function PresidencyBrief({ staffName, profileLabel, roleTitle, kpis, alerts, selectedYear, setSelectedYear }: {
  staffName: string; profileLabel: string; roleTitle: string;
  kpis: KPI[]; alerts: Alert[]; selectedYear: number; setSelectedYear: (y: number) => void;
}) {
  const [classification, setClassification] = useState("FOR OFFICIAL USE ONLY");
  const briefDate = new Date().toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" });

  function printBrief() {
    window.print();
  }

  const STATS = [
    { section: "Petroleum Sector",  items: [{ label: "Crude Oil Production (Dec 2024)", value: "85.1M Barrels", trend: "+13.3% YoY", status: "positive" }, { label: "Natural Gas Produced (Q4 2024)", value: "196.4 Bcf", trend: "+7.8% YoY", status: "positive" }, { label: "PMS National Sales", value: "1.82B Litres", trend: "-2.3% QoQ", status: "negative" }, { label: "AGO (Diesel) Sales", value: "624M Litres", trend: "+5.1% QoQ", status: "positive" }]},
    { section: "Electricity Sector", items: [{ label: "Installed Generation Capacity", value: "12,522 MW", trend: "+3.2% YoY", status: "positive" }, { label: "Electricity Generation (Q4)", value: "3,241 GWh", trend: "+4.1% YoY", status: "positive" }, { label: "Avg. ATC&C Loss (National)", value: "46.2%", trend: "-1.8pp YoY", status: "positive" }, { label: "Power Sector Market Shortfall", value: "₦4.1 Trillion", trend: "Cumulative FY2024", status: "negative" }]},
    { section: "Revenue & Fiscal",   items: [{ label: "Oil Revenue — FAAC (Q4 2024)", value: "₦2.8 Trillion", trend: "+9.3% YoY", status: "positive" }, { label: "Upstream Royalties Collected", value: "₦412 Billion", trend: "+14.1% YoY", status: "positive" }, { label: "PPT (Petroleum Profit Tax)", value: "₦289 Billion", trend: "+6.8% YoY", status: "positive" }, { label: "FDI in Energy Sector", value: "$3.8 Billion", trend: "+21% YoY", status: "positive" }]},
    { section: "Clean Energy Transition", items: [{ label: "Renewable Energy Capacity", value: "2,014 MW", trend: "+18.4% YoY", status: "positive" }, { label: "Off-Grid Connections", value: "2.4M Households", trend: "+18.2% YoY", status: "positive" }, { label: "LPG Household Penetration", value: "18.4%", trend: "+2.1pp YoY", status: "positive" }, { label: "Fuelwood Consumption", value: "71.2M m³", trend: "-3.1% YoY", status: "positive" }]},
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Controls toolbar — screen only */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem", background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
        <div style={{ flex: 1, fontSize: "0.8rem", fontWeight: 600, color: "var(--ink)" }}>Energy Brief — Print-Ready Report</div>
        <PeriodNav year={selectedYear} setYear={setSelectedYear} />
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
          <p style={{ fontSize: "0.85rem", color: "var(--ink)", lineHeight: 1.7, maxWidth: 780 }}>
            Nigeria&apos;s energy sector posted improved performance in {selectedYear}, with crude oil production recovering to <strong>85.1M barrels/month</strong> (+13.3% YoY) and electricity generation reaching <strong>3,241 GWh</strong> in Q4. Revenue flows strengthened, with FAAC oil contributions rising to <strong>₦2.8 trillion</strong> in Q4 2024. The clean energy transition gained momentum — renewable capacity grew <strong>18.4% YoY</strong> to 2,014 MW. Critical challenges persist: national ATC&amp;C losses remain elevated at 46.2% and the cumulative power sector market shortfall reached ₦4.1 trillion in FY2024.
          </p>
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

        {/* Sector-by-sector stats */}
        <div style={{ padding: "1.5rem 2.5rem" }}>
          {STATS.map((sec) => (
            <div key={sec.section} style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#1B2A4A", textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: "2px solid #1B2A4A", paddingBottom: "0.4rem", marginBottom: "0.875rem" }}>{sec.section}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {sec.items.map((item) => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0.5rem 0.75rem", background: item.status === "negative" ? "rgba(192,57,43,0.04)" : "var(--surface)", borderRadius: 4, border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--ink-4)" }}>{item.label}</span>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "1rem" }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{item.value}</div>
                      <div style={{ fontSize: "0.65rem", color: item.status === "positive" ? "var(--green)" : "var(--red)", fontWeight: 600 }}>{item.trend}</div>
                    </div>
                  </div>
                ))}
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
