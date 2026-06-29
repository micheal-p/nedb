import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { api } from "@/lib/api";

async function getSeries() {
  try { return await api.listSeries(); }
  catch { return []; }
}

const SECTOR_META: Record<string, { label: string; desc: string; subsectors: string }> = {
  petroleum: {
    label: "Petroleum Statistics",
    desc: "Upstream production, downstream distribution and retail sales of crude oil and refined petroleum products across all depots and filling stations.",
    subsectors: "Upstream · Downstream · Midstream",
  },
  electricity: {
    label: "Electricity Statistics",
    desc: "Generation capacity, energy sent-out, transmission losses and end-use consumption data drawn from NERC licence reports and TCN dispatch records.",
    subsectors: "Generation · Transmission · Distribution · Consumption",
  },
  biomass: {
    label: "Biomass, Coal & Solid Fuels",
    desc: "Traditional biomass consumption, commercial charcoal production, solid mineral coal output and exports, disaggregated by state and sub-sector.",
    subsectors: "Fuelwood · Charcoal · Coal · Solid Minerals",
  },
};

const ACTS = [
  {
    year: "2004",
    name: "Energy Commission of Nigeria Act",
    ref: "CAP. E10 LFN 2004",
    desc: "Establishes the ECN mandate to coordinate and advise the Federal Government on all matters relating to energy in Nigeria, including this data bank.",
  },
  {
    year: "2021",
    name: "Petroleum Industry Act (PIA)",
    ref: "Act No. 6 of 2021",
    desc: "Restructures the petroleum sector, establishes NUPRC and NMDPRA as successor regulators, and mandates open data publication of oil and gas statistics.",
  },
  {
    year: "2006",
    name: "Electric Power Sector Reform Act (EPSRA)",
    ref: "Act No. 6 of 2005",
    desc: "Deregulates the electricity sector, creates NERC, and requires NERC to maintain and publish comprehensive generation and distribution statistics.",
  },
  {
    year: "2023",
    name: "National Energy Transition Plan",
    ref: "Federal Government of Nigeria",
    desc: "Commits Nigeria to net-zero by 2060 with sector-specific targets for renewables, gas-to-power, and energy efficiency — all tracked through NEDB.",
  },
  {
    year: "1999",
    name: "National Petroleum Investment Management Services Act",
    ref: "NAPIMS / NNPC Act",
    desc: "Regulates upstream joint ventures and production-sharing contracts; production and cost-recovery data from these contracts feeds into NEDB crude series.",
  },
  {
    year: "2007",
    name: "Renewable Energy Master Plan",
    ref: "ECN / REMP",
    desc: "Sets renewable energy targets and defines the data-collection obligations for REA, ECN and state energy commissions that NEDB aggregates.",
  },
];

