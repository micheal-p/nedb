import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import StatCards from "@/components/databank/StatCards";
import SeriesTable from "@/components/databank/SeriesTable";
import SeriesChartPanel from "@/components/databank/SeriesChartPanel";
import StatisticalAnalysisPanel from "@/components/databank/StatisticalAnalysisPanel";
import CoatOfArms from "@/components/layout/CoatOfArms";
import PrintButton from "@/components/ui/PrintButton";
import EmbedButton from "@/components/ui/EmbedButton";
import { db } from "@/lib/supabase-server";
import { normLga } from "@/lib/geo";
import type { AutoStats } from "@/lib/api";
import { api } from "@/lib/api";

interface Props {
  params: Promise<{ id: string }>;
}

async function getData(id: string) {
  // Query Supabase directly — avoids relative-URL self-fetch issues in server components
  const [{ data: seriesRaw }, { data: records, count }, { data: lgaRecords }] = await Promise.all([
    db()
      .from("series_types")
      .select("id, name, sector, subsector, unit_default, frequency, viz_types, created_at, description, methodology, source_agency, what_is, how_to_read, why_it_matters, signal_rules, geo_resolution, energy_records(count)")
      .eq("id", id)
      .single(),
    db()
      .from("energy_records")
      .select("*", { count: "exact" })
      .eq("series_type_id", id)
      .order("period_date", { ascending: true })
      .limit(500),
    // LGA-tagged rows (partial index on lga_id keeps this cheap; empty for most series)
    db()
      .from("energy_records")
      .select("value, period_date, lgas(name)")
      .eq("series_type_id", id)
      .not("lga_id", "is", null)
      .order("period_date", { ascending: false })
      .limit(2000),
  ]);

  // Latest value per LGA, keyed by normalized name for polygon matching
  const lgaData: Record<string, number> = {};
  for (const r of lgaRecords ?? []) {
    const lgaJoin = r.lgas as unknown as { name: string } | { name: string }[] | null;
    const lgaName = Array.isArray(lgaJoin) ? lgaJoin[0]?.name : lgaJoin?.name;
    if (!lgaName || r.value === null) continue;
    const key = normLga(lgaName);
    if (!(key in lgaData)) lgaData[key] = Number(r.value); // rows are date-desc → first hit is latest
  }

  const series = seriesRaw
    ? {
        ...seriesRaw,
        record_count: (seriesRaw.energy_records as { count: number }[])?.[0]?.count ?? 0,
        energy_records: undefined,
      }
    : null;

  const rows = records ?? [];

  // Compute stats inline (same logic as /api/series/[id]/stats)
  let stats: AutoStats | null = null;
  if (rows.length) {
    const desc = [...rows].reverse();
    const latest = desc[0];
    const s: AutoStats = {
      series_type_id: id,
      latest: latest.value,
      latest_period: latest.period,
      unit: latest.unit,
      yoy_pct: null, mom_pct: null, cagr: null, rolling_3: null, rolling_12: null,
    };
    const yoyIdx = desc.length >= 13 ? 12 : 1;
    if (desc.length > yoyIdx && desc[yoyIdx].value !== 0)
      s.yoy_pct = ((latest.value - desc[yoyIdx].value) / Math.abs(desc[yoyIdx].value)) * 100;
    if (desc.length >= 2 && desc[1].value !== 0)
      s.mom_pct = ((latest.value - desc[1].value) / Math.abs(desc[1].value)) * 100;
    if (desc.length >= 2) {
      const oldest = desc[desc.length - 1];
      const years = (new Date(latest.period_date as string).getTime() - new Date(oldest.period_date as string).getTime()) / (1000 * 60 * 60 * 8760);
      if (oldest.value > 0 && years > 0)
        s.cagr = (Math.pow(latest.value / oldest.value, 1 / years) - 1) * 100;
    }
    if (desc.length >= 3)  s.rolling_3  = (desc[0].value + desc[1].value + desc[2].value) / 3;
    if (desc.length >= 12) s.rolling_12 = desc.slice(0, 12).reduce((sum, r) => sum + r.value, 0) / 12;
    stats = s;
  }

  // Compute current signal from signal_rules JSONB
  let currentSignal: { text: string; level: "above" | "neutral" | "warn" | "critical" } | null = null;
  if (rows.length >= 2 && seriesRaw?.signal_rules) {
    const rules = seriesRaw.signal_rules as {
      compare_to: string; threshold_warn: number; threshold_critical: number;
      direction: string; templates: Record<string, string>; unit_label?: string;
    };
    const desc = [...rows].reverse();
    const latest = desc[0].value as number;
    const refCount = rules.compare_to === "prev_period" ? 1 : Math.min(60, desc.length - 1);
    const refVals  = desc.slice(1, refCount + 1).map((r) => r.value as number).filter((v) => v !== null);
    if (refVals.length) {
      const ref = refVals.reduce((a, b) => a + b, 0) / refVals.length;
      if (ref !== 0) {
        const pct = ((latest - ref) / Math.abs(ref)) * 100;
        const isHigherBetter = rules.direction !== "lower_is_better";
        const effectivePct   = isHigherBetter ? pct : -pct;
        let level: "above" | "neutral" | "warn" | "critical" = "neutral";
        if      (effectivePct <= rules.threshold_critical) level = "critical";
        else if (effectivePct <= rules.threshold_warn)     level = "warn";
        else if (effectivePct > 5)                         level = "above";
        const template = rules.templates?.[level] ?? "";
        const text = template.replace(/{pct}/g, Math.abs(pct).toFixed(1));
        currentSignal = { text, level };
      }
    }
  }

  return {
    series,
    data: { rows, total: count ?? rows.length, page: 1, limit: 500 },
    stats,
    currentSignal,
    lgaData,
  };
}

