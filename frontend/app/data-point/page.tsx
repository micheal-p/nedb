import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

const CAPABILITIES = [
  {
    label: "Sector",
    title: "Upstream Revenue Intelligence",
    desc: "Royalty streams, PPT settlements, profit-oil splits and signature bonuses disaggregated by OML block and producing company. Sourced from NUPRC and FIRS transaction-level data.",
    agencies: ["NUPRC", "FIRS", "NNPC"],
    status: "in-development",
  },
  {
    label: "Sector",
    title: "Downstream Market Monitoring",
    desc: "Verified petroleum product distribution volumes, pump price compliance, and strategic reserve levels across all 36 states. Updated from NMDPRA licensed depot records.",
    agencies: ["NMDPRA", "NNPCL", "DPR"],
    status: "active",
  },
  {
    label: "Sector",
    title: "Power Sector Settlement",
    desc: "GenCo invoice versus payment matrices, market shortfall accounting, and ATC&C loss benchmarking per DisCo expressed in Naira. Source: NBET market settlement reports.",
    agencies: ["NERC", "NBET", "TCN"],
    status: "in-development",
  },
  {
    label: "Fiscal",
    title: "FAAC Energy Contribution Analysis",
    desc: "Monthly oil revenue as a share of total FAAC pool, benchmarked against the Medium-Term Revenue Framework projection. Includes derivation fund disaggregation by oil-producing state.",
    agencies: ["RMAFC", "DMO", "CBN"],
    status: "in-development",
  },
  {
    label: "Sector",
    title: "Renewable Energy Investment Tracker",
    desc: "Installed solar and wind capacity trends by state, FiT obligation versus disbursement, REF-backed mini-grid project pipeline, and off-grid access rates.",
    agencies: ["REA", "NERC", "ECN"],
    status: "in-development",
  },
  {
    label: "Sector",
    title: "Bioenergy & Solid Fuels",
    desc: "Biomass consumption by state and end-use, coal export earnings in USD, charcoal production volumes, and LPG penetration displacement of fuelwood demand.",
    agencies: ["ECN", "MMSD", "NBS"],
    status: "in-development",
  },
];

const STATUS_LABEL: Record<string, string> = {
  active: "Available",
  "in-development": "In Development",
};

export default function DataPointLanding() {
  return (
    <>
      <Navbar active="datapoint" />

      {/* Hero */}
      <div style={{ background: "var(--ink)", color: "#fff", padding: "5rem 2rem 4rem", borderBottom: "3px solid var(--green)" }}>
        <div style={{ maxWidth: "var(--max-w)", margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green-mid)", border: "1px solid rgba(14,122,60,0.35)", padding: "4px 12px", borderRadius: "var(--r-sm)", marginBottom: "1.25rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green-mid)", display: "inline-block" }} />
            NEDB Intelligence Suite
          </div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 400, lineHeight: 1.1, marginBottom: "1rem" }}>
            Energy data for those<br />
            <em style={{ fontStyle: "italic", color: "rgba(255,255,255,0.6)" }}>who make decisions.</em>
          </h1>
          <p style={{ fontSize: "1rem", color: "rgba(255,255,255,0.6)", maxWidth: 580, lineHeight: 1.7, marginBottom: "2.5rem" }}>
            Data Point is the analytical intelligence layer of NEDB, providing authorised ECN staff,
            regulators and designated agency personnel with cross-sector energy intelligence panels,
            fiscal reconciliation dashboards, and automated anomaly detection.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Link href="/data-point/login" className="btn btn-primary btn-lg">
              Access Intelligence Suite
            </Link>
            <Link href="/" className="btn btn-ghost btn-lg">
              Public Data Bank
            </Link>
          </div>
        </div>
      </div>

      {/* Access notice */}
      <div style={{ background: "var(--amber-tint)", borderBottom: "1px solid rgba(180,83,9,0.2)", padding: "1rem 2rem" }}>
        <div style={{ maxWidth: "var(--max-w)", margin: "0 auto", display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.8rem" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <span style={{ color: "var(--amber)" }}>
            <strong>Restricted Access:</strong> The Intelligence Suite is available exclusively to authorised ECN staff
            and designated agency liaisons. Public energy data is freely accessible via the{" "}
            <Link href="/" style={{ color: "var(--amber)", fontWeight: 700, textDecoration: "underline" }}>NEDB Data Bank</Link>.
          </span>
        </div>
      </div>

      {/* Capability panels */}
      <main style={{ background: "var(--surface)", padding: "3rem 0 5rem" }}>
        <div className="page-wrap">
          <div className="sec-hd">
            <h2>Intelligence Panels</h2>
            <span className="sec-hd-meta">Data integration across 6 energy sector modules</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden", marginBottom: "3rem" }}>
            {CAPABILITIES.map((cap) => (
              <div key={cap.title} style={{ background: "var(--surface-white)", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="tag tag-muted">{cap.label}</span>
                  <span className={`tag ${cap.status === "active" ? "tag-green" : "tag-amber"}`}>
                    {cap.status === "active" && <span className="live-dot" style={{ marginRight: 4 }} />}
                    {STATUS_LABEL[cap.status]}
                  </span>
                </div>
                <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1.3 }}>{cap.title}</h3>
                <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", lineHeight: 1.65 }}>{cap.desc}</p>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: "0.25rem" }}>
                  {cap.agencies.map((ag) => (
                    <span key={ag} style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.05em", background: "var(--green-strong)", color: "var(--green-deep)", border: "1px solid var(--green-line)", padding: "2px 7px", borderRadius: "var(--r-sm)" }}>
                      {ag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Positioning statement */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
            <div className="panel">
              <div className="panel-header"><span className="panel-title">Why Data Point Exists</span></div>
              <div className="panel-body" style={{ fontSize: "0.82rem", color: "var(--ink-3)", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <p>
                  The Nigeria Extractive Industries Transparency Initiative (NEITI) publishes its
                  reconciliation reports with an average lag of 2 years from the reference period.
                  The Federal Budget Office and Finance Ministry require energy fiscal data on a
                  monthly cadence to inform borrowing decisions and FAAC projections.
                </p>
                <p>
                  Data Point closes that gap: a real-time, agency-reconciled alternative to the
                  annual NEITI report, designed for the Ministry of Finance, the National Assembly
                  Budget Office, and licensed investors requiring NEDB Data Vault access.
                </p>
                <p>
                  All fiscal panels are currently in active integration with source agencies.
                  The first release covering Upstream Revenue and FAAC Energy Contribution
                  is targeted for Q3 2026.
                </p>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><span className="panel-title">Target Users</span></div>
              <div className="panel-body">
                {[
                  { role: "ECN Policy Unit", desc: "Cross-sector monitoring and brief preparation for the Minister of Power." },
                  { role: "Ministry of Finance / Budget Office", desc: "Oil revenue tracking, FAAC energy contribution, and fiscal year variance analysis." },
                  { role: "NERC / NUPRC Regulators", desc: "Licence compliance monitoring, tariff performance, and ATC&C benchmarking." },
                  { role: "Institutional Investors (Data Vault)", desc: "Licensed access to disaggregated upstream production and revenue data for investment due diligence." },
                  { role: "National Assembly Budget Office", desc: "Independent verification of executive energy revenue projections against actual FAAC receipts." },
                ].map((u) => (
                  <div key={u.role} style={{ display: "flex", gap: 12, padding: "0.75rem 0", borderBottom: "1px solid var(--border-soft)" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", marginTop: 6, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>{u.role}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--ink-4)", lineHeight: 1.5 }}>{u.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
