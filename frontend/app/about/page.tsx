import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";

const MILESTONES = [
  { year: "1979", event: "Energy Commission of Nigeria (ECN) established by decree to coordinate national energy policy and advise the Federal Government." },
  { year: "2004", event: "ECN Act, CAP. E10 LFN 2004 — consolidates the ECN mandate and gives statutory backing to energy data collection and publication obligations." },
  { year: "2006", event: "National Energy Policy published, articulating data-driven targets across petroleum, electricity, renewable and biomass sectors." },
  { year: "2021", event: "Petroleum Industry Act (PIA) creates NUPRC and NMDPRA, mandating structured data publication — bringing petroleum sector data into NEDB scope." },
  { year: "2023", event: "National Energy Transition Plan released, creating a tracking obligation for renewable capacity, gas-to-power, and biomass displacement." },
  { year: "2025", event: "NEDB Platform v1.0 launched — first fully digital, API-accessible repository of Nigerian energy statistics with validated upload workflow." },
];

const DATA_SERIES = [
  { sector: "Petroleum", count: 5, series: ["Crude Oil Production", "PMS Sales", "AGO (Diesel) Sales", "LPG Distribution", "Natural Gas Production"] },
  { sector: "Electricity", count: 4, series: ["Electricity Generation", "Electricity Sent Out", "Electricity Consumption", "Grid Losses"] },
  { sector: "Biomass & Solid Fuels", count: 3, series: ["Fuelwood Consumption", "Charcoal Production", "Coal Output & Exports"] },
];

