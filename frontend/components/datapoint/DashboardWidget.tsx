"use client";

// ── DashboardWidget.tsx ─────────────────────────────────────────────────────
// Renders one admin-composed widget (chart / KPI / map) from its saved config,
// using the same live data the built-in dashboard views use. Keeps custom
// tabs visually identical to the hand-built ones by reusing SectorChart and
// NigeriaMap.

import dynamic from "next/dynamic";
import { seriesMeta, WIDGET_COLORS, type WidgetKind, type WidgetConfig } from "@/lib/dashboard-builder";

const SectorChart = dynamic(() => import("@/components/datapoint/SectorChart"), { ssr: false });
const NigeriaMap  = dynamic(() => import("@/components/datapoint/NigeriaMap"),  { ssr: false });

type SeriesRow = { period: string; value: number; unit?: string };
type DashData = Record<string, SeriesRow[]>;

export type WidgetData = { kind: WidgetKind; title: string | null; config: WidgetConfig };

type MergedRow = { period: string; [key: string]: string | number };
function mergeSeries(pairs: { data: SeriesRow[]; key: string }[]): MergedRow[] {
  const map = new Map<string, MergedRow>();
  for (const { data, key } of pairs) {
    for (const r of data) {
      const row = map.get(r.period) ?? { period: r.period };
      row[key] = r.value;
      map.set(r.period, row);
    }
  }
  return [...map.values()];
}

function fmtValue(v: number): string {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function DashboardWidget({ widget, dashData, stateMap, year }: {
  widget: WidgetData; dashData: DashData; stateMap: Record<string, Record<string, number>>; year: number;
}) {
  const { kind, title, config } = widget;
  const ids = config.series ?? [];
  const s = (id: string): SeriesRow[] => dashData[id] ?? [];
  const primary = ids[0];
  const meta = primary ? seriesMeta(primary) : undefined;
  const unit = config.unit || meta?.unit || "";

  if (kind === "kpi") {
    // One tile per chosen series — latest value + change vs previous period.
    return (
      <div className="chart-panel" style={{ minWidth: 0 }}>
        <div className="chart-panel-head"><div><div className="chart-panel-title">{title || "Key Indicators"}</div></div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", padding: "0.5rem 0" }}>
          {ids.map((id) => {
            const rows = s(id);
            const m = seriesMeta(id);
            const latest = rows[rows.length - 1];
            const prev = rows[rows.length - 2];
            const change = latest && prev && prev.value ? ((latest.value - prev.value) / Math.abs(prev.value)) * 100 : null;
            const up = change != null && change >= 0;
            const good = m?.higherIsBetter === false ? !up : up;
            return (
              <div key={id} style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m?.label ?? id}</div>
                <div style={{ fontSize: "1.35rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)", lineHeight: 1 }}>
                  {latest ? fmtValue(latest.value) : "—"}
                  {latest && <span style={{ fontSize: "0.65rem", color: "var(--ink-5)", fontFamily: "var(--font-sans)", marginLeft: 4 }}>{m?.unit}</span>}
                </div>
                <div style={{ fontSize: "0.66rem", marginTop: 5, color: change == null ? "var(--ink-5)" : good ? "var(--green)" : "var(--red)" }}>
                  {change == null ? (latest ? latest.period : "No data yet") : `${up ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}% · ${latest.period}`}
                </div>
              </div>
            );
          })}
        </div>
        <div className="chart-source">Source: {meta?.source ?? "NEDB"}</div>
      </div>
    );
  }

  if (kind === "map") {
    const data = primary ? stateMap[primary] ?? {} : {};
    return (
      <NigeriaMap
        stateData={data}
        id={`w-${primary}`}
        title={title || `${meta?.label ?? "Series"} by State`}
        unit={unit}
        colorLow="#FEF3C7"
        colorHigh="#0E7A3C"
        higherIsBetter={config.higherIsBetter ?? meta?.higherIsBetter ?? true}
        source={meta?.source ?? "NEDB"}
      />
    );
  }

  // chart (default): one or many series merged onto a shared period axis
  const hasData = ids.some((id) => s(id).length);
  if (!hasData) {
    return (
      <div className="chart-panel" style={{ minWidth: 0 }}>
        <div className="chart-panel-head"><div><div className="chart-panel-title">{title || meta?.label || "Chart"}</div></div></div>
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--ink-5)", fontSize: "0.8rem" }}>No data yet for {year} — add records via Admin → Data Entry.</div>
      </div>
    );
  }
  const merged = mergeSeries(ids.map((id) => ({ data: s(id), key: id })));
  const series = ids.map((id, i) => ({ key: id, label: seriesMeta(id)?.label ?? id, color: WIDGET_COLORS[i % WIDGET_COLORS.length] }));
  return (
    <SectorChart
      title={title || meta?.label || "Chart"}
      subtitle={`${year}`}
      source={meta?.source ?? "NEDB"}
      data={merged}
      series={series}
      unit={unit}
      defaultType={config.chartType ?? "line"}
      filename={`custom-${primary}`}
    />
  );
}
