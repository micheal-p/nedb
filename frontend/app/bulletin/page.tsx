import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CoatOfArms from "@/components/layout/CoatOfArms";
import PrintButton from "@/components/ui/PrintButton";
import { db } from "@/lib/supabase-server";

async function getBulletinData() {
  const { data: series } = await db()
    .from("series_types")
    .select("id, name, sector, unit_default, frequency, energy_records(count)")
    .order("sector").order("name");

  if (!series) return { series: [], sectorStats: {}, totalRecords: 0, date: new Date() };

  const shaped = series.map((s) => ({
    id: s.id as string,
    name: s.name as string,
    sector: s.sector as string,
    unit: s.unit_default as string,
    frequency: s.frequency as string,
    record_count: (s.energy_records as { count: number }[])?.[0]?.count ?? 0,
  }));

  // Fetch latest value + yoy for each series
  const statsResults = await Promise.all(
    shaped.map(async (s) => {
      const { data } = await db()
        .from("energy_records")
        .select("period, value, unit")
        .eq("series_type_id", s.id)
        .order("period_date", { ascending: false })
        .limit(14);

      const rows = data ?? [];
      if (!rows.length) return { ...s, latest: null, latest_period: null, yoy_pct: null };

      const latest = rows[0];
      const yoyRow = rows.length >= 13 ? rows[12] : null;
      const yoy_pct =
        yoyRow && yoyRow.value && latest.value !== null
          ? ((latest.value - yoyRow.value) / Math.abs(yoyRow.value)) * 100
          : null;

      return { ...s, latest: latest.value, latest_period: latest.period, unit: latest.unit ?? s.unit, yoy_pct };
    })
  );

  const totalRecords = shaped.reduce((sum, s) => sum + s.record_count, 0);

  const sectorStats: Record<string, { label: string; count: number; records: number }> = {};
  for (const s of statsResults) {
    if (!sectorStats[s.sector]) {
      sectorStats[s.sector] = {
        label: s.sector.charAt(0).toUpperCase() + s.sector.slice(1),
        count: 0,
        records: 0,
      };
    }
    sectorStats[s.sector].count++;
    sectorStats[s.sector].records += s.record_count;
  }

  const movers = statsResults
    .filter((s) => s.yoy_pct !== null)
    .sort((a, b) => Math.abs(b.yoy_pct!) - Math.abs(a.yoy_pct!))
    .slice(0, 5);

  return { series: statsResults, sectorStats, totalRecords, movers, date: new Date() };
}

const SECTOR_LABEL: Record<string, string> = {
  petroleum:   "Petroleum Statistics",
  electricity: "Electricity Statistics",
  biomass:     "Biomass, Coal & Solid Fuels",
};

