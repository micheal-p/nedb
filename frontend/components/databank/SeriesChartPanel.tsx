"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { EnergyRecord } from "@/lib/api";

const LineChart      = dynamic(() => import("@/components/charts/LineChart"),      { ssr: false });
const StackedArea    = dynamic(() => import("@/components/charts/StackedArea"),    { ssr: false });
const HorizontalBar  = dynamic(() => import("@/components/charts/HorizontalBar"),  { ssr: false });
const CalendarHeatmap = dynamic(() => import("@/components/charts/Heatmap"),       { ssr: false });
const NigeriaMap     = dynamic(() => import("@/components/datapoint/NigeriaMap"),  { ssr: false });

const VIZ_LABELS: Record<string, string> = {
  "line":             "Line",
  "stacked-area":     "Stacked Area",
  "horizontal-bar":   "Rankings",
  "heatmap":          "Nigeria Map",
  "choropleth":       "Nigeria Map",
  "small-multiples":  "Small Multiples",
  "sankey":           "Energy Flow",
  "calendar-heatmap": "Calendar",
};

const NATIONAL_REGIONS = new Set(["NGA", "", "national", "National", "NATIONAL"]);

interface Props {
  title: string;
  subtitle: string;
  source: string;
  vizTypes: string[];
  data: EnergyRecord[];
  unit: string;
}

export default function SeriesChartPanel({ title, subtitle, source, vizTypes, data, unit }: Props) {
  const [active, setActive] = useState(vizTypes[0] ?? "line");

  // Build state-level map: latest value per Nigerian state (non-national rows)
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

  function Chart() {
    if (data.length === 0) {
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
      case "line":            return <LineChart data={data} unit={unit} />;
      case "stacked-area":    return <StackedArea data={data} unit={unit} />;
      case "horizontal-bar":  return <HorizontalBar data={data} unit={unit} />;
      case "calendar-heatmap": return <CalendarHeatmap data={data} unit={unit} />;
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
        <div className="viz-tabs">
          {vizTypes.map((vt) => (
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
      <div className="chart-panel-body" style={{ minHeight: 320 }}>
        <Chart />
      </div>
      <div className="chart-source">
        Data source: {source || "ECN / NEDB"} &nbsp;·&nbsp; Committed to NEDB via Staff Upload Portal &nbsp;·&nbsp; Unit: {unit}
      </div>
    </div>
  );
}
