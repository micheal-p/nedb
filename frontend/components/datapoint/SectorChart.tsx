"use client";

import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface DataPoint { period: string; [key: string]: string | number }

interface Series { key: string; label: string; color: string }

interface SectorChartProps {
  title:     string;
  subtitle?: string;
  source?:   string;
  data:      DataPoint[];
  series:    Series[];
  unit?:     string;
  height?:   number;
  filename?: string;
  note?:     string;
}

const TYPE_ICONS: Record<string, string> = { line: "〜", bar: "▌", area: "◭" };

export default function SectorChart({
  title, subtitle, source, data, series, unit = "", height = 268, filename, note,
}: SectorChartProps) {
  const [chartType, setChartType] = useState<"line" | "bar" | "area">("line");

  function downloadCSV() {
    if (!data.length) return;
    const keys = ["period", ...series.map((s) => s.key)];
    const header = keys.join(",");
    const rows   = data.map((r) => keys.map((k) => r[k] ?? "").join(",")).join("\n");
    const blob   = new Blob([`${header}\n${rows}`], { type: "text/csv" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href = url;
    a.download = `${(filename ?? title).replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", fontSize: "0.78rem", boxShadow: "var(--shadow-2)", minWidth: 140 }}>
        <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 6, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>{label}</div>
        {payload.map((p) => (
          <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 12, color: p.color, marginBottom: 2 }}>
            <span style={{ color: "var(--ink-4)" }}>{p.name}</span>
            <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>{Number(p.value).toLocaleString()} {unit}</span>
          </div>
        ))}
      </div>
    );
  };

  const commonProps = {
    data,
    margin: { top: 6, right: 12, left: 0, bottom: 0 },
  };

  const axisProps = {
    xAxis: <XAxis dataKey="period" tick={{ fontSize: 10, fill: "var(--ink-5)" }} axisLine={false} tickLine={false} />,
    yAxis: <YAxis tick={{ fontSize: 10, fill: "var(--ink-5)" }} width={44} axisLine={false} tickLine={false} />,
    grid:  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />,
  };

  return (
    <div className="chart-panel">
      <div className="chart-panel-head">
        <div style={{ minWidth: 0 }}>
          <div className="chart-panel-title">{title}</div>
          {subtitle && <div className="chart-panel-sub">{subtitle}</div>}
        </div>
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
          {(["line", "bar", "area"] as const).map((t) => (
            <button key={t} onClick={() => setChartType(t)} title={t} style={{
              width: 32, height: 28, fontSize: "0.78rem", fontWeight: 700, border: "1px solid var(--border)",
              borderRadius: 4, background: chartType === t ? "var(--ink)" : "transparent",
              color: chartType === t ? "#fff" : "var(--ink-4)", cursor: "pointer",
            }}>
              {TYPE_ICONS[t]}
            </button>
          ))}
          <button onClick={downloadCSV} style={{
            padding: "4px 10px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid var(--green-line)",
            borderRadius: 4, background: "var(--green-strong)", color: "var(--green-deep)", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
        </div>
      </div>

      <div className="chart-panel-body" style={{ padding: "0.75rem 0.25rem 0.25rem" }}>
        <ResponsiveContainer width="100%" height={height}>
          {chartType === "bar" ? (
            <BarChart {...commonProps}>
              {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}
              <Tooltip content={<CustomTooltip />} />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: "0.72rem", paddingTop: 8 }} />}
              {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={40} />)}
            </BarChart>
          ) : chartType === "area" ? (
            <AreaChart {...commonProps}>
              <defs>
                {series.map((s) => (
                  <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={s.color} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}
              <Tooltip content={<CustomTooltip />} />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: "0.72rem", paddingTop: 8 }} />}
              {series.map((s) => (
                <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} fill={`url(#grad-${s.key})`} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              ))}
            </AreaChart>
          ) : (
            <LineChart {...commonProps}>
              {axisProps.grid}{axisProps.xAxis}{axisProps.yAxis}
              <Tooltip content={<CustomTooltip />} />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: "0.72rem", paddingTop: 8 }} />}
              {series.map((s) => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="chart-source" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{source ?? "NEDB · Sample data — real records will populate as uploads are committed"}</span>
        {note && <span style={{ color: "var(--amber)", fontWeight: 600 }}>{note}</span>}
      </div>
    </div>
  );
}
