"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { EnergyRecord } from "@/lib/api";
import InfoTip from "@/components/ui/InfoTip";

const LineChart      = dynamic(() => import("@/components/charts/LineChart"),      { ssr: false });
const StackedArea    = dynamic(() => import("@/components/charts/StackedArea"),    { ssr: false });
const HorizontalBar  = dynamic(() => import("@/components/charts/HorizontalBar"),  { ssr: false });
const CalendarHeatmap = dynamic(() => import("@/components/charts/Heatmap"),       { ssr: false });
const NigeriaMap     = dynamic(() => import("@/components/datapoint/NigeriaMap"),  { ssr: false });
const LgaMap         = dynamic(() => import("@/components/datapoint/LgaMap"),      { ssr: false });

const VIZ_LABELS: Record<string, string> = {
  "line":             "Line",
  "stacked-area":     "Stacked Area",
  "horizontal-bar":   "Rankings",
  "heatmap":          "Nigeria Map",
  "choropleth":       "Nigeria Map",
  "lga-map":          "LGA Map",
  "small-multiples":  "Small Multiples",
  "sankey":           "Energy Flow",
  "calendar-heatmap": "Calendar",
};

const NATIONAL_REGIONS = new Set(["NGA", "", "national", "National", "NATIONAL"]);
const FORECAST_PERIODS = 8;

