"use client";

// ── SectorChart ─────────────────────────────────────────────────────────────
// The platform's workhorse chart, rebuilt on the validated chart system.
//
// What changed from the old one and why:
//   • Nine chart types were offered including radar and scatter for what is
//     almost always a time series. A form is chosen for the data's job, not
//     offered as a menu — so the switcher is now line, area, column, share and
//     table, and the share views only appear when a share is a sensible read.
//   • Colours came from whatever the caller passed. They now come from the
//     validated categorical order, assigned to the entity so filtering never
//     repaints the survivors.
//   • Every point carried a dot and the tooltip abbreviated. Marks are now thin
//     with a surface ring, the endpoint alone is labelled, and the tooltip
//     carries full precision.
//   • A table view is always available, so no chart is the only way to read
//     the figures.

import { useState, useMemo } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import ChartFrame, { seriesColor, type SeriesDef, type ViewKind } from "@/components/charts/ChartFrame";
import VizTooltip from "@/components/charts/VizTooltip";
import { axisProps, fmtAxis, fmtFull, AXIS } from "@/lib/viz";

interface DataPoint { period: string; [key: string]: string | number }

interface Props {
  title: string;
  subtitle?: string;
  source?: string;
  data: DataPoint[];
  series: { key: string; label: string; color?: string }[];
  unit?: string;
  height?: number;
  filename?: string;
  note?: string;
  defaultType?: ViewKind;
  /** Show share-of-total views. Only meaningful when the series are parts of one whole. */
  allowShare?: boolean;
}

export default function SectorChart({
  title, subtitle, source, data, series, unit = "",
  height = 260, filename, note, defaultType = "line", allowShare = false,
}: Props) {
  const [view, setView] = useState<ViewKind>(defaultType);

  const defs: SeriesDef[] = series.map((s) => ({ key: s.key, label: s.label, color: s.color }));
  const views: ViewKind[] = allowShare
    ? ["line", "area", "column", "donut", "table"]
    : ["line", "area", "column", "table"];

  const hasData = data.length > 0 && series.some((s) => data.some((d) => d[s.key] != null));

  function exportCsv() {
    const keys = ["period", ...series.map((s) => s.key)];
    const head = ["Period", ...series.map((s) => `${s.label}${unit ? ` (${unit})` : ""}`)].join(",");
    const body = data.map((r) => keys.map((k) => r[k] ?? "").join(",")).join("\n");
    const blob = new Blob([`${head}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(filename ?? title).replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Share view aggregates each series across the period — only offered when the
  // caller says the series are parts of one whole.
  const shareData = useMemo(() =>
    series.map((s) => ({
      name: s.label,
      key: s.key,
      value: data.reduce((a, d) => a + (Number(d[s.key]) || 0), 0),
    })).filter((d) => d.value > 0),
  [series, data]);

  const tooltip = <Tooltip content={<VizTooltip unit={unit} />} cursor={{ stroke: AXIS.grid, strokeWidth: 1 }} />;

  const axes = (
    <>
      <CartesianGrid stroke={AXIS.grid} vertical={false} />
      <XAxis dataKey="period" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
      <YAxis {...axisProps} width={54} tickFormatter={fmtAxis} />
    </>
  );

  function plot() {
    if (!hasData) {
      return (
        <div className="viz-empty">
          <div className="viz-empty-title">No data for this period</div>
          <div className="viz-empty-note">
            This chart is empty because no records have been committed for it, not because the value is zero.
          </div>
        </div>
      );
    }

    if (view === "table") {
      return (
        <div className="scroll-x">
          <table className="data-table" style={{ fontSize: "var(--t-sm)" }}>
            <thead>
              <tr>
                <th>Period</th>
                {series.map((s) => (
                  <th key={s.key} style={{ textAlign: "right" }}>{s.label}{unit ? ` (${unit})` : ""}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.period}>
                  <td className="td-primary">{r.period}</td>
                  {series.map((s) => (
                    <td key={s.key} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {r[s.key] == null || r[s.key] === "" ? "—" : fmtFull(Number(r[s.key]))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (view === "donut" || view === "pie") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={shareData} dataKey="value" nameKey="name"
              cx="50%" cy="50%"
              innerRadius={view === "donut" ? "52%" : 0}
              outerRadius="78%"
              // 2px surface gap between segments does the separating, not a stroke
              paddingAngle={1}
              stroke="var(--surface-white)"
              strokeWidth={2}
              labelLine={false}
            >
              {shareData.map((d) => <Cell key={d.key} fill={seriesColor(defs, d.key)} />)}
            </Pie>
            <Tooltip content={<VizTooltip unit={unit} />} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (view === "column") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }} barGap={2}>
            {axes}{tooltip}
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label}
                fill={seriesColor(defs, s.key)}
                // 4px rounded data-end, square at the baseline
                radius={[4, 4, 0, 0]}
                maxBarSize={24} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (view === "area") {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 8, right: 22, left: 0, bottom: 0 }}>
            {axes}{tooltip}
            {series.map((s) => {
              const c = seriesColor(defs, s.key);
              return (
                <Area key={s.key} type="monotone" dataKey={s.key} name={s.label}
                  stroke={c} strokeWidth={2}
                  // a wash, never a saturated block
                  fill={c} fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-white)" }} />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // Default: line
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 30, left: 0, bottom: 0 }}>
          {axes}{tooltip}
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label}
              stroke={seriesColor(defs, s.key)} strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-white)" }}>
              {/* Label the endpoint only — a number on every point goes unread */}
              {series.length <= 3 && (
                <LabelList dataKey={s.key} position="right" offset={8}
                  content={(props) => {
                    const p = props as { index?: number; x?: number | string; y?: number | string; value?: number | string };
                    if (p.index !== data.length - 1 || p.value == null) return null;
                    return (
                      <text x={Number(p.x) + 6} y={Number(p.y)} dy={4}
                        fontSize={11} fontWeight={600} fill={AXIS.label}>
                        {fmtAxis(Number(p.value))}
                      </text>
                    );
                  }} />
              )}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ChartFrame
      title={title} subtitle={subtitle} source={source ? `Source: ${source}` : undefined} note={note}
      series={defs} views={views} view={view} onView={setView}
      onExport={hasData ? exportCsv : undefined}
    >
      {plot()}
    </ChartFrame>
  );
}
