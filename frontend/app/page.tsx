import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { db } from "@/lib/supabase-server";
import SeriesCatalogue, { type Trend } from "@/components/databank/SeriesCatalogue";
import { computeSignal, type SignalRules, type SignalLevel } from "@/lib/signals";


interface SeriesRow {
  id: string; name: string; sector: string; subsector: string | null;
  unit_default: string; frequency: string; viz_types: string[];
  created_at: string; record_count: number;
}

interface CustomSeriesRow {
  slug: string; name: string; description: string | null;
  geo_resolution: string; record_count: number; column_count: number;
}

async function getCustomSeries(): Promise<CustomSeriesRow[]> {
  try {
    const { data } = await db()
      .from("custom_series")
      .select("slug, name, description, geo_resolution, custom_records(count), custom_columns(count)")
      .eq("is_public", true)
      .order("created_at", { ascending: false });
    return (data ?? []).map((s) => ({
      slug: s.slug as string, name: s.name as string,
      description: s.description as string | null,
      geo_resolution: s.geo_resolution as string,
      record_count: (s.custom_records as { count: number }[] | null)?.[0]?.count ?? 0,
      column_count: (s.custom_columns as { count: number }[] | null)?.[0]?.count ?? 0,
    }));
  } catch { return []; }
}

async function getSeries(): Promise<SeriesRow[]> {
  try {
    const { data } = await db()
      .from("series_types")
      .select("id, name, sector, subsector, unit_default, frequency, viz_types, created_at, signal_rules, energy_records(count)")
      .order("sector").order("name");
    return (data ?? []).map((s) => ({
      id: s.id as string, name: s.name as string, sector: s.sector as string,
      subsector: s.subsector as string | null, unit_default: s.unit_default as string,
      frequency: s.frequency as string, viz_types: s.viz_types as string[],
      created_at: s.created_at as string,
      record_count: (s.energy_records as { count: number }[] | null)?.[0]?.count ?? 0,
      signal_rules: s.signal_rules as SignalRules | null,
    }));
  } catch { return []; }
}

// Recent national values per series → sparkline trends + home signal strip
async function getTrendRows() {
  try {
    const { data } = await db()
      .from("energy_records")
      .select("series_type_id, period, period_date, value, region")
      .order("period_date", { ascending: true })
      .limit(3000);
    return (data ?? []).filter((r) => (!r.region || ["NGA", "", "national"].includes(r.region)) && r.value !== null);
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
  const [series, customSeries, trendRows] = await Promise.all([getSeries(), getCustomSeries(), getTrendRows()]);

  // Build per-series trend (last 24 points) + YoY, and the public signals strip
  const rowsBySeries = new Map<string, { period: string; value: number }[]>();
  for (const r of trendRows) {
    if (!rowsBySeries.has(r.series_type_id)) rowsBySeries.set(r.series_type_id, []);
    rowsBySeries.get(r.series_type_id)!.push({ period: r.period as string, value: Number(r.value) });
  }
  const trends: Record<string, Trend> = {};
  const signals: { id: string; name: string; level: SignalLevel }[] = [];
  for (const s of series) {
    const rows = rowsBySeries.get(s.id) ?? [];
    if (rows.length >= 2) {
      const latest = rows[rows.length - 1];
      const isMonthly = /^\d{4}-\d{2}$/.test(latest.period);
      const lag = isMonthly && rows.length >= 13 ? 12 : 1;
      const prev = rows.length > lag ? rows[rows.length - 1 - lag] : null;
      trends[s.id] = {
        points: rows.slice(-24).map((r) => r.value),
        latest: latest.value,
        period: latest.period,
        yoyPct: prev && prev.value !== 0 ? ((latest.value - prev.value) / Math.abs(prev.value)) * 100 : null,
      };
      const rules = (s as unknown as { signal_rules: SignalRules | null }).signal_rules;
      if (rules) {
        const sig = computeSignal(rules, rows);
        if (sig) signals.push({ id: s.id, name: s.name, level: sig.level });
      }
    }
  }
  const LEVEL_DOT: Record<SignalLevel, string> = { above: "#0E7A3C", neutral: "#8E867B", warn: "#D97706", critical: "#DC2626" };
  const order: SignalLevel[] = ["critical", "warn", "above", "neutral"];
  signals.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
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

      {/* ── CURRENT SIGNALS ── */}
      {signals.length > 0 && (
        <div style={{ background: "var(--surface-white)", borderBottom: "1px solid var(--border)", padding: "0.65rem 0" }}>
          <div className="page-wrap" style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflowX: "auto" }}>
            <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-5)", flexShrink: 0 }}>Current signals</span>
            {signals.map((sig) => (
              <Link key={sig.id} href={`/series/${sig.id}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, border: "1px solid var(--border)", background: "var(--surface)", fontSize: "0.7rem", fontWeight: 600, color: "var(--ink-3)", whiteSpace: "nowrap", textDecoration: "none", flexShrink: 0 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: LEVEL_DOT[sig.level], flexShrink: 0 }} />
                {sig.name}
                <span style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", color: LEVEL_DOT[sig.level] }}>{sig.level}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

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
            <Link href="/africa" className="sub-nav-link">Nigeria in Africa</Link>
            <Link href="/request-data" className="sub-nav-link">Request Data</Link>
          </div>

          <SeriesCatalogue series={series} sectorMeta={SECTOR_META} trends={trends} />

          {/* ── CUSTOM DATA TABLES ── */}
          {customSeries.length > 0 && (
            <section style={{ marginTop: "3.5rem" }} id="custom-tables">
              <div className="sec-hd">
                <h2>Custom Data Tables</h2>
                <span className="sec-hd-meta">Staff-built series with structured columns</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
                {customSeries.map((cs) => (
                  <Link key={cs.slug} href={`/custom-series/${cs.slug}`} style={{ textDecoration: "none" }}>
                    <div className="act-card" style={{ height: "100%", cursor: "pointer" }}>
                      <div className="act-year">
                        {cs.record_count.toLocaleString()} records &nbsp;·&nbsp; {cs.column_count} columns &nbsp;·&nbsp; {cs.geo_resolution}
                      </div>
                      <div className="act-name">{cs.name}</div>
                      {cs.description && (
                        <div className="act-desc" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {cs.description}
                        </div>
                      )}
                      <span className="act-link">
                        View series
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
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
