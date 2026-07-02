"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { EnergyRecord } from "@/lib/api";

const LineChart     = dynamic(() => import("@/components/charts/LineChart"),     { ssr: false });
const StackedArea   = dynamic(() => import("@/components/charts/StackedArea"),   { ssr: false });
const HorizontalBar = dynamic(() => import("@/components/charts/HorizontalBar"), { ssr: false });
const Heatmap       = dynamic(() => import("@/components/charts/Heatmap"),       { ssr: false });

const VIZ_LABELS: Record<string, string> = {
  "line":             "Line",
  "stacked-area":     "Stacked Area",
  "horizontal-bar":   "Rankings",
  "heatmap":          "Heatmap",
  "choropleth":       "Choropleth",
  "small-multiples":  "Small Multiples",
  "sankey":           "Energy Flow",
  "calendar-heatmap": "Calendar",
};

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
      case "line":           return <LineChart data={data} unit={unit} />;
      case "stacked-area":   return <StackedArea data={data} unit={unit} />;
      case "horizontal-bar": return <HorizontalBar data={data} unit={unit} />;
      case "heatmap":        return <Heatmap data={data} unit={unit} />;
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
        Source: NEDB / {source} &nbsp;·&nbsp; Unit: {unit} &nbsp;·&nbsp; Data as at last upload commit
      </div>
    </div>
  );
}
