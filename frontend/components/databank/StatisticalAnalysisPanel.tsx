"use client";

// ── StatisticalAnalysisPanel.tsx ────────────────────────────────────────────
// Orchestrates the analytical layer. Consumes lib/analytics transforms, feeds
// each into the shared StatOverlay chart, and pairs every chart with a plain-
// English logic note: a fixed "what this shows" line plus a DYNAMIC reading
// computed live from the series (e.g. "Latest YoY change: +8.3%"). Each analysis
// is its own separate chart — never a toggle on the main series chart.

import { useMemo, useState } from "react";
import type { EnergyRecord } from "@/lib/api";
import StatOverlay from "@/components/charts/StatOverlay";
import {
  toPoints, detectFrequency, periodsPerYear,
  yoyChange, periodChange, rollingMean, cumulative, indexed,
  volatilityBand, trendDecomposition, summaryStats,
} from "@/lib/analytics";

interface Props {
  records: EnergyRecord[];
  unit: string;
  seriesName: string;
}

function fmt(n: number, dp = 1): string {
  return n.toLocaleString("en-NG", { maximumFractionDigits: dp });
}
function signed(n: number, dp = 1): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(dp)}`;
}

const INITIAL_VISIBLE = 3;

export default function StatisticalAnalysisPanel({ records, unit, seriesName }: Props) {
  const [expanded, setExpanded] = useState(false);
  const analysis = useMemo(() => {
    const points = toPoints(records);
    const freq = detectFrequency(points);
    const ppy = periodsPerYear(freq);
    // window: 1yr of periods for sub-annual, else 3
    const window = freq === "annual" ? 3 : ppy;

    const yoy = yoyChange(points);
    const pop = periodChange(points);
    const roll = rollingMean(points, window);
    const cum = cumulative(points);
    const idx = indexed(points, 100);
    const band = volatilityBand(points, window, 2);
    const decomp = trendDecomposition(points);
    const stats = summaryStats(points);

    // align rolling mean with actuals for the dual-line chart
    const rollMap = new Map(roll.map((r) => [r.period, r.value]));
    const rollingRows = points.map((p) => ({
      period: p.period,
      actual: p.value,
      smoothed: rollMap.get(p.period) ?? null,
    }));

    // band width for the stacked-area technique in StatOverlay
    const bandRows = band.map((b) => ({ ...b, bandWidth: b.upper - b.lower }));

    return { points, freq, ppy, window, yoy, pop, rollingRows, cum, idx, band: bandRows, decomp, stats };
  }, [records]);

  const { points, freq, window, yoy, pop, rollingRows, cum, idx, band, decomp, stats } = analysis;

  if (points.length < 3 || !stats) {
    return null; // not enough data to analyse — main chart still renders upstream
  }

  const popLabel = freq === "monthly" ? "Month-on-Month" : freq === "quarterly" ? "Quarter-on-Quarter" : "Period-on-Period";
  const latestYoY = yoy.at(-1);
  const latestPop = pop.at(-1);
  const idxLatest = idx.at(-1);
  const bandLatest = band.at(-1);
  const decompSlope = decomp.length >= 2 ? (decomp.at(-1)!.trend - decomp[0].trend) / (decomp.length - 1) : 0;

  const cards: { key: string; title: string; overlay: React.ReactNode; shows: string; reading: string }[] = [];

  // 1 — Year-on-Year
  if (yoy.length) {
    cards.push({
      key: "yoy",
      title: "Year-on-Year Change",
      overlay: <StatOverlay spec={{ kind: "change", data: yoy }} unit={unit} />,
      shows: "Each bar compares a period to the same period one year earlier, stripping out seasonal effects. Green is growth, red is decline.",
      reading: latestYoY
        ? `Latest year-on-year change: ${signed(latestYoY.pct)}% (${latestYoY.period}). ${latestYoY.pct >= 0 ? "Output is higher than a year ago." : "Output is below where it was a year ago."}`
        : "Insufficient history for a year-on-year comparison.",
    });
  }

  // 2 — Period-on-Period
  if (pop.length) {
    cards.push({
      key: "pop",
      title: `${popLabel} Change`,
      overlay: <StatOverlay spec={{ kind: "change", data: pop }} unit={unit} />,
      shows: `Short-term momentum: how each period compares to the one immediately before it. Useful for spotting turning points earlier than the annual view.`,
      reading: latestPop
        ? `Most recent move: ${signed(latestPop.pct)}% versus the prior period (${latestPop.period}).`
        : "Insufficient data.",
    });
  }

  // 3 — Rolling average
  cards.push({
    key: "rolling",
    title: `${window}-Period Rolling Average`,
    overlay: <StatOverlay spec={{ kind: "rolling", data: rollingRows, window }} unit={unit} />,
    shows: `The faint line is raw data; the bold line is a ${window}-period trailing average that smooths out noise so the underlying direction is visible.`,
    reading: `Smoothing window set to ${window} periods (${freq} data). The averaged line filters short-term spikes to expose the trend.`,
  });

  // 4 — Cumulative
  cards.push({
    key: "cumulative",
    title: "Cumulative Total",
    overlay: <StatOverlay spec={{ kind: "cumulative", data: cum }} unit={unit} />,
    shows: "A running total across every period on record. The steepness of the curve shows how fast volume is accumulating.",
    reading: `Total accumulated to date: ${fmt(cum.at(-1)?.value ?? 0)} ${unit} across ${points.length} periods.`,
  });

  // 5 — Indexed growth
  cards.push({
    key: "indexed",
    title: "Indexed Growth (Base = 100)",
    overlay: <StatOverlay spec={{ kind: "indexed", data: idx, base: 100 }} unit={unit} />,
    shows: "The series rebased so the first period equals 100. Reading is instant: an index of 130 means 30% above the starting point, regardless of the underlying unit.",
    reading: idxLatest
      ? `Current index: ${idxLatest.value.toFixed(0)} — ${idxLatest.value >= 100 ? `${(idxLatest.value - 100).toFixed(0)}% above` : `${(100 - idxLatest.value).toFixed(0)}% below`} the starting level.`
      : "Insufficient data.",
  });

  // 6 — Volatility band
  if (band.length) {
    cards.push({
      key: "band",
      title: "Volatility Band (±2σ)",
      overlay: <StatOverlay spec={{ kind: "band", data: band }} unit={unit} />,
      shows: "The shaded zone is the normal fluctuation range (rolling mean ± 2 standard deviations). Points that break out of the band are statistically unusual.",
      reading: bandLatest
        ? bandLatest.value > bandLatest.upper
          ? `Latest value sits ABOVE the normal range — an unusually high reading worth investigating.`
          : bandLatest.value < bandLatest.lower
          ? `Latest value sits BELOW the normal range — an unusually low reading worth investigating.`
          : `Latest value is within the normal ±2σ range. No statistical anomaly.`
        : "Insufficient data.",
    });
  }

  // 7 — Trend decomposition (bonus analyst view)
  if (decomp.length >= 4) {
    cards.push({
      key: "decomp",
      title: "Trend vs. Noise Decomposition",
      overlay: <StatOverlay spec={{ kind: "decomp", data: decomp }} unit={unit} />,
      shows: "Splits the series into an underlying linear trend (amber) and the residual noise around it (bars). Reveals direction independent of period-to-period volatility.",
      reading: `Underlying trend is ${decompSlope >= 0 ? "rising" : "falling"} at roughly ${fmt(Math.abs(decompSlope))} ${unit} per period. Bars show how far each period deviates from that trend.`,
    });
  }

  return (
    <div style={{ marginBottom: "1.75rem" }}>
      {/* Section header + summary stats strip */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.875rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)" }}>
          Statistical Analysis
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--ink-5)" }}>
          {stats.count} periods · mean {fmt(stats.mean)} {unit} · volatility {stats.volatilityPct.toFixed(0)}%
          {stats.cagr !== null && <> · CAGR {signed(stats.cagr)}%</>}
        </div>
      </div>

      {/* Grid of independent analytical charts */}
      {/* min(380px,100%) prevents horizontal overflow on phones narrower than 380px */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(380px, 100%), 1fr))", gap: "1.25rem" }}>
        {(expanded ? cards : cards.slice(0, INITIAL_VISIBLE)).map((c) => (
          <div key={c.key} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "0.875rem 1.1rem 0.5rem" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)" }}>{c.title}</div>
            </div>
            <div style={{ padding: "0 0.5rem" }}>{c.overlay}</div>
            {/* Predefined logic explanation: static "what this shows" + dynamic reading */}
            <div style={{ marginTop: "auto", padding: "0.75rem 1.1rem", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
              <p style={{ fontSize: "0.72rem", color: "var(--ink-4)", lineHeight: 1.55, margin: "0 0 0.4rem" }}>{c.shows}</p>
              <p style={{ fontSize: "0.72rem", color: "var(--ink)", lineHeight: 1.55, margin: 0, fontWeight: 500, display: "flex", gap: 6 }}>
                <span style={{ color: "var(--green)", fontWeight: 700, flexShrink: 0 }}>Reading:</span>
                <span>{c.reading}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {cards.length > INITIAL_VISIBLE && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}>
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{ padding: "0.5rem 1.5rem", fontSize: "0.78rem", fontWeight: 700, background: expanded ? "transparent" : "var(--surface-white)", color: "var(--green)", border: "1px solid var(--green-line, var(--border))", borderRadius: 20, cursor: "pointer" }}
          >
            {expanded ? "Show fewer analyses ↑" : `See ${cards.length - INITIAL_VISIBLE} more analyses ↓`}
          </button>
        </div>
      )}

      <div style={{ marginTop: "0.75rem", fontSize: "0.68rem", color: "var(--ink-5)", fontStyle: "italic" }}>
        All analyses computed at query time from committed NEDB records for {seriesName}. Percentages are in percentage points; ±2σ covers ~95% of normal variation.
      </div>
    </div>
  );
}
