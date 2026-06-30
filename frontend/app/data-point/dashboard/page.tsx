"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearTokens, isLoggedIn, getFullName, getRole, getDashboardProfile } from "@/lib/auth";
import dynamic from "next/dynamic";
import CoatOfArms from "@/components/layout/CoatOfArms";

const OverviewChart = dynamic(
  () => import("@/components/datapoint/OverviewChart"),
  { ssr: false, loading: () => <div style={{ height: 280, background: "var(--surface-muted)", borderRadius: "var(--r-lg)" }} /> }
);

// ── Profile definitions ────────────────────────────────────────
interface ProfileDef {
  label:       string;
  roleTitle:   string;
  color:       string;
  accent:      string; // light bg tint
  persona:     string;
  defaultView: string;
  navOrder:    string[];
  kpis: { label: string; value: string; unit: string; change: string; up: boolean; period: string }[];
  alerts: { level: string; msg: string; time: string }[];
}

const PROFILE_MAP: Record<string, ProfileDef> = {
  executive: {
    label: "Executive Overview",
    roleTitle: "National Energy Intelligence Dashboard",
    color: "#0E7A3C",
    accent: "rgba(14,122,60,0.06)",
    persona: "Cross-sector overview for executive leadership and national policy decision-makers.",
    defaultView: "overview",
    navOrder: ["overview", "downstream", "revenue", "upstream", "power", "midstream", "renewable", "bioenergy", "faac"],
    kpis: [
      { label: "Crude Oil Production",    value: "85.1M",  unit: "Barrels",    change: "+13.3%", up: true,  period: "Dec 2024" },
      { label: "Electricity Generation",  value: "3,241",  unit: "GWh",        change: "+4.1%",  up: true,  period: "Q4 2024" },
      { label: "PMS Sales Volume",        value: "1.82B",  unit: "Litres",     change: "-2.3%",  up: false, period: "Q3 2024" },
      { label: "Natural Gas Produced",    value: "196.4",  unit: "Bcf",        change: "+7.8%",  up: true,  period: "Q4 2024" },
    ],
    alerts: [
      { level: "high",   msg: "Abuja DisCo ATC&C loss exceeded 40% threshold for 3rd consecutive month.", time: "2 hours ago" },
      { level: "medium", msg: "Natural gas production volume shows 18% deviation from 3-month rolling average.", time: "6 hours ago" },
      { level: "medium", msg: "PMS national stock level below 14-day buffer — potential supply stress.", time: "Yesterday" },
      { level: "low",    msg: "Electricity generation data for November not yet submitted by 3 DisCos.", time: "2 days ago" },
      { level: "low",    msg: "Crude oil production CAGR updated following NUPRC Q4 reconciliation.", time: "3 days ago" },
    ],
  },
  petroleum: {
    label: "Petroleum & Gas Analyst",
    roleTitle: "Petroleum & Upstream Intelligence Dashboard",
    color: "#92400E",
    accent: "rgba(146,64,14,0.05)",
    persona: "Upstream crude production, downstream product distribution and retail sales analytics for petroleum sector analysts.",
    defaultView: "downstream",
    navOrder: ["downstream", "upstream", "revenue", "overview", "midstream", "power", "renewable", "bioenergy", "faac"],
    kpis: [
      { label: "Crude Oil Production",  value: "85.1M",  unit: "Barrels",  change: "+13.3%", up: true,  period: "Dec 2024" },
      { label: "PMS Sales Volume",      value: "1.82B",  unit: "Litres",   change: "-2.3%",  up: false, period: "Q3 2024" },
      { label: "AGO (Diesel) Sales",    value: "624M",   unit: "Litres",   change: "+5.1%",  up: true,  period: "Q3 2024" },
      { label: "LPG Consumption",       value: "214K",   unit: "MT",       change: "+11.2%", up: true,  period: "Q3 2024" },
    ],
    alerts: [
      { level: "high",   msg: "PMS national stock level below 14-day buffer — potential supply stress.", time: "Yesterday" },
      { level: "medium", msg: "Crude oil production CAGR updated following NUPRC Q4 reconciliation.", time: "3 days ago" },
      { level: "medium", msg: "AGO diesel price differential widening — cross-border arbitrage risk.", time: "4 days ago" },
      { level: "low",    msg: "NNPCL Q4 crude lifting schedule published. 3 cargoes deferred.", time: "5 days ago" },
    ],
  },
  electricity: {
    label: "Power & Grid Analyst",
    roleTitle: "Power Sector Intelligence Dashboard",
    color: "#1D4ED8",
    accent: "rgba(29,78,216,0.05)",
    persona: "Generation capacity, grid transmission performance, distribution losses and market financial settlement data.",
    defaultView: "downstream",
    navOrder: ["downstream", "power", "midstream", "overview", "upstream", "renewable", "bioenergy", "faac", "revenue"],
    kpis: [
      { label: "Electricity Generation",  value: "3,241",   unit: "GWh",  change: "+4.1%",  up: true,  period: "Q4 2024" },
      { label: "System Sent Out",         value: "2,890",   unit: "GWh",  change: "+3.8%",  up: true,  period: "Q4 2024" },
      { label: "Avg ATC&C Loss (Nat.)",   value: "46.2%",   unit: "",     change: "-1.8pp", up: true,  period: "Q4 2024" },
      { label: "Market Shortfall",        value: "₦4.1T",   unit: "",     change: "Cumul.", up: false, period: "FY 2024" },
    ],
    alerts: [
      { level: "high",   msg: "Abuja DisCo ATC&C loss exceeded 40% threshold for 3rd consecutive month.", time: "2 hours ago" },
      { level: "high",   msg: "System frequency dropped below 49.5 Hz on 4 occasions in the past week.", time: "1 day ago" },
      { level: "medium", msg: "Electricity generation data for November not yet submitted by 3 DisCos.", time: "2 days ago" },
      { level: "low",    msg: "NBET payment shortfall increased by ₦12B vs. previous month.", time: "4 days ago" },
    ],
  },
  renewables: {
    label: "Clean Energy Analyst",
    roleTitle: "Renewables & Clean Energy Intelligence Dashboard",
    color: "#059669",
    accent: "rgba(5,150,105,0.05)",
    persona: "Renewable energy capacity, natural gas production, biomass consumption and clean energy transition metrics.",
    defaultView: "overview",
    navOrder: ["renewable", "bioenergy", "overview", "power", "upstream", "downstream", "midstream", "faac", "revenue"],
    kpis: [
      { label: "Natural Gas Produced",    value: "196.4",   unit: "Bcf",         change: "+7.8%",  up: true,  period: "Q4 2024" },
      { label: "Renewable Capacity",      value: "2,014",   unit: "MW",          change: "+18.4%", up: true,  period: "2024" },
      { label: "Fuelwood Consumption",    value: "71.2M",   unit: "m³",          change: "-3.1%",  up: true,  period: "2024" },
      { label: "LPG Penetration",         value: "18.4%",   unit: "Households",  change: "+2.1pp", up: true,  period: "2024" },
    ],
    alerts: [
      { level: "medium", msg: "Natural gas production volume shows 18% deviation from 3-month rolling average.", time: "6 hours ago" },
      { level: "medium", msg: "Off-grid solar capacity addition for Q4 not yet certified by REA.", time: "3 days ago" },
      { level: "low",    msg: "Biomass data reconciliation pending for 7 northern states.", time: "5 days ago" },
      { level: "low",    msg: "FiT payment obligations for wind projects missed Q3 deadline.", time: "1 week ago" },
    ],
  },
  fiscal: {
    label: "Fiscal & Revenue Analyst",
    roleTitle: "Fiscal Revenue Intelligence Dashboard",
    color: "#7C3AED",
    accent: "rgba(124,58,237,0.05)",
    persona: "FAAC energy contribution, upstream revenue flows, royalty collections and producing company financial intelligence.",
    defaultView: "revenue",
    navOrder: ["revenue", "faac", "upstream", "overview", "downstream", "midstream", "power", "renewable", "bioenergy"],
    kpis: [
      { label: "Oil Revenue (FAAC)",    value: "₦2.8T",  unit: "",   change: "+9.3%",  up: true,  period: "Q4 2024" },
      { label: "Upstream Royalties",    value: "₦412B",  unit: "",   change: "+14.1%", up: true,  period: "Q4 2024" },
      { label: "PPT Collected",         value: "₦289B",  unit: "",   change: "+6.8%",  up: true,  period: "Q4 2024" },
      { label: "Signature Bonuses",     value: "$340M",  unit: "",   change: "FY 2024",up: true,  period: "2024" },
    ],
    alerts: [
      { level: "high",   msg: "Upstream royalty remittance from OML 25 block overdue by 45 days.", time: "Today" },
      { level: "medium", msg: "FAAC oil revenue share 12% below budget projection for Q4.", time: "2 days ago" },
      { level: "medium", msg: "PPT audit for 2 IOC JVs pending — ₦38B in dispute.", time: "4 days ago" },
      { level: "low",    msg: "Signature bonus payment schedule for 2024 marginal field awards published.", time: "1 week ago" },
    ],
  },
};

