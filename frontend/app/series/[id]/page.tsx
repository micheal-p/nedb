import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import StatCards from "@/components/databank/StatCards";
import SeriesTable from "@/components/databank/SeriesTable";
import VizSwitcher from "@/components/databank/VizSwitcher";
import { api } from "@/lib/api";

interface Props {
  params: Promise<{ id: string }>;
}

async function getData(id: string) {
  const [series, data, stats] = await Promise.all([
    api.getSeries(id).catch(() => null),
    api.getSeriesData(id, { limit: 500 }).catch(() => ({ rows: [], total: 0, page: 1, limit: 500 })),
    api.getStats(id).catch(() => null),
  ]);
  return { series, data, stats };
}

const SECTOR_LABELS: Record<string, string> = {
  petroleum: "Petroleum Statistics",
  electricity: "Electricity Statistics",
  biomass: "Biomass, Coal & Solid Fuels",
};

export default async function SeriesDetail({ params }: Props) {
  const { id } = await params;
  const { series, data, stats } = await getData(id);

  if (!series) {
    return (
      <>
        <Navbar active="databank" />
        <div style={{ padding: "8rem 2rem", textAlign: "center" }}>
          <h1 style={{ color: "var(--ink)", marginBottom: "1rem" }}>Series not found</h1>
          <Link href="/" className="btn btn-secondary">Back to Data Bank</Link>
        </div>
        <Footer />
      </>
    );
  }

  const templateUrl = api.templateUrl(series.id);
  const sectorLabel = SECTOR_LABELS[series.sector] ?? series.sector;

  return (
    <>
      <Navbar active="databank" />

      {/* ── SUB-HEADER ── */}
      <div style={{ background: "var(--surface-white)", borderBottom: "1px solid var(--border)", padding: "1.5rem 0" }}>
        <div className="page-wrap">
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.875rem", fontSize: "0.75rem", color: "var(--ink-4)" }}>
            <Link href="/" style={{ color: "var(--green)", fontWeight: 600 }}>Data Bank</Link>
            <span style={{ color: "var(--ink-5)" }}>/</span>
            <Link href={`/#sector-${series.sector}`} style={{ color: "var(--ink-4)" }}>{sectorLabel}</Link>
            <span style={{ color: "var(--ink-5)" }}>/</span>
            <span style={{ color: "var(--ink)" }}>{series.name}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.5rem" }}>
                <span className="tag tag-green">{series.sector}</span>
                <span className="tag tag-muted">{series.frequency}</span>
                {series.subsector && <span className="tag tag-ink">{series.subsector}</span>}
              </div>
              <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.625rem", fontWeight: 400, color: "var(--ink)", lineHeight: 1.15 }}>
                {series.name}
              </h1>
              <p style={{ fontSize: "0.78rem", color: "var(--ink-4)", marginTop: "0.35rem" }}>
                {series.record_count.toLocaleString()} records &nbsp;·&nbsp; Default unit: {series.unit_default} &nbsp;·&nbsp;
                NEDB ID: <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{series.id}</span>
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <a href={templateUrl} className="btn btn-secondary btn-sm">
                Download Template (XLSX)
              </a>
              <Link href="/upload" className="btn btn-primary btn-sm">
                Upload Dataset
              </Link>
            </div>
          </div>
        </div>
      </div>

      <main style={{ background: "var(--surface)", padding: "2rem 0 5rem" }}>
        <div className="page-wrap">

          {/* ── KPI STRIP ── */}
          {stats && (
            <div style={{ marginBottom: "1.75rem" }}>
              <StatCards stats={stats} />
            </div>
          )}

          {/* ── VISUALISATION ── */}
          <div style={{ marginBottom: "1.75rem" }}>
            <div className="chart-panel">
              <div className="chart-panel-head">
                <div>
                  <div className="chart-panel-title">{series.name} — Time Series</div>
                  <div className="chart-panel-sub">
                    {data.total.toLocaleString()} records · {series.unit_default}
                  </div>
                </div>
                <VizSwitcher
                  vizTypes={series.viz_types}
                  data={data.rows}
                  unit={series.unit_default}
                  compact
                />
              </div>
              <div className="chart-panel-body" style={{ minHeight: 320 }}>
                <VizSwitcher
                  vizTypes={series.viz_types}
                  data={data.rows}
                  unit={series.unit_default}
                  renderChart
                />
              </div>
              <div className="chart-source">
                Source: NEDB / {data.rows[0]?.source ?? "ECN"} &nbsp;·&nbsp;
                Series: {series.id} &nbsp;·&nbsp; Unit: {series.unit_default} &nbsp;·&nbsp;
                Data as at last upload commit
              </div>
            </div>
          </div>

          {/* ── DATA TABLE ── */}
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Full Data Table — {series.name}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--ink-4)" }}>
                {data.total.toLocaleString()} records
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <SeriesTable records={data.rows} unit={series.unit_default} total={data.total} />
            </div>
          </div>

          {/* ── METHODOLOGY NOTE ── */}
          <div style={{
            marginTop: "1.5rem",
            padding: "1.25rem",
            background: "var(--surface-white)",
            border: "1px solid var(--border)",
            borderLeft: "3px solid var(--green)",
            borderRadius: "var(--r-md)",
          }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.35rem" }}>
              Methodology Note
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-3)", lineHeight: 1.65 }}>
              Data for this series is ingested through the NEDB validated upload pipeline. Each record
              carries an explicit source attribution, methodology version tag, and ISO-aligned region code.
              Statistics (YoY, MoM, CAGR, rolling means) are computed at query time from the committed
              record set. Discrepancies with previously published figures may reflect retrospective revisions
              by the source agency.
            </p>
          </div>

        </div>
      </main>

      <Footer />
    </>
  );
}