export default function AboutPage() {
  return (
    <>
      <Navbar active="about" />

      <div style={{ background: "var(--ink)", color: "#fff", padding: "4rem 2rem 3rem", borderBottom: "3px solid var(--green)" }}>
        <div style={{ maxWidth: "var(--max-w)", margin: "0 auto" }}>
          <div style={{ display: "flex", gap: "3rem", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green-mid)", marginBottom: "0.875rem" }}>
                About NEDB
              </div>
              <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 400, lineHeight: 1.12, marginBottom: "1.25rem" }}>
                National Energy Data Bank
              </h1>
              <p style={{ fontSize: "0.95rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.75, maxWidth: 560 }}>
                NEDB is an initiative of the Energy Commission of Nigeria (ECN), established to serve
                as the nation&apos;s primary statutory repository and dissemination platform for
                comprehensive, validated energy statistics across all fuels, sectors and states.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "var(--r-lg)", overflow: "hidden", flexShrink: 0 }}>
              {[
                { num: "12", lbl: "Active Series" },
                { num: "36 + FCT", lbl: "State Coverage" },
                { num: "Monthly", lbl: "Update Cycle" },
                { num: "1960+", lbl: "Earliest Data" },
              ].map((s) => (
                <div key={s.lbl} style={{ padding: "1.25rem 1.5rem" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 700, color: "#fff", lineHeight: 1 }}>{s.num}</div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <main style={{ background: "var(--surface)", padding: "3rem 0 5rem" }}>
        <div className="page-wrap" style={{ display: "flex", flexDirection: "column", gap: "3.5rem" }}>

          {/* Mandate */}
          <section>
            <div className="sec-hd"><h2>Statutory Mandate</h2></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div className="panel">
                <div className="panel-header"><span className="panel-title">Collection Mandate</span></div>
                <div className="panel-body" style={{ fontSize: "0.82rem", color: "var(--ink-3)", lineHeight: 1.8 }}>
                  <p>
                    Under Section 5 of the Energy Commission of Nigeria Act (CAP. E10, LFN 2004),
                    the ECN is mandated to collect, compile, and publish energy statistics for all
                    energy carriers including petroleum, electricity, renewables, and solid fuels.
                  </p>
                  <p style={{ marginTop: "0.75rem" }}>
                    NEDB operationalises this mandate by providing a centralised digital infrastructure
                    for data submission by licensed agencies (NUPRC, NERC, NMDPRA, NGC), validation
                    against IEA/UN Energy statistical standards, and public dissemination.
                  </p>
                </div>
              </div>
              <div className="panel">
                <div className="panel-header"><span className="panel-title">Agency Data Agreements</span></div>
                <div className="panel-body">
                  <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginBottom: "0.875rem" }}>
                    NEDB receives data under formal MoUs with the following agencies:
                  </p>
                  {[
                    ["NUPRC", "Upstream petroleum production and reserves"],
                    ["NMDPRA", "Downstream products distribution"],
                    ["NERC", "Electricity generation, transmission, distribution"],
                    ["NGC", "Natural gas transmission throughput"],
                    ["NBS", "Household energy consumption surveys"],
                    ["MMSD", "Solid minerals and coal statistics"],
                  ].map(([ag, desc]) => (
                    <div key={ag} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "0.5rem 0", borderBottom: "1px solid var(--border-soft)" }}>
                      <span style={{ background: "var(--green-strong)", color: "var(--green-deep)", border: "1px solid var(--green-line)", fontSize: "0.62rem", fontWeight: 700, padding: "2px 6px", borderRadius: "var(--r-sm)", flexShrink: 0, marginTop: 2 }}>{ag}</span>
                      <span style={{ fontSize: "0.78rem", color: "var(--ink-4)" }}>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Methodology */}
          <section>
            <div className="sec-hd"><h2>Data Methodology & Standards</h2></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
              {[
                { title: "Period Formats", body: "NEDB accepts annual (YYYY), quarterly (YYYY-QN), and monthly (YYYY-MM) data. Periods are normalised to ISO 8601 for consistent ordering and gap detection." },
                { title: "Unit Codelist", body: "All records carry an explicit unit code from the NEDB codelist (Barrels, GWh, MW, Bcf, Litres, MT, Tonnes). Unit validation is enforced at upload." },
                { title: "Region Codes", body: "Regional disaggregation uses ISO 3166-2:NG state codes (e.g., NG-LA for Lagos) or NGA for national aggregate. Sub-national records can be summed to national totals." },
                { title: "Source Attribution", body: "Every record carries the originating agency's identifier (e.g., NUPRC, NERC). Source is mandatory at upload and preserved through all revisions." },
                { title: "Methodology Versioning", body: "Each record carries a methodology_version tag (v1, v2, etc.). When collection methodology changes, existing records are preserved and new records tagged with the revised version." },
                { title: "Computed Statistics", body: "YoY, MoM, CAGR and rolling averages are computed at query time from the committed record set, not pre-computed, ensuring they always reflect the latest data." },
              ].map((item) => (
                <div key={item.title} style={{ background: "var(--surface-white)", padding: "1.25rem" }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.5rem" }}>{item.title}</div>
                  <p style={{ fontSize: "0.8rem", color: "var(--ink-3)", lineHeight: 1.7 }}>{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Series coverage */}
          <section>
            <div className="sec-hd"><h2>Current Data Coverage</h2></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
              {DATA_SERIES.map((sec) => (
                <div key={sec.sector} className="panel">
                  <div className="panel-header">
                    <span className="panel-title">{sec.sector}</span>
                    <span style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>{sec.count} series</span>
                  </div>
                  <div>
                    {sec.series.map((s, i) => (
                      <div key={s} style={{ padding: "0.6rem 1.25rem", borderBottom: i < sec.series.length - 1 ? "1px solid var(--border-soft)" : "none", fontSize: "0.8rem", color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", flexShrink: 0 }} />
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* History */}
          <section>
            <div className="sec-hd"><h2>Institutional History</h2></div>
            <div className="panel">
              {MILESTONES.map((m, i) => (
                <div key={m.year} style={{ display: "flex", gap: "1.5rem", padding: "1.25rem", borderBottom: i < MILESTONES.length - 1 ? "1px solid var(--border-soft)" : "none" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", fontWeight: 700, color: "var(--green)", width: 44, flexShrink: 0 }}>{m.year}</div>
                  <p style={{ fontSize: "0.82rem", color: "var(--ink-3)", lineHeight: 1.65 }}>{m.event}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Contact */}
          <section>
            <div className="sec-hd"><h2>Access, Contact & Governance</h2></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div className="panel">
                <div className="panel-header"><span className="panel-title">Public Access Policy</span></div>
                <div className="panel-body" style={{ fontSize: "0.82rem", color: "var(--ink-3)", lineHeight: 1.8 }}>
                  <p>All statistical tables, time-series data, computed indicators and downloadable templates are freely accessible without registration. NEDB operates under an open data policy in accordance with the National Information Policy Framework.</p>
                  <Link href="/" className="btn btn-secondary btn-sm" style={{ marginTop: "1rem", display: "inline-flex" }}>Browse Data Bank</Link>
                </div>
              </div>
              <div className="panel">
                <div className="panel-header"><span className="panel-title">Contact the Data Management Unit</span></div>
                <div className="panel-body" style={{ fontSize: "0.82rem", color: "var(--ink-3)", lineHeight: 1.8 }}>
                  <p>For data quality reports, methodology queries, or agency submission arrangements:</p>
                  <div style={{ marginTop: "0.875rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    <strong style={{ color: "var(--ink)" }}>Energy Commission of Nigeria</strong>
                    <span>Plot 701C, Muhammadu Buhari Way, CBD, Abuja</span>
                    <span>data@ecnnigeria.org &nbsp;·&nbsp; +234 9 290 2815</span>
                    <a href="https://ecnnigeria.org" style={{ color: "var(--green)", fontWeight: 600, marginTop: 4 }}>ecnnigeria.org</a>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </>
  );
}