// ── Sidebar nav ────────────────────────────────────────────────
const NAV_ITEMS: Record<string, { label: string; section: string; soon?: boolean }> = {
  overview:   { label: "Overview",           section: "National Intelligence" },
  downstream: { label: "Downstream Markets", section: "Energy Sectors" },
  upstream:   { label: "Upstream Revenue",   section: "Energy Sectors",  soon: true },
  midstream:  { label: "Midstream",          section: "Energy Sectors",  soon: true },
  power:      { label: "Power Generation",   section: "Energy Sectors",  soon: true },
  renewable:  { label: "Renewable Energy",   section: "Energy Sectors",  soon: true },
  bioenergy:  { label: "Bioenergy & Biomass",section: "Energy Sectors",  soon: true },
  revenue:    { label: "Revenue Portal",     section: "Fiscal Analysis" },
  faac:       { label: "FAAC Contribution",  section: "Fiscal Analysis", soon: true },
};

const FISCAL_PANELS = [
  { id: "upstream",  title: "Upstream Revenue Intelligence",  caption: "Royalties, PPT, profit oil splits and signature bonuses per field, disaggregated by OML block.", agencies: ["NUPRC", "FIRS", "NNPC"],        color: "#0E7A3C" },
  { id: "midstream", title: "Midstream Throughput & Tariff",  caption: "Pipeline tariff revenue, GDSO shortfall cost recovery, and refinery throughput by facility.",    agencies: ["NGC", "NMDPRA"],                 color: "#1D4ED8" },
  { id: "power",     title: "Power Sector Settlement",        caption: "GenCo invoices versus payments, market shortfall deficit, and ATC&C losses expressed in Naira.", agencies: ["NERC", "NBET", "TCN"],           color: "#B45309" },
  { id: "renewable", title: "Renewable Energy Investment",    caption: "Solar and wind capacity trends, FiT obligations versus actual payments, and mini-grid capex.",    agencies: ["REA", "NERC"],                   color: "#0E7A3C" },
  { id: "bioenergy", title: "Bioenergy & Solid Fuels",        caption: "Biomass consumption by state, coal export earnings in USD, and fuelwood displacement by LPG.",   agencies: ["ECN", "MMSD"],                   color: "#78350F" },
  { id: "faac",      title: "FAAC Energy Contribution",       caption: "Monthly oil revenue share of total FAAC pool versus Federal budget projection.",                  agencies: ["RMAFC", "DMO", "CBN"],           color: "#C0392B" },
];

