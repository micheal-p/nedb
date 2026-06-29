"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
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
  vizTypes: string[];
  data: EnergyRecord[];
  unit: string;
  compact?: boolean;    // render only the tab strip
  renderChart?: boolean; // render only the chart (no tabs)
}

export default function VizSwitcher({ vizTypes, data, unit, compact, renderChart: renderChartOnly }: Props) {
  const [active, setActive] = useState(vizTypes[0] ?? "line");

  function Chart() {
    if (data.length === 0) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "var(--ink-4)" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>No records uploaded for this series.</p>
            <p style={{ fontSize: "0.78rem" }}>Upload a dataset using the button above.</p>
          </div>
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

  const Tabs = () => (
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
  );

  // compact = tabs only (for chart-panel-head)
  if (compact) return <Tabs />;
  // renderChart = chart only (for chart-panel-body)
  if (renderChartOnly) return <Chart />;

  // Default: tabs + chart together (standalone usage)
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <Tabs />
      </div>
      <div style={{ minHeight: 320 }}>
        <Chart />
      </div>
    </div>
  );
}
