"use client";

// ── ReportView.tsx ──────────────────────────────────────────────────────────
// The printable / exportable report. Renders real recharts SVG so that browser
// "Save as PDF" captures the charts (the reason charts were missing before was
// that the old report never rendered them). The same in-DOM chart is rasterized
// to PNG for the Excel export. Both outputs are driven by one buildReportModel().

import { fmtCompact } from "@/lib/format";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { EnergyRecord } from "@/lib/api";
import { buildReportModel, type ReportMeta } from "@/lib/report-model";
import {
  toPoints, detectFrequency, periodsPerYear,
  yoyChange, rollingMean, cumulative,
} from "@/lib/analytics";
import StatOverlay from "@/components/charts/StatOverlay";
import CoatOfArms from "@/components/layout/CoatOfArms";
import { chartToPng } from "@/lib/svg-to-png";
import { exportReportXlsx } from "@/lib/excel-export";

interface Props {
  meta: ReportMeta;
  records: EnergyRecord[];
}

function fmt(n: number | null, dp = 1): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-NG", { maximumFractionDigits: dp });
}
function pct(n: number | null): string {
  if (n === null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export default function ReportView({ meta, records }: Props) {
  const model = useMemo(() => buildReportModel(records, meta), [records, meta]);
  const mainChartRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const overlays = useMemo(() => {
    const points = toPoints(records);
    const freq = detectFrequency(points);
    const window = freq === "annual" ? 3 : periodsPerYear(freq);
    const rollMap = new Map(rollingMean(points, window).map((r) => [r.period, r.value]));
    return {
      yoy: yoyChange(points),
      rolling: points.map((p) => ({ period: p.period, actual: p.value, smoothed: rollMap.get(p.period) ?? null })),
      cumulative: cumulative(points),
      window,
    };
  }, [records]);

  const lineData = model.rows.map((r) => ({ period: r.period, value: r.value }));
  const isEmpty = model.rows.length === 0;

  async function handleExcel() {
    setExporting(true);
    try {
      const png = await chartToPng(mainChartRef.current);
      await exportReportXlsx(model, png);
    } finally {
      setExporting(false);
    }
  }

  const generated = new Date(model.meta.generatedAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ background: "var(--surface)", minHeight: "100vh" }}>
      {/* ── TOOLBAR (screen only) ── */}
      <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 10, background: "#fff", borderBottom: "1px solid var(--border)", padding: "0.75rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href={`/series/${meta.seriesId}`} style={{ fontSize: "0.78rem", color: "var(--ink-4)", textDecoration: "none" }}>← Back to series</Link>
          <span style={{ fontSize: "0.78rem", color: "var(--ink-5)" }}>·</span>
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)" }}>{meta.name} — Report</span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={handleExcel} disabled={exporting} style={{ padding: "0.5rem 1rem", fontSize: "0.78rem", fontWeight: 700, background: "var(--green-strong)", color: "var(--green-deep)", border: "1px solid var(--green-line)", borderRadius: 6, cursor: exporting ? "wait" : "pointer" }}>
            {exporting ? "Building…" : "Export Excel (with chart)"}
          </button>
          <button onClick={() => window.print()} style={{ padding: "0.5rem 1.25rem", fontSize: "0.78rem", fontWeight: 700, background: "var(--ink)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* ── REPORT DOCUMENT ── */}
      <div className="report-doc" style={{ maxWidth: 900, margin: "0 auto", background: "#fff", padding: "2.5rem", marginTop: "1.5rem", marginBottom: "3rem", border: "1px solid var(--border)" }}>
        {/* Letterhead */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", borderBottom: "2px solid var(--green)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
          <CoatOfArms size={52} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ecn-logo.png" alt="ECN" style={{ height: 48, width: "auto", objectFit: "contain" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--green)" }}>Energy Commission of Nigeria — National Energy Data Bank</div>
            <div style={{ fontSize: "1.4rem", fontFamily: "var(--font-serif)", color: "var(--ink)", lineHeight: 1.15 }}>{meta.name}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--ink-4)", marginTop: 2 }}>
              {meta.sector} · {meta.frequency} · Unit: {meta.unit} · {model.meta.recordCount.toLocaleString()} records · Generated {generated}
            </div>
          </div>
        </div>

        {/* KPI grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1px", background: "var(--border)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden", marginBottom: "1.5rem" }}>
          {[
            { label: "Latest", value: `${fmt(model.kpis.latest)}`, sub: model.kpis.latestPeriod },
            { label: "Year-on-Year", value: pct(model.kpis.yoyPct), sub: "vs. 1 year ago" },
            { label: "CAGR", value: pct(model.kpis.cagr), sub: "compound annual" },
            { label: "Volatility", value: model.summary ? `${fmt(model.kpis.volatilityPct, 0)}%` : "—", sub: "coeff. of variation" },
          ].map((k) => (
            <div key={k.label} style={{ background: "#fff", padding: "0.875rem 1rem" }}>
              <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-5)" }}>{k.label}</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)", lineHeight: 1.1, marginTop: 4 }}>{k.value}</div>
              <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Narrative blocks */}
        {(meta.whatIs || meta.whyItMatters) && (
          <div style={{ marginBottom: "1.5rem", padding: "1rem 1.25rem", background: "var(--surface)", borderLeft: "3px solid var(--green)", borderRadius: "var(--r-md)" }}>
            {meta.whatIs && <p style={{ fontSize: "0.8rem", color: "var(--ink-3)", lineHeight: 1.6, margin: "0 0 0.5rem" }}><strong>What this is:</strong> {meta.whatIs}</p>}
            {meta.whyItMatters && <p style={{ fontSize: "0.8rem", color: "var(--ink-3)", lineHeight: 1.6, margin: 0 }}><strong>Why it matters:</strong> {meta.whyItMatters}</p>}
          </div>
        )}

        {/* Empty state — one clean notice instead of hollow chart scaffolding */}
        {isEmpty && (
          <div style={{ padding: "3.5rem 2rem", textAlign: "center", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: "var(--r-md)", marginBottom: "1.5rem" }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25, color: "var(--ink-4)" }}>
              <path d="M3 3v18h18" /><path d="M7 16l4-4 4 4 4-4" />
            </svg>
            <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)", marginTop: "0.75rem" }}>No committed records yet</div>
            <p style={{ fontSize: "0.78rem", color: "var(--ink-4)", marginTop: "0.4rem", lineHeight: 1.6 }}>
              The trend chart, statistical analysis and data table will populate automatically
              once records are committed to this series via the Staff Upload Portal.
            </p>
          </div>
        )}

        {/* Main trend chart (captured for Excel) */}
        {!isEmpty && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>Trend — {meta.name} ({meta.unit})</div>
          <div ref={mainChartRef} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "0.75rem" }}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={lineData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E0" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#8E867B" }} axisLine={{ stroke: "#E7E5E0" }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#8E867B" }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
                <Tooltip formatter={(v: unknown) => [`${Number(v).toLocaleString()} ${meta.unit}`, meta.name]} />
                <Line type="monotone" dataKey="value" stroke="#0E7A3C" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        )}

        {/* Analytical overlays */}
        {!isEmpty && (<>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.75rem" }}>Statistical Analysis</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }} className="report-overlays">
          <ReportOverlayCard title="Year-on-Year Change">
            <StatOverlay spec={{ kind: "change", data: overlays.yoy }} unit={meta.unit} height={180} />
          </ReportOverlayCard>
          <ReportOverlayCard title={`${overlays.window}-Period Rolling Average`}>
            <StatOverlay spec={{ kind: "rolling", data: overlays.rolling, window: overlays.window }} unit={meta.unit} height={180} />
          </ReportOverlayCard>
          <ReportOverlayCard title="Cumulative Total">
            <StatOverlay spec={{ kind: "cumulative", data: overlays.cumulative }} unit={meta.unit} height={180} />
          </ReportOverlayCard>
          <ReportOverlayCard title="Summary Statistics">
            <div style={{ padding: "0.5rem 0.75rem", fontSize: "0.72rem" }}>
              {model.summary && [
                ["Observations", String(model.summary.count)],
                ["Minimum", fmt(model.summary.min)],
                ["Maximum", fmt(model.summary.max)],
                ["Mean", fmt(model.summary.mean)],
                ["Median", fmt(model.summary.median)],
                ["Std. deviation", fmt(model.summary.stdev)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "0.3rem 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--ink-4)" }}>{k}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--ink)" }}>{v}</span>
                </div>
              ))}
            </div>
          </ReportOverlayCard>
        </div>

        {/* Data table (first 40 for print; full set is in the Excel export) */}
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>Data Table <span style={{ fontWeight: 400, color: "var(--ink-5)" }}>(showing up to 40 periods — full set in Excel export)</span></div>
        <table className="data-table" style={{ fontSize: "0.72rem" }}>
          <thead>
            <tr>
              <th>Period</th><th>Value ({meta.unit})</th><th>YoY %</th><th>Rolling</th><th>Cumulative</th><th>Index</th>
            </tr>
          </thead>
          <tbody>
            {model.rows.slice(-40).map((row) => (
              <tr key={row.period}>
                <td style={{ fontFamily: "var(--font-mono)" }}>{row.period}</td>
                <td style={{ fontFamily: "var(--font-mono)" }}>{fmt(row.value, 2)}</td>
                <td style={{ fontFamily: "var(--font-mono)", color: row.yoyPct === null ? "var(--ink-5)" : row.yoyPct >= 0 ? "var(--green)" : "var(--red)" }}>{pct(row.yoyPct)}</td>
                <td style={{ fontFamily: "var(--font-mono)" }}>{fmt(row.rolling)}</td>
                <td style={{ fontFamily: "var(--font-mono)" }}>{fmt(row.cumulative)}</td>
                <td style={{ fontFamily: "var(--font-mono)" }}>{row.index.toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </>)}

        {/* Footer */}
        <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--border)", fontSize: "0.65rem", color: "var(--ink-5)" }}>
          Source: {meta.sourceAgency ?? "ECN / NEDB"} · Cite as: ECN-NEDB, {new Date().getFullYear()} · Generated automatically from committed NEDB records.
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .report-doc { border: none !important; margin: 0 !important; max-width: 100% !important; padding: 0 !important; }
          .report-overlays { grid-template-columns: 1fr 1fr !important; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}

function ReportOverlayCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
      <div style={{ padding: "0.6rem 0.875rem", borderBottom: "1px solid var(--border)", fontSize: "0.72rem", fontWeight: 700, color: "var(--ink)" }}>{title}</div>
      {children}
    </div>
  );
}