const SECTOR_LABELS: Record<string, string> = {
  petroleum: "Petroleum Statistics",
  electricity: "Electricity Statistics",
  biomass: "Biomass, Coal & Solid Fuels",
};

export default async function SeriesDetail({ params }: Props) {
  const { id } = await params;
  const { series, data, stats, currentSignal, lgaData } = await getData(id);

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
      {/* ── PRINT-ONLY LETTERHEAD ── */}
      <div className="print-only print-header">
        <CoatOfArms size={52} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ecn-logo.png" alt="ECN" style={{ height: 52, width: "auto", objectFit: "contain" }} />
        <div style={{ flex: 1, borderLeft: "1px solid #ccc", paddingLeft: "1rem", marginLeft: "0.25rem" }}>
          <div className="print-header-org">ENERGY COMMISSION OF NIGERIA (ECN)</div>
          <div className="print-header-title">National Energy Data Bank — {series.name}</div>
          <div className="print-header-meta">
            {series.sector} &nbsp;·&nbsp; {series.frequency} &nbsp;·&nbsp; Unit: {series.unit_default}
            &nbsp;·&nbsp; {series.record_count.toLocaleString()} records
            &nbsp;·&nbsp; Generated: {new Date().toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
        <div className="print-header-ecn">OFFICIAL DATA PUBLICATION</div>
      </div>

      <div className="no-print"><Navbar active="databank" /></div>

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
                {series.record_count.toLocaleString()} records &nbsp;·&nbsp; {series.unit_default} &nbsp;·&nbsp;
                NEDB ID: <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{series.id}</span>
                {data.rows.length > 0 && (
                  <> &nbsp;·&nbsp; Last updated: {new Date(data.rows[data.rows.length - 1].created_at ?? series.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</>
                )}
              </p>
            </div>
            <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {/* Documents & sharing */}
              <Link href={`/series/${series.id}/report`} className="btn btn-secondary btn-sm">Full Report</Link>
              <PrintButton />
              <EmbedButton seriesId={series.id} />
              <Link href={`/compare?a=${series.id}`} className="btn btn-secondary btn-sm">Compare</Link>
              {/* Data files */}
              <span aria-hidden style={{ width: 1, height: 20, background: "var(--border)", margin: "0 2px" }} />
              <a href={`/api/series/${series.id}/export?format=csv`} className="btn btn-secondary btn-sm" download>
                CSV
              </a>
              <a href={`/api/series/${series.id}/export?format=xlsx`} className="btn btn-secondary btn-sm" download>
                Excel
              </a>
              <a href={templateUrl} className="btn btn-secondary btn-sm">
                Template
              </a>
              {/* Primary action — always last */}
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
          <div className="no-print" style={{ marginBottom: "1.75rem" }}>
            <SeriesChartPanel
              title={`${series.name} — Time Series`}
              subtitle={`${data.total.toLocaleString()} records · ${series.unit_default}`}
              source={data.rows[0]?.source ?? "ECN"}
              vizTypes={series.viz_types}
              data={data.rows}
              unit={series.unit_default}
              seriesId={series.id}
              lgaData={lgaData}
            />
          </div>

          {/* ── DATA INTELLIGENCE PANEL ── */}
          {(series.what_is || series.how_to_read || series.why_it_matters || currentSignal) && (
            <div style={{ marginBottom: "1.75rem" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.875rem" }}>Data Intelligence</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>

                {series.what_is && (
                  <div style={{ padding: "1.1rem 1.25rem", background: "#fff", border: "1px solid var(--border)", borderTop: "3px solid var(--green)", borderRadius: "var(--r-md)" }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.5rem" }}>What Is This?</div>
                    <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", lineHeight: 1.65, margin: 0 }}>{series.what_is}</p>
                  </div>
                )}

                {series.how_to_read && (
                  <div style={{ padding: "1.1rem 1.25rem", background: "#fff", border: "1px solid var(--border)", borderTop: "3px solid #1D4ED8", borderRadius: "var(--r-md)" }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#1D4ED8", marginBottom: "0.5rem" }}>How to Read</div>
                    <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", lineHeight: 1.65, margin: 0 }}>{series.how_to_read}</p>
                  </div>
                )}

                {series.why_it_matters && (
                  <div style={{ padding: "1.1rem 1.25rem", background: "#fff", border: "1px solid var(--border)", borderTop: "3px solid #B45309", borderRadius: "var(--r-md)" }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#B45309", marginBottom: "0.5rem" }}>Why It Matters</div>
                    <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", lineHeight: 1.65, margin: 0 }}>{series.why_it_matters}</p>
                  </div>
                )}

                {currentSignal && (
                  <div style={{
                    padding: "1.1rem 1.25rem", background: "#fff",
                    border: `1px solid ${currentSignal.level === "critical" ? "#FEE2E2" : currentSignal.level === "warn" ? "#FEF3C7" : currentSignal.level === "above" ? "#DCFCE7" : "var(--border)"}`,
                    borderTop: `3px solid ${currentSignal.level === "critical" ? "#DC2626" : currentSignal.level === "warn" ? "#D97706" : currentSignal.level === "above" ? "var(--green)" : "var(--ink-5)"}`,
                    borderRadius: "var(--r-md)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "0.5rem" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: currentSignal.level === "critical" ? "#DC2626" : currentSignal.level === "warn" ? "#D97706" : currentSignal.level === "above" ? "var(--green)" : "var(--ink-5)", flexShrink: 0 }} />
                      <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: currentSignal.level === "critical" ? "#DC2626" : currentSignal.level === "warn" ? "#D97706" : currentSignal.level === "above" ? "var(--green)" : "var(--ink-4)" }}>
                        Current Signal
                      </div>
                    </div>
                    <p style={{ fontSize: "0.78rem", color: "var(--ink)", lineHeight: 1.65, margin: 0, fontWeight: 500 }}>{currentSignal.text}</p>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ── STATISTICAL ANALYSIS (6 separate overlay charts) ── */}
          <div className="no-print">
            <StatisticalAnalysisPanel records={data.rows} unit={series.unit_default} seriesName={series.name} />
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

          {/* ── METHODOLOGY / ABOUT ── */}
          <div className="methodology-grid" style={{ marginTop: "1.5rem", display: "grid", gridTemplateColumns: series.methodology ? "1fr 1fr" : "1fr", gap: "1rem" }}>
            {series.description && (
              <div style={{ padding: "1.25rem", background: "var(--surface-white)", border: "1px solid var(--border)", borderLeft: "3px solid var(--green)", borderRadius: "var(--r-md)" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.35rem" }}>About this Series</div>
                <p style={{ fontSize: "0.8rem", color: "var(--ink-3)", lineHeight: 1.65, margin: 0 }}>{series.description}</p>
                {series.source_agency && (
                  <div style={{ marginTop: "0.75rem", fontSize: "0.7rem", color: "var(--ink-5)" }}>
                    Source agency: <span style={{ fontWeight: 600, color: "var(--ink-4)" }}>{series.source_agency}</span>
                  </div>
                )}
              </div>
            )}
            {series.methodology && (
              <div style={{ padding: "1.25rem", background: "var(--surface-white)", border: "1px solid var(--border)", borderLeft: "3px solid var(--ink-5)", borderRadius: "var(--r-md)" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.35rem" }}>Methodology Note</div>
                <p style={{ fontSize: "0.78rem", color: "var(--ink-4)", lineHeight: 1.65, margin: 0 }}>{series.methodology}</p>
              </div>
            )}
            {!series.description && !series.methodology && (
              <div style={{ padding: "1.25rem", background: "var(--surface-white)", border: "1px solid var(--border)", borderLeft: "3px solid var(--green)", borderRadius: "var(--r-md)" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.35rem" }}>Methodology Note</div>
                <p style={{ fontSize: "0.8rem", color: "var(--ink-3)", lineHeight: 1.65, margin: 0 }}>
                  Data for this series is ingested through the NEDB validated upload pipeline. Each record carries an explicit source attribution, methodology version tag, and ISO-aligned region code. Statistics (YoY, MoM, CAGR, rolling means) are computed at query time from the committed record set.
                </p>
              </div>
            )}
          </div>

        </div>
      </main>

      {/* ── PRINT-ONLY FOOTER ── */}
      <div className="print-only print-doc-footer">
        <div>National Energy Data Bank (NEDB) &nbsp;·&nbsp; Energy Commission of Nigeria &nbsp;·&nbsp; energy.gov.ng</div>
        <div>Series ID: <span style={{ fontFamily: "monospace" }}>{series.id}</span> &nbsp;·&nbsp; Data is provided for informational purposes. Cite as: ECN-NEDB, {new Date().getFullYear()}.</div>
        <div>This document was generated automatically from live NEDB records.</div>
      </div>

      <div className="no-print"><Footer /></div>
    </>
  );
}
