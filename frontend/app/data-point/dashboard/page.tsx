"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearTokens, isLoggedIn, getFullName, getRole } from "@/lib/auth";
import dynamic from "next/dynamic";
import CoatOfArms from "@/components/layout/CoatOfArms";

const OverviewChart = dynamic(
  () => import("@/components/datapoint/OverviewChart"),
  { ssr: false, loading: () => <div style={{ height: 280, background: "var(--surface-muted)", borderRadius: "var(--r-lg)" }} /> }
);

const NAV = [
  { id: "overview",   label: "Overview",          section: "National Intelligence" },
  { id: "downstream", label: "Downstream Markets", section: "Energy Sectors" },
  { id: "upstream",   label: "Upstream Revenue",   section: "Energy Sectors",  soon: true },
  { id: "midstream",  label: "Midstream",          section: "Energy Sectors",  soon: true },
  { id: "power",      label: "Power Generation",   section: "Energy Sectors",  soon: true },
  { id: "renewable",  label: "Renewable Energy",   section: "Energy Sectors",  soon: true },
  { id: "bioenergy",  label: "Bioenergy & Biomass",section: "Energy Sectors",  soon: true },
  { id: "revenue",    label: "Revenue Portal",     section: "Fiscal Analysis" },
  { id: "faac",       label: "FAAC Contribution",  section: "Fiscal Analysis", soon: true },
];

const FISCAL_PANELS = [
  {
    id: "upstream",
    title: "Upstream Revenue Intelligence",
    caption: "Royalties, PPT, profit oil splits and signature bonuses per field, disaggregated by OML block.",
    agencies: ["NUPRC", "FIRS", "NNPC"],
    color: "#0E7A3C",
  },
  {
    id: "midstream",
    title: "Midstream Throughput & Tariff",
    caption: "Pipeline tariff revenue, GDSO shortfall cost recovery, and refinery throughput by facility.",
    agencies: ["NGC", "NMDPRA"],
    color: "#1D4ED8",
  },
  {
    id: "power",
    title: "Power Sector Settlement",
    caption: "GenCo invoices versus payments, market shortfall deficit, and ATC&C losses expressed in Naira.",
    agencies: ["NERC", "NBET", "TCN"],
    color: "#B45309",
  },
  {
    id: "renewable",
    title: "Renewable Energy Investment",
    caption: "Solar and wind capacity trends, FiT obligations versus actual payments, and mini-grid capex by state.",
    agencies: ["REA", "NERC"],
    color: "#0E7A3C",
  },
  {
    id: "bioenergy",
    title: "Bioenergy & Solid Fuels",
    caption: "Biomass consumption by state, coal export earnings in USD, and fuelwood displacement by LPG penetration.",
    agencies: ["ECN", "MMSD"],
    color: "#78350F",
  },
  {
    id: "faac",
    title: "FAAC Energy Contribution",
    caption: "Monthly oil revenue share of total FAAC pool versus Federal budget projection, by RMAFC formula.",
    agencies: ["RMAFC", "DMO", "CBN"],
    color: "#C0392B",
  },
];

const OVERVIEW_METRICS = [
  { label: "Crude Oil Production", value: "85.1M", unit: "Barrels", change: "+13.3%", up: true, period: "Dec 2024" },
  { label: "Electricity Generation", value: "3,241", unit: "GWh", change: "+4.1%", up: true, period: "Q4 2024" },
  { label: "PMS Sales Volume", value: "1.82B", unit: "Litres", change: "-2.3%", up: false, period: "Q3 2024" },
  { label: "Natural Gas Produced", value: "196.4", unit: "Bcf", change: "+7.8%", up: true, period: "Q4 2024" },
];

const DOWNSTREAM_TABLE = [
  { company: "Abuja DisCo",     atc: 42.3, collection: 78.2,  state: "FCT"   },
  { company: "Eko DisCo",       atc: 38.1, collection: 82.5,  state: "Lagos" },
  { company: "Ikeja DisCo",     atc: 35.7, collection: 85.1,  state: "Lagos" },
  { company: "Ibadan DisCo",    atc: 51.2, collection: 68.4,  state: "Oyo"   },
  { company: "Enugu DisCo",     atc: 48.6, collection: 71.3,  state: "Enugu" },
  { company: "Port Harcourt DisCo", atc: 44.9, collection: 74.7, state: "Rivers" },
  { company: "Kano DisCo",      atc: 55.3, collection: 62.1,  state: "Kano"  },
  { company: "Kaduna DisCo",    atc: 53.8, collection: 65.9,  state: "Kaduna"},
];