const DOWNSTREAM_TABLE = [
  { company: "Abuja DisCo",          atc: 42.3, collection: 78.2, state: "FCT"    },
  { company: "Eko DisCo",            atc: 38.1, collection: 82.5, state: "Lagos"  },
  { company: "Ikeja DisCo",          atc: 35.7, collection: 85.1, state: "Lagos"  },
  { company: "Ibadan DisCo",         atc: 51.2, collection: 68.4, state: "Oyo"    },
  { company: "Enugu DisCo",          atc: 48.6, collection: 71.3, state: "Enugu"  },
  { company: "Port Harcourt DisCo",  atc: 44.9, collection: 74.7, state: "Rivers" },
  { company: "Kano DisCo",           atc: 55.3, collection: 62.1, state: "Kano"   },
  { company: "Kaduna DisCo",         atc: 53.8, collection: 65.9, state: "Kaduna" },
];

export default function Dashboard() {
  const router = useRouter();
  const [view, setView]             = useState("");
  const [clock, setClock]           = useState("");
  const [staffName, setStaffName]   = useState("");
  const [staffRole, setStaffRole]   = useState("");
  const [profile, setProfile]       = useState<ProfileDef>(PROFILE_MAP.executive);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/data-point/dashboard"); return; }
    const name    = getFullName() || "Staff";
    const role    = getRole() || "viewer";
    const profKey = getDashboardProfile() || "executive";
    const prof    = PROFILE_MAP[profKey] ?? PROFILE_MAP.executive;
    setStaffName(name);
    setStaffRole(role);
    setProfile(prof);
    setView(prof.defaultView);
    const tick = () => setClock(new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [router]);

  function logout() { clearTokens(); router.replace("/data-point/login"); }
  function navigate(id: string) { setView(id); setSidebarOpen(false); }

  // Build ordered nav from profile priority
  const orderedNav = profile.navOrder.map((id) => ({ id, ...NAV_ITEMS[id] }));
  const sections   = [...new Set(orderedNav.map((n) => n.section))];
  const activeLabel = NAV_ITEMS[view]?.label ?? "Overview";

  return (
    <div className="dash-wrap">
      <div className={`dash-sidebar-backdrop${sidebarOpen ? " is-open" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* ── SIDEBAR ── */}
      <aside className={`dash-sidebar${sidebarOpen ? " is-open" : ""}`}>
        <div className="sb-brand">
          <div className="sb-seal"><CoatOfArms size={28} /></div>
          <div>
            <div className="sb-name">NEDB</div>
            <div className="sb-system">Intelligence Suite</div>
          </div>
        </div>

        {/* Profile badge in sidebar */}
        <div style={{ margin: "0 0.75rem 0.5rem", padding: "0.6rem 0.75rem", background: `${profile.color}18`, border: `1px solid ${profile.color}30`, borderRadius: "var(--r-md)" }}>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, color: profile.color, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>Dashboard Profile</div>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.75)", lineHeight: 1.3 }}>{profile.label}</div>
        </div>

        {sections.map((sec) => (
          <div key={sec}>
            <div className="sb-section">{sec}</div>
            {orderedNav.filter((n) => n.section === sec).map((item) => (
              <button key={item.id} className={`sb-link${view === item.id ? " active" : ""}`}
                onClick={() => !item.soon && navigate(item.id)}
                style={item.soon ? { opacity: 0.4, cursor: "not-allowed" } : undefined}>
                <span className="sb-label">{item.label}</span>
                {item.soon && <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", padding: "1px 5px", borderRadius: 3, letterSpacing: "0.05em" }}>SOON</span>}
              </button>
            ))}
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
        {/* Topbar */}
        <div className="dash-topbar">
          <button className="mob-sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{activeLabel}</span>
            <span style={{ marginLeft: 12, fontSize: "0.72rem", color: "var(--ink-4)", display: "inline" }} className="topbar-subtitle">NEDB &nbsp;·&nbsp; ECN</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "0.72rem", color: profile.color, fontWeight: 600, background: `${profile.color}12`, padding: "2px 8px", borderRadius: 4, border: `1px solid ${profile.color}30` }} className="topbar-subtitle">
              {profile.label}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--ink-4)" }}>{staffName}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--ink-3)" }}>{clock}</span>
            <span className="tag tag-green"><span className="live-dot" />Live</span>
          </div>
        </div>

        {/* Content */}
        <div className="dash-content">

          {/* ── PROFILE HERO BANNER ── */}
          <div style={{ background: `linear-gradient(135deg, ${profile.color}08 0%, ${profile.color}04 100%)`, border: `1px solid ${profile.color}20`, borderRadius: "var(--r-lg)", padding: "1.25rem 1.5rem", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, color: profile.color, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.25rem" }}>
                {profile.label}
              </div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", fontWeight: 400, color: "var(--ink)", lineHeight: 1.2, marginBottom: "0.3rem" }}>
                {profile.roleTitle}
              </h2>
              <p style={{ fontSize: "0.78rem", color: "var(--ink-4)", lineHeight: 1.5, maxWidth: 560 }}>
                {profile.persona}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Welcome back</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)" }}>{staffName}</div>
            </div>
          </div>

          {/* ── PROFILE KPI STRIP ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden", marginBottom: "1.5rem" }}>
            {profile.kpis.map((m) => (
              <div key={m.label} className="metric-card" style={{ border: "none", borderRadius: 0 }}>
                <div className="mc-label">{m.label}</div>
                <div className="mc-value">
                  {m.value}
                  {m.unit && <span style={{ fontSize: "0.75rem", color: "var(--ink-4)", fontFamily: "var(--font-sans)", marginLeft: 4 }}>{m.unit}</span>}
                </div>
                <div className={`mc-trend ${m.up ? "up" : "down"}`}>
                  {m.up ? "+" : ""}{m.change} &nbsp;·&nbsp; <span style={{ fontWeight: 400, color: "var(--ink-5)" }}>{m.period}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── OVERVIEW ── */}
          {view === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.25rem" }}>
                <div className="chart-panel">
                  <div className="chart-panel-head">
                    <div>
                      <div className="chart-panel-title">Downstream Products — Monthly Trend (FY 2026)</div>
                      <div className="chart-panel-sub">PMS and AGO sales volumes · Litres · Sample data</div>
                    </div>
                  </div>
                  <div className="chart-panel-body" style={{ padding: "1rem 0.5rem" }}>
                    <OverviewChart />
                  </div>
                  <div className="chart-source">Source: NMDPRA / NNPCL &nbsp;·&nbsp; Unit: Millions of Litres &nbsp;·&nbsp; Updated monthly</div>
                </div>
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">Anomaly Feed</span>
                    <span className="tag tag-red" style={{ fontSize: "0.6rem" }}>
                      {profile.alerts.filter((a) => a.level === "high").length} High
                    </span>
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

              <div>
                <div className="sec-hd" style={{ marginBottom: "1rem" }}>
                  <h2>Fiscal Intelligence Panels</h2>
                  <span className="sec-hd-meta">Data integration in progress</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
                  {FISCAL_PANELS.map((panel) => (
                    <div key={panel.id} className="cs-panel">
                      <div className="cs-ghost">
                        {[70, 40, 55, 30, 60, 45, 80, 35, 50].map((w, i) => <div key={i} className="cs-ghost-bar" style={{ width: `${w}%` }} />)}
                      </div>
                      <div className="cs-overlay">
                        <div className="cs-agencies">
                          {panel.agencies.map((ag) => <span key={ag} className="cs-agency-tag" style={{ background: `${panel.color}18`, color: panel.color, border: `1px solid ${panel.color}30` }}>{ag}</span>)}
                        </div>
                        <h4>{panel.title}</h4>
                        <p>{panel.caption}</p>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
                {[
                  { label: "Avg ATC&C Loss (National)", value: "46.2%",  trend: "down", change: "-1.8pp vs Q3" },
                  { label: "Collection Efficiency",      value: "73.5%",  trend: "up",   change: "+2.1pp vs Q3" },
                  { label: "Market Shortfall (Cumul.)",  value: "₦4.1T", trend: "down", change: "FY 2024" },
                ].map((m) => (
                  <div key={m.label} className="metric-card" style={{ border: "none", borderRadius: 0 }}>
                    <div className="mc-label">{m.label}</div>
                    <div className="mc-value">{m.value}</div>
                    <div className={`mc-trend ${m.trend}`}>{m.change}</div>
                  </div>
                ))}
              </div>
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Distribution Companies — ATC&amp;C Loss & Collection Efficiency</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>Source: NERC Q4 2024</span>
                </div>
                <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>#</th><th>Distribution Company</th><th>State</th><th className="td-num">ATC&amp;C Loss (%)</th><th className="td-num">Collection Efficiency (%)</th><th>Performance</th></tr>
                    </thead>
                    <tbody>
                      {DOWNSTREAM_TABLE.map((row, i) => (
                        <tr key={row.company}>
                          <td style={{ color: "var(--ink-5)", fontSize: "0.72rem" }}>{i + 1}</td>
                          <td className="td-primary">{row.company}</td>
                          <td>{row.state}</td>
                          <td className="td-num td-mono" style={{ color: row.atc > 50 ? "var(--red)" : row.atc > 40 ? "var(--amber)" : "var(--green)" }}>{row.atc.toFixed(1)}%</td>
                          <td className="td-num td-mono" style={{ color: row.collection >= 80 ? "var(--green)" : row.collection >= 70 ? "var(--amber)" : "var(--red)" }}>{row.collection.toFixed(1)}%</td>
                          <td><span className={`tag ${row.atc < 40 ? "tag-green" : row.atc < 50 ? "tag-amber" : "tag-red"}`}>{row.atc < 40 ? "Above Target" : row.atc < 50 ? "Moderate" : "Critical"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Anomaly Feed — {profile.label}</span>
                </div>
                <div className="panel-body" style={{ padding: "0 1.25rem" }}>
                  {profile.alerts.slice(0, 3).map((a, i) => (
                    <div key={i} className="alert-row">
                      <span className={`alert-dot ${a.level}`} />
                      <div className="alert-body">{a.msg}<div className="alert-time">{a.time}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── REVENUE ── */}
          {view === "revenue" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div style={{ padding: "1rem 1.25rem", background: "var(--amber-tint)", border: "1px solid rgba(180,83,9,0.2)", borderRadius: "var(--r-md)", fontSize: "0.82rem", color: "var(--amber)" }}>
                Revenue Portal is under active development. Producing companies registry is live below; financial flow data will be published upon completion of agency data agreements.
              </div>
              <RevenueRegistryTable />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
                {FISCAL_PANELS.slice(0, 3).map((panel) => (
                  <div key={panel.id} className="cs-panel">
                    <div className="cs-ghost">{[70, 40, 55, 30, 60, 45, 80].map((w, i) => <div key={i} className="cs-ghost-bar" style={{ width: `${w}%` }} />)}</div>
                    <div className="cs-overlay">
                      <div className="cs-agencies">{panel.agencies.map((ag) => <span key={ag} className="cs-agency-tag" style={{ background: `${panel.color}18`, color: panel.color, border: `1px solid ${panel.color}30` }}>{ag}</span>)}</div>
                      <h4>{panel.title}</h4>
                      <p>{panel.caption}</p>
                      <span className="tag tag-amber" style={{ marginTop: "0.25rem" }}>Coming Soon</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// Loads registry live from API
function RevenueRegistryTable() {
  const [companies, setCompanies] = useState<{ id: number; company: string; oml_blocks: string | null; operator_type: string; sector: string; status: string }[]>([]);

  useEffect(() => {
    fetch("/api/registry").then((r) => r.json()).then(setCompanies).catch(() => {});
  }, []);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Producing Companies Registry</span>
        <span style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>{companies.length} companies</span>
      </div>
      <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
        <table className="data-table">
          <thead>
            <tr><th>Company</th><th>OML Block(s)</th><th>Operator Type</th><th>Sector</th><th>Status</th></tr>
          </thead>
          <tbody>
            {companies.map((row) => (
              <tr key={row.id}>
                <td className="td-primary">{row.company}</td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{row.oml_blocks ?? "—"}</td>
                <td>{row.operator_type}</td>
                <td><span className="tag tag-green" style={{ fontSize: "0.62rem" }}>{row.sector}</span></td>
                <td><span className="live-dot" style={{ marginRight: 6 }} />{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
