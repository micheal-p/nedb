import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { db } from "@/lib/supabase-server";

function qualityScore(count: number, freq: string) {
  const expected = freq === "monthly" ? 318 : freq === "quarterly" ? 106 : 27;
  return Math.min(Math.round((count / expected) * 100), 100);
}

function QualityDots({ score }: { score: number }) {
  const filled = Math.max(0, Math.min(5, Math.ceil(score / 20)));
  const color = score >= 76 ? "#0E7A3C" : score >= 51 ? "#7CB342" : score >= 26 ? "#F9A825" : "#E04F39";
  const label = score >= 76 ? "Good" : score >= 51 ? "Moderate" : score >= 26 ? "Sparse" : score > 0 ? "Minimal" : "Empty";
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {[1,2,3,4,5].map((i) => (
        <span key={i} style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: i <= filled ? color : "var(--border)" }} title={`Data completeness: ${score}%`} />
      ))}
      <span style={{ fontSize: "0.6rem", color: "var(--ink-5)", marginLeft: 3 }}>{label}</span>
    </div>
  );
}

interface SeriesRow {
  id: string; name: string; sector: string; subsector: string | null;
  unit_default: string; frequency: string; viz_types: string[];
  created_at: string; record_count: number;
}

async function getSeries(): Promise<SeriesRow[]> {
  try {
    const { data } = await db()
      .from("series_types")
      .select("id, name, sector, subsector, unit_default, frequency, viz_types, created_at, energy_records(count)")
      .order("sector").order("name");
    return (data ?? []).map((s) => ({
      id: s.id as string, name: s.name as string, sector: s.sector as string,
      subsector: s.subsector as string | null, unit_default: s.unit_default as string,
      frequency: s.frequency as string, viz_types: s.viz_types as string[],
      created_at: s.created_at as string,
      record_count: (s.energy_records as { count: number }[] | null)?.[0]?.count ?? 0,
    }));
  } catch { return []; }
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
  gas: {
    label: "Gas Statistics",
    desc: "Natural gas production, domestic supply and LNG export volumes from NUPRC and NGC field reports.",
    subsectors: "Upstream · Midstream · Export",
  },
  biomass: {
    label: "Biomass & Solid Fuels",
    desc: "Traditional biomass consumption, commercial charcoal production, solid mineral coal output and exports, disaggregated by state.",
    subsectors: "Fuelwood · Charcoal · Coal",
  },
  renewable: {
    label: "Renewable Energy",
    desc: "Installed capacity and generation from solar, wind, hydro and other renewable sources tracked by REA and NERC.",
    subsectors: "Solar · Wind · Hydro · Mini-Grid",
  },
  solid_mineral: {
    label: "Solid Minerals",
    desc: "Coal and mineral production and export volumes from MMSD and NBS.",
    subsectors: "Coal · Minerals",
  },
};