export default async function BulletinPage() {
  const { series, sectorStats, totalRecords, movers, date } = await getBulletinData();

  const monthLabel = date.toLocaleDateString("en-NG", { month: "long", year: "numeric" });

  return (
    <>
      <div className="print-only print-header" style={{ display: "none" }}>
        <CoatOfArms size={48} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ecn-logo.png" alt="ECN" style={{ height: 48, width: "auto", objectFit: "contain" }} />
        <div style={{ flex: 1, borderLeft: "1px solid #ccc", paddingLeft: "1rem", marginLeft: "0.25rem" }}>
          <div className="print-header-org">ENERGY COMMISSION OF NIGERIA (ECN)</div>
          <div className="print-header-title">National Energy Data Bank — Intelligence Bulletin</div>
          <div className="print-header-meta">Issued: {monthLabel}</div>
        </div>
        <div className="print-header-ecn">OFFICIAL DATA PUBLICATION</div>
      </div>

      <div className="no-print"><Navbar active="databank" /></div>

      <div style={{ background: "var(--surface-white)", borderBottom: "1px solid var(--border)", padding: "2rem 0" }}>
        <div className="page-wrap">
          <div style={{ fontSize: "0.75rem", color: "var(--ink-4)", marginBottom: "0.75rem" }}>
            <Link href="/" style={{ color: "var(--green)", fontWeight: 600 }}>Data Bank</Link>
            <span style={{ margin: "0 0.5rem" }}>/</span>
            <span>Intelligence Bulletin</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: "0.5rem" }}>
                <span className="tag tag-green">ECN / NEDB</span>
                <span className="tag tag-muted">{monthLabel}</span>
              </div>
              <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.625rem", fontWeight: 400, color: "var(--ink)" }}>
                National Energy Data Bank<br />Intelligence Bulletin
              </h1>
              <p style={{ fontSize: "0.78rem", color: "var(--ink-4)", marginTop: "0.35rem" }}>
                Auto-generated statistical summary across all NEDB data series.
              </p>
            </div>
            <div className="no-print" style={{ display: "flex", gap: 8 }}>
              <PrintButton />
            </div>
          </div>
        </div>
      </div>

      <main style={{ background: "var(--surface)", padding: "2rem 0 5rem" }}>
        <div className="page-wrap">

          {/* Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
            {[
              { label: "Total Records", value: totalRecords.toLocaleString() },
              { label: "Data Series", value: String(series.length) },
              { label: "Sectors Covered", value: String(Object.keys(sectorStats).length) },
              { label: "Bulletin Date", value: monthLabel },
            ].map((card) => (
              <div key={card.label} style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1.25rem" }}>
                <div style={{ fontSize: "1.375rem", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--ink)" }}>{card.value}</div>
                <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-5)", marginTop: 4 }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* Sector breakdown */}
          <div className="panel" style={{ marginBottom: "1.5rem" }}>
            <div className="panel-header">
              <span className="panel-title">Sector Coverage</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "0.625rem 1rem", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-5)", fontWeight: 700 }}>Sector</th>
                  <th style={{ textAlign: "right", padding: "0.625rem 1rem", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-5)", fontWeight: 700 }}>Series</th>
                  <th style={{ textAlign: "right", padding: "0.625rem 1rem", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-5)", fontWeight: 700 }}>Records</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(sectorStats).map(([key, stat]) => (
                  <tr key={key} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>{SECTOR_LABEL[key] ?? stat.label}</td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>{stat.count}</td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>{stat.records.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top movers */}
          {movers && movers.length > 0 && (
            <div className="panel" style={{ marginBottom: "1.5rem" }}>
              <div className="panel-header">
                <span className="panel-title">Biggest Year-on-Year Movers</span>
                <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>Latest period vs. same period prior year</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    {["Series", "Period", "Latest Value", "YoY Change"].map((h) => (
                      <th key={h} style={{ textAlign: h === "Series" ? "left" : "right", padding: "0.625rem 1rem", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-5)", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {movers.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <Link href={`/series/${s.id}`} style={{ color: "var(--green)", fontWeight: 600, textDecoration: "none" }}>{s.name}</Link>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--ink-4)" }}>{s.latest_period ?? "—"}</td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                        {s.latest !== null ? `${Number(s.latest).toLocaleString()} ${s.unit}` : "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                        {s.yoy_pct !== null ? (
                          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.82rem", color: s.yoy_pct >= 0 ? "#0E7A3C" : "#E04F39" }}>
                            {s.yoy_pct >= 0 ? "+" : ""}{s.yoy_pct.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* All series table */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">All Series — Status Overview</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    {["Series", "Sector", "Frequency", "Records", "Latest Period", "Latest Value", "YoY"].map((h) => (
                      <th key={h} style={{ textAlign: h === "Series" || h === "Sector" ? "left" : "right", padding: "0.5rem 1rem", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-5)", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {series.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.625rem 1rem", fontWeight: 500, whiteSpace: "nowrap" }}>
                        <Link href={`/series/${s.id}`} style={{ color: "var(--green)", textDecoration: "none" }}>{s.name}</Link>
                      </td>
                      <td style={{ padding: "0.625rem 1rem", color: "var(--ink-4)", textTransform: "capitalize" }}>{s.sector}</td>
                      <td style={{ padding: "0.625rem 1rem", textAlign: "right", textTransform: "capitalize", color: "var(--ink-4)" }}>{s.frequency}</td>
                      <td style={{ padding: "0.625rem 1rem", textAlign: "right", fontFamily: "var(--font-mono)" }}>{s.record_count.toLocaleString()}</td>
                      <td style={{ padding: "0.625rem 1rem", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--ink-5)" }}>{s.latest_period ?? "—"}</td>
                      <td style={{ padding: "0.625rem 1rem", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {s.latest !== null ? `${Number(s.latest).toLocaleString()} ${s.unit}` : "—"}
                      </td>
                      <td style={{ padding: "0.625rem 1rem", textAlign: "right" }}>
                        {s.yoy_pct !== null ? (
                          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.75rem", color: s.yoy_pct >= 0 ? "#0E7A3C" : "#E04F39" }}>
                            {s.yoy_pct >= 0 ? "+" : ""}{s.yoy_pct.toFixed(1)}%
                          </span>
                        ) : <span style={{ color: "var(--ink-5)" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="print-only" style={{ marginTop: "2rem", padding: "1rem", borderTop: "1px solid #ccc", fontSize: "0.7rem", color: "#8E867B" }}>
            National Energy Data Bank (NEDB) · Energy Commission of Nigeria · energy.gov.ng<br />
            This bulletin is auto-generated from live NEDB records. Cite as: ECN-NEDB Intelligence Bulletin, {date.getFullYear()}.
          </div>
        </div>
      </main>

      <div className="no-print"><Footer /></div>
    </>
  );
}