function linearRegression(xs: number[], ys: number[]) {
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function nextPeriod(period: string, steps: number): string {
  if (/^\d{4}-\d{2}$/.test(period)) {
    // monthly YYYY-MM
    let [y, m] = period.split("-").map(Number);
    m += steps;
    while (m > 12) { m -= 12; y++; }
    return `${y}-${String(m).padStart(2, "0")}`;
  }
  if (/^\d{4}-Q\d$/.test(period)) {
    // quarterly YYYY-Qn
    let [y, q] = [parseInt(period), parseInt(period.split("Q")[1])];
    y = parseInt(period.split("-")[0]);
    q += steps;
    while (q > 4) { q -= 4; y++; }
    return `${y}-Q${q}`;
  }
  // annual
  return String(parseInt(period) + steps);
}

interface Props {
  title: string;
  subtitle: string;
  source: string;
  vizTypes: string[];
  data: EnergyRecord[];
  unit: string;
  seriesId?: string;
  lgaData?: Record<string, number>;  // normalized-lga-name → latest value (adds an LGA Map tab)
}

export default function SeriesChartPanel({ title, subtitle, source, vizTypes, data, unit, seriesId, lgaData }: Props) {
  // State-tagged rows exist for choropleths — time-series charts must plot the
  // national series only, or duplicate periods across states garble the line.
  const natData = useMemo(
    () => data.filter((r) => !r.region || NATIONAL_REGIONS.has(r.region)),
    [data]
  );
  // LGA Map tab appears only when the series actually carries LGA-tagged records
  const allVizTypes = lgaData && Object.keys(lgaData).length
    ? [...vizTypes.filter((v) => v !== "lga-map"), "lga-map"]
    : vizTypes;
  const [active, setActive] = useState(allVizTypes[0] ?? "line");
  const [showProjection, setShowProjection] = useState(false);

  const stateData = useMemo<Record<string, number>>(() => {
    const latest: Record<string, { date: string; value: number }> = {};
    for (const r of data) {
      if (!r.region || NATIONAL_REGIONS.has(r.region) || r.value === null) continue;
      const existing = latest[r.region];
      if (!existing || r.period_date > existing.date) {
        latest[r.region] = { date: r.period_date, value: r.value };
      }
    }
    return Object.fromEntries(Object.entries(latest).map(([k, v]) => [k, v.value]));
  }, [data]);

  const projectionData = useMemo(() => {
    if (!showProjection || natData.length < 6) return undefined;
    const vals = natData.map((r) => r.value).filter((v) => v !== null) as number[];
    const xs = vals.map((_, i) => i);
    const { slope, intercept } = linearRegression(xs, vals);
    const lastPeriod = natData[natData.length - 1].period;
    return Array.from({ length: FORECAST_PERIODS }, (_, i) => ({
      period:    nextPeriod(lastPeriod, i + 1),
      projected: Math.max(0, intercept + slope * (vals.length + i)),
    }));
  }, [showProjection, natData]);

  function Chart() {
    if (!data.length) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: "0.5rem", color: "var(--ink-5)" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.3 }}>
            <path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-4"/>
          </svg>
          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-4)" }}>No data yet</div>
          <Link href="/upload" style={{ fontSize: "0.75rem", color: "var(--green)", fontWeight: 600 }}>Upload data to populate this chart</Link>
        </div>
      );
    }
    switch (active) {
      case "line":            return <LineChart data={natData} unit={unit} projectionData={projectionData} />;
      case "stacked-area":    return <StackedArea data={natData} unit={unit} />;
      case "horizontal-bar":  return <HorizontalBar data={natData} unit={unit} />;
      case "calendar-heatmap": return <CalendarHeatmap data={natData} unit={unit} />;
      case "lga-map":
        return (
          <LgaMap
            lgaData={lgaData ?? {}}
            title={title}
            unit={unit}
            source={source}
            bare
          />
        );
      case "heatmap":
      case "choropleth":
        return (
          <NigeriaMap
            stateData={stateData}
            title={title}
            unit={unit}
            colorLow="#C8E6C9"
            colorHigh="#1B5E20"
            higherIsBetter
            id="series-map"
            source={source}
            bare
          />
        );
      default:
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "var(--ink-4)" }}>
            <p style={{ fontSize: "0.82rem" }}>{VIZ_LABELS[active] ?? active} — visualisation coming soon</p>
          </div>
        );
    }
  }

  return (
    <div className="chart-panel">
      <div className="chart-panel-head">
        <div>
          <div className="chart-panel-title">{title}</div>
          <div className="chart-panel-sub">{subtitle}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Forecast toggle — only on line view */}
          {active === "line" && natData.length >= 6 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={() => setShowProjection((p) => !p)}
                style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem", borderRadius: 20, border: `1px solid ${showProjection ? "var(--green)" : "var(--border)"}`, background: showProjection ? "var(--green-tint)" : "transparent", color: showProjection ? "var(--green)" : "var(--ink-4)", cursor: "pointer", fontWeight: 600, letterSpacing: "0.04em" }}
              >
                {showProjection ? "Hide Projection" : "Projection"}
              </button>
              <InfoTip text="Extends the line chart using linear regression (OLS) on all available data points. The dashed line shows estimated future values — for indicative purposes only, not a formal forecast." width={240} position="bottom" />
            </span>
          )}
          {/* Compare link */}
          {seriesId && (
            <a href={`/compare?a=${seriesId}`} style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem", borderRadius: 20, border: "1px solid var(--border)", background: "transparent", color: "var(--ink-4)", cursor: "pointer", fontWeight: 600, textDecoration: "none", letterSpacing: "0.04em" }}>
              Compare
            </a>
          )}
          <div className="viz-tabs">
            {allVizTypes.map((vt) => (
              <button
                key={vt}
                className={`viz-tab${active === vt ? " active" : ""}`}
                onClick={() => setActive(vt)}
              >
                {VIZ_LABELS[vt] ?? vt}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="chart-panel-body" style={{ minHeight: 320 }}>
        {Chart()}
      </div>
      {showProjection && projectionData && (
        <div style={{ padding: "0.5rem 1rem", background: "var(--green-tint)", borderTop: "1px solid var(--border)", fontSize: "0.72rem", color: "var(--green)", fontWeight: 600 }}>
          Projection: linear regression on {natData.length} data points, extended {FORECAST_PERIODS} periods forward. For indicative purposes only.
        </div>
      )}
      <div className="chart-source">
        Data source: {source || "ECN / NEDB"} &nbsp;·&nbsp; Committed to NEDB via Staff Upload Portal &nbsp;·&nbsp; Unit: {unit}
      </div>
    </div>
  );
}
