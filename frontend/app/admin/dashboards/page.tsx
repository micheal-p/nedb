"use client";

// ── /admin/dashboards — Dashboard Builder (directory) ───────────────────────
// The home for the per-entity dashboard fleet. This first release is the
// read-only directory: every profile, who it's for, and where it lands. The
// no-code tab/widget composer plugs in from here next. Auth is enforced by
// the admin console shell (app/admin/layout.tsx).

import Link from "next/link";

type Profile = { key: string; label: string; role: string; view: string };

const VIEW_LABEL: Record<string, string> = {
  overview: "Overview", upstream: "Upstream", downstream: "Downstream",
  power: "Power & Grid", renewable: "Renewables", revenue: "Revenue",
};

const GROUPS: { title: string; sub: string; keys: string[] }[] = [
  { title: "Government Agencies & Parastatals", sub: "Each regulator lands on its own mandate", keys: ["presidency","ecn","nerc","nuprc","nmdpra","nnpcl","nemic","nrs","rea","tcn","firs","nbs"] },
  { title: "Analyst Personas", sub: "Cross-sector staff views", keys: ["executive","petroleum","electricity","renewables","fiscal"] },
  { title: "Investor Personas", sub: "External / institutional audiences", keys: ["investor_fdi","investor_capital","investor_infra","investor_renewable"] },
];

const PROFILES: Record<string, Profile> = Object.fromEntries(([
  {key:"presidency",label:"State House — Presidency",role:"National Energy Security Intelligence Brief",view:"overview"},
  {key:"ecn",label:"ECN — Energy Commission of Nigeria",role:"ECN National Energy Policy Intelligence",view:"overview"},
  {key:"nerc",label:"NERC — Electricity Regulatory Commission",role:"NERC Electricity Market Regulatory Dashboard",view:"downstream"},
  {key:"nuprc",label:"NUPRC — Upstream Petroleum Regulator",role:"NUPRC Upstream Petroleum Regulatory Dashboard",view:"upstream"},
  {key:"nmdpra",label:"NMDPRA — Midstream & Downstream Regulator",role:"NMDPRA Midstream & Downstream Regulatory Dashboard",view:"downstream"},
  {key:"nnpcl",label:"NNPC Limited",role:"NNPC Limited Operational Intelligence Dashboard",view:"upstream"},
  {key:"nemic",label:"NEMIC — Energy Management & Infrastructure",role:"NEMIC National Energy Management Intelligence",view:"power"},
  {key:"nrs",label:"NRS — Natural Resources Statistics",role:"NRS Natural Resources Statistical Dashboard",view:"overview"},
  {key:"rea",label:"REA — Rural Electrification Agency",role:"REA Rural Electrification & Off-Grid Dashboard",view:"renewable"},
  {key:"tcn",label:"TCN — Transmission Company of Nigeria",role:"TCN Grid Transmission Intelligence Dashboard",view:"power"},
  {key:"firs",label:"FIRS — Federal Inland Revenue Service",role:"FIRS Energy Sector Tax & Revenue Dashboard",view:"revenue"},
  {key:"nbs",label:"NBS — National Bureau of Statistics",role:"NBS Energy Sector Statistical Dashboard",view:"overview"},
  {key:"executive",label:"Executive Overview",role:"National Energy Intelligence Dashboard",view:"overview"},
  {key:"petroleum",label:"Petroleum & Gas Analyst",role:"Petroleum & Upstream Intelligence Dashboard",view:"downstream"},
  {key:"electricity",label:"Power & Grid Analyst",role:"Power Sector Intelligence Dashboard",view:"power"},
  {key:"renewables",label:"Clean Energy Analyst",role:"Renewables & Clean Energy Intelligence Dashboard",view:"renewable"},
  {key:"fiscal",label:"Fiscal & Revenue Analyst",role:"Fiscal Revenue Intelligence Dashboard",view:"revenue"},
  {key:"investor_fdi",label:"FDI Intelligence",role:"Foreign Direct Investment Intelligence Dashboard",view:"upstream"},
  {key:"investor_capital",label:"Capital Markets",role:"Energy Sector Capital Markets Intelligence Dashboard",view:"revenue"},
  {key:"investor_infra",label:"Infrastructure / Power",role:"Power & Infrastructure Investor Intelligence Dashboard",view:"power"},
  {key:"investor_renewable",label:"Renewable Investors",role:"Clean Energy Investment Intelligence Dashboard",view:"renewable"},
] as Profile[]).map((p) => [p.key, p]));

export default function DashboardBuilderPage() {
  return (
    <div style={{ background: "var(--surface)", minHeight: "100%", padding: "2rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.25rem" }}>Dashboards</div>
          <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Dashboard Builder</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--ink-4)", marginTop: "0.35rem", maxWidth: 640, lineHeight: 1.6 }}>
            One engine, {Object.keys(PROFILES).length} tailored dashboards. Each entity lands on its own view with its own headline
            indicators. Assign a profile to any staff account under <Link href="/admin" style={{ color: "var(--green)" }}>Administration → Users</Link>.
          </p>
        </div>

        <div style={{ background: "#fff", border: "1px solid var(--green-line)", borderLeft: "3px solid var(--green)", borderRadius: "var(--r-md)", padding: "0.875rem 1.1rem", marginBottom: "1.5rem", fontSize: "0.76rem", color: "var(--ink-3)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--ink-2)" }}>Coming next — the no-code composer:</strong> add or reorder tabs, and build brand-new tabs by
          picking data series, chart types, KPIs and maps — assigned to a whole profile or a single account. This directory is the entry point.
        </div>

        {GROUPS.map((g) => (
          <div key={g.title} style={{ marginBottom: "1.75rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: "0.75rem" }}>
              <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>{g.title}</h2>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>{g.sub}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.75rem" }}>
              {g.keys.map((k) => {
                const p = PROFILES[k];
                if (!p) return null;
                return (
                  <div key={k} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1rem 1.1rem", minWidth: 0, boxShadow: "0 1px 3px rgba(16,24,16,0.05)" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{p.label}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--ink-4)", lineHeight: 1.5, marginBottom: "0.6rem", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.role}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-5)" }}>Lands on</span>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--green)", background: "var(--green-tint)", border: "1px solid var(--green-line)", borderRadius: 3, padding: "1px 7px" }}>{VIEW_LABEL[p.view] ?? p.view}</span>
                      <code style={{ fontSize: "0.62rem", color: "var(--ink-5)", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>{p.key}</code>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