const ALERTS = [
  { level: "high",   msg: "Abuja DisCo ATC&C loss exceeded 40% threshold for 3rd consecutive month.", time: "2 hours ago" },
  { level: "medium", msg: "Natural gas production volume shows 18% deviation from 3-month rolling average.", time: "6 hours ago" },
  { level: "medium", msg: "PMS national stock level below 14-day buffer — potential supply stress.", time: "Yesterday" },
  { level: "low",    msg: "Electricity generation data for November not yet submitted by 3 DisCos.", time: "2 days ago" },
  { level: "low",    msg: "Crude oil production CAGR updated following NUPRC Q4 reconciliation.", time: "3 days ago" },
];

export default function Dashboard() {
  const router = useRouter();
  const [view, setView] = useState("overview");
  const [clock, setClock] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/data-point/dashboard"); return; }
    setStaffName(getFullName() || "Staff");
    setStaffRole(getRole() || "staff");
    const tick = () => setClock(new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [router]);

  function logout() {
    clearTokens();
    router.replace("/data-point/login");
  }

  // Group nav items by section
  const sections = [...new Set(NAV.map((n) => n.section))];

  return (
    <div className="dash-wrap">
      {/* ── SIDEBAR ── */}
      <aside className="dash-sidebar">
        <div className="sb-brand">
          <div className="sb-seal"><CoatOfArms size={28} /></div>
          <div>
            <div className="sb-name">NEDB</div>
            <div className="sb-system">Intelligence Suite</div>
          </div>
        </div>

        {sections.map((sec) => (
          <div key={sec}>
            <div className="sb-section">{sec}</div>
            {NAV.filter((n) => n.section === sec).map((item) => (
              <button
                key={item.id}
                className={`sb-link${view === item.id ? " active" : ""}`}
                onClick={() => !item.soon && setView(item.id)}
                style={item.soon ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              >
                <span className="sb-label">{item.label}</span>
                {item.soon && (
                  <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", padding: "1px 5px", borderRadius: 3, letterSpacing: "0.05em" }}>
                    SOON
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}

        <div style={{ marginTop: "auto" }}>
          {/* Staff identity */}
          <div style={{ padding: "0.875rem 1rem", borderTop: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>{staffName}</div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {staffRole === "admin" ? "Administrator" : "Energy Staff"}
            </div>
          </div>

          <div style={{ padding: "0.5rem 0", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {staffRole === "admin" && (
              <Link href="/data-point/admin" className="sb-link">
                <span className="sb-label">Manage Staff Accounts</span>
                <span style={{ fontSize: "0.6rem", background: "var(--green)", color: "#fff", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>ADMIN</span>
              </Link>
            )}
            <Link href="/" className="sb-link">
              <span className="sb-label">Public Data Bank</span>
            </Link>
            <button className="sb-link" onClick={logout} style={{ color: "rgba(192,57,43,0.8)" }}>
              <span className="sb-label">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="dash-main">
        {/* Topbar */}
        <div className="dash-topbar">
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {NAV.find((n) => n.id === view)?.label ?? "Overview"}
            </span>
            <span style={{ marginLeft: 12, fontSize: "0.72rem", color: "var(--ink-4)" }}>
              NEDB Intelligence Suite &nbsp;·&nbsp; Energy Commission of Nigeria
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--ink-4)" }}>
              {staffName}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--ink-3)" }}>
              {clock}
            </span>
            <span className="tag tag-green">
              <span className="live-dot" />
              Live
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="dash-content">
          {/* ── OVERVIEW ── */}
          {view === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
                {OVERVIEW_METRICS.map((m) => (
                  <div key={m.label} className="metric-card" style={{ border: "none", borderRadius: 0 }}>
                    <div className="mc-label">{m.label}</div>
                    <div className="mc-value">{m.value} <span style={{ fontSize: "0.75rem", color: "var(--ink-4)", fontFamily: "var(--font-sans)" }}>{m.unit}</span></div>
                    <div className={`mc-trend ${m.up ? "up" : "down"}`}>
                      {m.up ? "+" : ""}{m.change} &nbsp;·&nbsp; <span style={{ fontWeight: 400, color: "var(--ink-5)" }}>{m.period}</span>
                    </div>
                  </div>
                ))}
              </div>

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
                    <span className="tag tag-red" style={{ fontSize: "0.6rem" }}>2 High</span>
                  </div>
                  <div className="panel-body" style={{ padding: "0 1.25rem" }}>
                    {ALERTS.map((a, i) => (
                      <div key={i} className="alert-row">
                        <span className={`alert-dot ${a.level}`} />
                        <div className="alert-body">
                          {a.msg}
                          <div className="alert-time">{a.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Coming soon fiscal panels */}
              <div>
                <div className="sec-hd" style={{ marginBottom: "1rem" }}>
                  <h2>Fiscal Intelligence Panels</h2>
                  <span className="sec-hd-meta">Data integration in progress</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
                  {FISCAL_PANELS.map((panel) => (
                    <div key={panel.id} className="cs-panel">
                      <div className="cs-ghost">
                        {[70, 40, 55, 30, 60, 45, 80, 35, 50].map((w, i) => (
                          <div key={i} className="cs-ghost-bar" style={{ width: `${w}%` }} />
                        ))}
                      </div>
                      <div className="cs-overlay">
                        <div className="cs-agencies">
                          {panel.agencies.map((ag) => (
                            <span key={ag} className="cs-agency-tag" style={{ background: `${panel.color}18`, color: panel.color, border: `1px solid ${panel.color}30` }}>
                              {ag}
                            </span>
                          ))}
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
                  { label: "Avg ATC&C Loss (National)", value: "46.2%", trend: "down", change: "-1.8pp vs Q3" },
                  { label: "Collection Efficiency", value: "73.5%", trend: "up", change: "+2.1pp vs Q3" },
                  { label: "Market Shortfall (Cumulative)", value: "N4.1T", trend: "down", change: "FY 2024" },
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
                  <span className="panel-title">Distribution Companies — ATC&C Loss & Collection Efficiency</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>Source: NERC Q4 2024</span>
                </div>
                <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Distribution Company</th>
                        <th>State</th>
                        <th className="td-num">ATC&C Loss (%)</th>
                        <th className="td-num">Collection Efficiency (%)</th>
                        <th>Performance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DOWNSTREAM_TABLE.map((row, i) => (
                        <tr key={row.company}>
                          <td style={{ color: "var(--ink-5)", fontSize: "0.72rem" }}>{i + 1}</td>
                          <td className="td-primary">{row.company}</td>
                          <td>{row.state}</td>
                          <td className="td-num td-mono" style={{ color: row.atc > 50 ? "var(--red)" : row.atc > 40 ? "var(--amber)" : "var(--green)" }}>
                            {row.atc.toFixed(1)}%
                          </td>
                          <td className="td-num td-mono" style={{ color: row.collection >= 80 ? "var(--green)" : row.collection >= 70 ? "var(--amber)" : "var(--red)" }}>
                            {row.collection.toFixed(1)}%
                          </td>
                          <td>
                            <span className={`tag ${row.atc < 40 ? "tag-green" : row.atc < 50 ? "tag-amber" : "tag-red"}`}>
                              {row.atc < 40 ? "Above Target" : row.atc < 50 ? "Moderate" : "Critical"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Anomaly Feed — Downstream</span>
                </div>
                <div className="panel-body" style={{ padding: "0 1.25rem" }}>
                  {ALERTS.slice(0, 3).map((a, i) => (
                    <div key={i} className="alert-row">
                      <span className={`alert-dot ${a.level}`} />
                      <div className="alert-body">
                        {a.msg}
                        <div className="alert-time">{a.time}</div>
                      </div>
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
                Revenue Portal is under active development. Company registry is available below; financial flow data will be published upon completion of agency data agreements.
              </div>
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Producing Companies Registry</span>
                </div>
                <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Company</th>
                        <th>OML Block(s)</th>
                        <th>Operator Type</th>
                        <th>Sector</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { co: "NNPC Ltd", oml: "OML 118, 119, 130", type: "National", sector: "Upstream", status: "Active" },
                        { co: "Shell SPDC", oml: "OML 11, 17, 21, 22", type: "IOC JV", sector: "Upstream", status: "Active" },
                        { co: "TotalEnergies EP", oml: "OML 58, 99, 100", type: "IOC JV", sector: "Upstream", status: "Active" },
                        { co: "Chevron Nigeria", oml: "OML 49, 90, 91", type: "IOC JV", sector: "Upstream", status: "Active" },
                        { co: "Seplat Energy", oml: "OML 4, 38, 41", type: "Indigenous", sector: "Upstream", status: "Active" },
                        { co: "Oando PLC", oml: "OML 60, 61, 62, 63", type: "Indigenous", sector: "Upstream", status: "Active" },
                      ].map((row) => (
                        <tr key={row.co}>
                          <td className="td-primary">{row.co}</td>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{row.oml}</td>
                          <td>{row.type}</td>
                          <td><span className="tag tag-green" style={{ fontSize: "0.62rem" }}>{row.sector}</span></td>
                          <td><span className="live-dot" style={{ marginRight: 6 }} />{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
                {FISCAL_PANELS.slice(0, 3).map((panel) => (
                  <div key={panel.id} className="cs-panel">
                    <div className="cs-ghost">
                      {[70, 40, 55, 30, 60, 45, 80].map((w, i) => (
                        <div key={i} className="cs-ghost-bar" style={{ width: `${w}%` }} />
                      ))}
                    </div>
                    <div className="cs-overlay">
                      <div className="cs-agencies">
                        {panel.agencies.map((ag) => (
                          <span key={ag} className="cs-agency-tag" style={{ background: `${panel.color}18`, color: panel.color, border: `1px solid ${panel.color}30` }}>
                            {ag}
                          </span>
                        ))}
                      </div>
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