export default async function Home() {
  const series = await getSeries();
  const bySector = series.reduce((acc, s) => {
    if (!acc[s.sector]) acc[s.sector] = [];
    acc[s.sector].push(s);
    return acc;
  }, {} as Record<string, typeof series>);
  const totalRecords = series.reduce((sum, s) => sum + s.record_count, 0);

  return (
    <>
      <Navbar active="databank" />

      {/* ── INSTITUTIONAL HERO ── */}
      <div className="inst-hero">
        <div className="container">
          <div className="mandate-tag">
            <span className="dot" />
            ECN / NEDB · National Energy Data Bank
          </div>
          <h1>
            Nigeria&apos;s authoritative<br />
            <em>energy statistics platform.</em>
          </h1>
          <p className="lead">
            The National Energy Data Bank (NEDB) is an initiative of the Energy Commission of Nigeria
            (ECN), established to serve as the nation&apos;s primary repository and dissemination
            platform for comprehensive, validated energy data across all fuels, sectors and states.
          </p>
          <div className="stat-row">
            <div className="stat">
              <div className="num">{series.length}</div>
              <div className="lbl">Tracked Series</div>
            </div>
            <div className="stat">
              <div className="num accent">{totalRecords.toLocaleString()}</div>
              <div className="lbl">Data Records</div>
            </div>
            <div className="stat">
              <div className="num">36 + FCT</div>
              <div className="lbl">State Coverage</div>
            </div>
            <div className="stat">
              <div className="num">Monthly</div>
              <div className="lbl">Update Frequency</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MANDATE BAND ── */}
      <div className="info-band">
        <div className="container">
          <div className="cols">
            <div>
              <div className="col-label">Mandate</div>
              <p>
                NEDB aggregates energy data from NUPRC, NERC, NMDPRA, NBS, NGC and state energy
                agencies into a single, standards-compliant repository for policy analysis,
                regulatory oversight and public transparency.
              </p>
            </div>
            <div>
              <div className="col-label">Data Standards</div>
              <p>
                Records conform to IEA / UN Energy Statistics Recommendations. Each series carries
                explicit unit codes, source attribution, methodology versioning and region codes
                aligned to ISO 3166-2:NG.
              </p>
            </div>
            <div>
              <div className="col-label">Access Policy</div>
              <p>
                Statistical tables are publicly accessible without registration. Upstream upload,
                revision and commit operations require ECN staff authentication via the Staff
                Upload Portal.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SERIES CATALOGUE ── */}
      <main style={{ background: "var(--surface)", padding: "2.5rem 0 4rem" }}>
        <div className="page-wrap">

          {/* Sector sub-nav */}
          <div className="sub-nav" style={{ marginBottom: "2rem", marginLeft: "-2rem", marginRight: "-2rem", paddingLeft: "2rem" }}>
            <Link href="/" className="sub-nav-link active">
              All Sectors
              <span className="count">{series.length}</span>
            </Link>
            {Object.keys(SECTOR_META).map((sec) => (
              <a key={sec} href={`#sector-${sec}`} className="sub-nav-link">
                {SECTOR_META[sec].label}
                <span className="count">{(bySector[sec] ?? []).length}</span>
              </a>
            ))}
          </div>

          {Object.entries(SECTOR_META).map(([sector, meta]) => {
            const items = bySector[sector] ?? [];
            if (!items.length) return null;
            return (
              <section key={sector} id={`sector-${sector}`} style={{ marginBottom: "3rem" }}>
                <div className="sec-hd">
                  <div>
                    <h2>{meta.label}</h2>
                    <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", marginTop: 4, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                      {meta.desc}
                    </p>
                    <p style={{ fontSize: "0.68rem", color: "var(--ink-5)", marginTop: 2, letterSpacing: "0.05em" }}>
                      {meta.subsectors}
                    </p>
                  </div>
                  <span className="sec-hd-meta">{items.length} series</span>
                </div>

                <div className="series-grid">
                  {items.map((s) => (
                    <Link key={s.id} href={`/series/${s.id}`} className="series-cell">
                      <div className="series-meta">
                        <span className="tag tag-green">{s.frequency}</span>
                        {s.record_count > 0 && (
                          <span className="tag tag-muted">
                            {s.record_count.toLocaleString()} records
                          </span>
                        )}
                      </div>
                      <div className="series-name">{s.name}</div>
                      <div style={{ display: "flex", gap: "1.5rem", margin: "0.625rem 0" }}>
                        <div>
                          <div style={{ fontSize: "1.375rem", fontFamily: "var(--font-mono)", fontWeight: 600, lineHeight: 1, color: s.record_count > 0 ? "var(--ink)" : "var(--ink-5)" }}>
                            {s.record_count > 0 ? s.record_count.toLocaleString() : "—"}
                          </div>
                          <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Records</div>
                        </div>
                        <div>
                          <div style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--ink-3)", lineHeight: 1.5 }}>{s.unit_default}</div>
                          <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>Unit</div>
                        </div>
                      </div>
                      <div className="viz-chips">
                        {s.viz_types.map((vt) => (
                          <span key={vt} className="viz-chip">{vt}</span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}

          {series.length === 0 && (
            <div style={{ textAlign: "center", padding: "6rem 0" }}>
              <p style={{ fontSize: "0.95rem", color: "var(--ink-3)", marginBottom: "1rem" }}>
                No series data available.
              </p>
              <p style={{ fontSize: "0.82rem", color: "var(--ink-4)" }}>
                Contact the NEDB administrator to initialise the database.
              </p>
            </div>
          )}

          {/* ── LEGAL FRAMEWORK ── */}
          <section style={{ marginTop: "4rem", marginBottom: "2rem" }}>
            <div className="sec-hd">
              <h2>Legal &amp; Policy Framework</h2>
              <span className="sec-hd-meta">Acts, regulations &amp; policy instruments</span>
            </div>
            <div className="acts-grid">
              {ACTS.map((act) => (
                <div key={act.ref} className="act-card">
                  <div className="act-year">{act.year} &nbsp;·&nbsp; {act.ref}</div>
                  <div className="act-name">{act.name}</div>
                  <div className="act-desc">{act.desc}</div>
                  <div className="act-link">
                    View instrument
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 17L17 7M17 7H7M17 7v10"/>
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── UPLOAD CTA ── */}
          <div style={{
            background: "var(--ink)",
            borderRadius: "var(--r-lg)",
            padding: "2.5rem",
            marginTop: "3rem",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gap: "2rem",
          }}>
            <div>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green-mid)", marginBottom: "0.5rem" }}>
                Staff Upload Portal
              </div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>
                Authorised ECN / agency staff
              </h3>
              <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.5)", maxWidth: 480 }}>
                Upload official energy datasets in CSV or XLSX format. Row-by-row validation
                with inline error reporting before final commit to the database. Authentication
                required.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flexShrink: 0 }}>
              <Link href="/upload" className="btn btn-primary">
                Upload Dataset
              </Link>
              <Link href="/data-point/login" className="btn btn-ghost">
                Staff Login
              </Link>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