const ACTS = [
  {
    year: "2004", name: "Energy Commission of Nigeria Act", ref: "CAP. E10 LFN 2004",
    desc: "Establishes the ECN mandate to coordinate and advise the Federal Government on all matters relating to energy in Nigeria, including this data bank.",
    pdf: "/documents/ecn_act.pdf",
  },
  {
    year: "2021", name: "Petroleum Industry Act (PIA)", ref: "Act No. 6 of 2021",
    desc: "Restructures the petroleum sector, establishes NUPRC and NMDPRA as successor regulators, and mandates open data publication of oil and gas statistics.",
    pdf: "/documents/Petroleum_Industry_Act_2021.pdf",
  },
  {
    year: "2006", name: "Electric Power Sector Reform Act (EPSRA)", ref: "Act No. 6 of 2005",
    desc: "Deregulates the electricity sector, creates NERC, and requires NERC to maintain and publish comprehensive generation and distribution statistics.",
    pdf: null,
  },
  {
    year: "2023", name: "National Energy Transition Plan", ref: "Federal Government of Nigeria",
    desc: "Commits Nigeria to net-zero by 2060 with sector-specific targets for renewables, gas-to-power, and energy efficiency — all tracked through NEDB.",
    pdf: "/documents/Energy_Policy_Document.pdf",
  },
  {
    year: "1999", name: "Hydrocarbon Oil Refinery Act", ref: "CAP. H5 LFN 2004",
    desc: "Regulates petroleum refining operations in Nigeria. Refinery throughput and capacity data from this regulatory framework feeds into NEDB downstream series.",
    pdf: "/documents/Hydrocarbon_Oil_Refinery_Act.pdf",
  },
  {
    year: "2007", name: "Petroleum Technology Development Fund Act", ref: "PTDF Act",
    desc: "Establishes PTDF and its mandate for petroleum technology development. Relevant to upstream capacity and local content data tracked in NEDB.",
    pdf: "/documents/Petroleum_Technology_Development_Fund_Act.pdf",
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

      {/* ── HERO ── */}
      <div className="inst-hero">
        <div className="container">
          <div className="mandate-tag"><span className="dot" />ECN / NEDB · National Energy Data Bank</div>
          <h1>Nigeria&apos;s authoritative<br /><em>energy statistics platform.</em></h1>
          <p className="lead">
            The National Energy Data Bank (NEDB) is an initiative of the Energy Commission of Nigeria (ECN),
            established as the nation&apos;s primary repository and dissemination platform for comprehensive,
            validated energy data across all fuels, sectors and states.
          </p>
          <div className="stat-row">
            <div className="stat"><div className="num">{series.length}</div><div className="lbl">Tracked Series</div></div>
            <div className="stat"><div className="num accent">{totalRecords.toLocaleString()}</div><div className="lbl">Data Records</div></div>
            <div className="stat"><div className="num">36 + FCT</div><div className="lbl">State Coverage</div></div>
            <div className="stat"><div className="num">Monthly</div><div className="lbl">Update Frequency</div></div>
          </div>
        </div>
      </div>

      {/* ── MANDATE BAND ── */}
      <div className="info-band">
        <div className="container">
          <div className="cols">
            <div>
              <div className="col-label">Mandate</div>
              <p>NEDB aggregates energy data from NUPRC, NERC, NMDPRA, NBS, NGC and state energy agencies into a single, standards-compliant repository for policy analysis, regulatory oversight and public transparency.</p>
            </div>
            <div>
              <div className="col-label">Data Standards</div>
              <p>Records conform to IEA / UN Energy Statistics Recommendations. Each series carries explicit unit codes, source attribution, methodology versioning and region codes aligned to ISO 3166-2:NG.</p>
            </div>
            <div>
              <div className="col-label">Access Policy</div>
              <p>Statistical tables are publicly accessible without registration. Upload, revision and commit operations require ECN staff authentication via the Staff Upload Portal.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SERIES CATALOGUE ── */}
      <main style={{ background: "var(--surface)", padding: "2.5rem 0 4rem" }}>
        <div className="page-wrap">

          <div className="sub-nav" style={{ marginBottom: "2rem", marginLeft: "-2rem", marginRight: "-2rem", paddingLeft: "2rem" }}>
            <Link href="/" className="sub-nav-link active">All Sectors<span className="count">{series.length}</span></Link>
            {Object.entries(SECTOR_META).filter(([sec]) => bySector[sec]?.length).map(([sec, meta]) => (
              <a key={sec} href={`#sector-${sec}`} className="sub-nav-link">
                {meta.label}<span className="count">{(bySector[sec] ?? []).length}</span>
              </a>
            ))}
            <Link href="/bulletin" className="sub-nav-link">Intelligence Bulletin</Link>
            <Link href="/compare" className="sub-nav-link">Compare Series</Link>
            <Link href="/request-data" className="sub-nav-link">Request Data</Link>
          </div>

          {Object.entries(SECTOR_META).map(([sector, meta]) => {
            const items = bySector[sector] ?? [];
            if (!items.length) return null;
            return (
              <section key={sector} id={`sector-${sector}`} style={{ marginBottom: "3rem" }}>
                <div className="sec-hd">
                  <div>
                    <h2>{meta.label}</h2>
                    <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", marginTop: 4, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{meta.desc}</p>
                    <p style={{ fontSize: "0.68rem", color: "var(--ink-5)", marginTop: 2, letterSpacing: "0.05em" }}>{meta.subsectors}</p>
                  </div>
                  <span className="sec-hd-meta">{items.length} series</span>
                </div>
                <div className="series-grid">
                  {items.map((s) => (
                    <Link key={s.id} href={`/series/${s.id}`} className="series-cell">
                      <div className="series-meta">
                        <span className="tag tag-green">{s.frequency}</span>
                        {s.record_count > 0 && <span className="tag tag-muted">{s.record_count.toLocaleString()} records</span>}
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
                        {s.viz_types.map((vt) => <span key={vt} className="viz-chip">{vt}</span>)}
                      </div>
                      <div style={{ marginTop: "0.5rem" }}>
                        <QualityDots score={qualityScore(s.record_count, s.frequency)} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}

          {series.length === 0 && (
            <div style={{ textAlign: "center", padding: "6rem 0" }}>
              <p style={{ fontSize: "0.95rem", color: "var(--ink-3)", marginBottom: "0.5rem" }}>No data records published yet.</p>
              <p style={{ fontSize: "0.82rem", color: "var(--ink-4)" }}>Series are listed above. Staff can upload data via the portal below.</p>
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
                  {act.pdf ? (
                    <a href={act.pdf} target="_blank" rel="noopener noreferrer" className="act-link">
                      View instrument
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                    </a>
                  ) : (
                    <span className="act-link" style={{ opacity: 0.35, cursor: "default" }}>Document pending</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── STAFF UPLOAD CTA ── */}
          <div style={{ background: "var(--ink)", borderRadius: "var(--r-lg)", padding: "2.5rem", marginTop: "3rem", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: "2rem" }}>
            <div>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green-mid)", marginBottom: "0.5rem" }}>Staff Upload Portal</div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#fff", marginBottom: "0.5rem" }}>Authorised ECN / agency staff</h3>
              <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.5)", maxWidth: 480 }}>
                Upload official energy datasets in CSV or XLSX format. Row-by-row validation with inline error reporting before final commit to the database. Authentication required.
              </p>
            </div>
            <div style={{ flexShrink: 0 }}>
              <Link href="/data-point/login?redirect=/upload" className="btn btn-primary">
                Staff Login &amp; Upload
              </Link>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
