"use client";

import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface DataPoint { period: string; [key: string]: string | number }
interface Series    { key: string; label: string; color: string }

interface SectorChartProps {
  title:      string;
  subtitle?:  string;
  source?:    string;
  data:       DataPoint[];
  series:     Series[];
  unit?:      string;
  height?:    number;
  filename?:  string;
  note?:      string;
  defaultType?: ChartType;
}

type ChartType = "line" | "bar" | "area" | "column" | "pie" | "donut" | "radar" | "scatter" | "histogram";

const CHART_TYPES: { id: ChartType; icon: string; label: string }[] = [
  { id: "line",      icon: "〜", label: "Line"      },
  { id: "area",      icon: "◭", label: "Area"      },
  { id: "bar",       icon: "▌", label: "Bar"       },
  { id: "column",    icon: "▄", label: "Column"    },
  { id: "pie",       icon: "◑", label: "Pie"       },
  { id: "donut",     icon: "◎", label: "Donut"     },
  { id: "radar",     icon: "✦", label: "Radar"     },
  { id: "scatter",   icon: "⁙", label: "Scatter"   },
  { id: "histogram", icon: "▦", label: "Histogram" },
];

const RADIAN = Math.PI / 180;
function renderCustomLabel(props: { cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number }) {
  const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700}>{`${(percent * 100).toFixed(0)}%`}</text>;
}

export default function SectorChart({ title, subtitle, source, data, series, unit = "", height = 268, filename, note, defaultType = "line" }: SectorChartProps) {
  const [chartType, setChartType] = useState<ChartType>(defaultType);
  // chart type switcher — no pagination needed

  function downloadCSV() {
    if (!data.length) return;
    const keys   = ["period", ...series.map((s) => s.key)];
    const header = keys.join(",");
    const rows   = data.map((r) => keys.map((k) => r[k] ?? "").join(",")).join("\n");
    const blob   = new Blob([`${header}\n${rows}`], { type: "text/csv" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href = url; a.download = `${(filename ?? title).replace(/\s+/g, "-").toLowerCase()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // For histogram: bin the first series values
  const histData = (() => {
    const vals = data.map((d) => Number(d[series[0]?.key] ?? 0));
    const min  = Math.min(...vals), max = Math.max(...vals);
    const bins = 8;
    const size = (max - min) / bins || 1;
    const buckets = Array.from({ length: bins }, (_, i) => ({ period: `${(min + size * i).toFixed(0)}–${(min + size * (i + 1)).toFixed(0)}`, value: 0 }));
    vals.forEach((v) => { const i = Math.min(Math.floor((v - min) / size), bins - 1); buckets[i].value++; });
    return buckets;
  })();

  // For pie / donut: aggregate by period into one value per series
  const pieData = series.map((s) => ({ name: s.label, value: Math.round(data.reduce((acc, d) => acc + Number(d[s.key] ?? 0), 0) / data.length), color: s.color }));
  if (pieData.length === 1) {
    // Single series — use period slices
    const slices = data.slice(0, 8).map((d) => ({ name: d.period, value: Number(d[series[0].key] ?? 0), color: "" }));
    const baseColor = series[0].color;
    const palette   = ["#0E7A3C","#1D4ED8","#B45309","#7C3AED","#9F1239","#059669","#0369A1","#78350F"];
    slices.forEach((s, i) => { s.color = palette[i % palette.length]; });
    if (chartType === "pie" || chartType === "donut") {
      return <ChartShell title={title} subtitle={subtitle} chartType={chartType} setChartType={setChartType} downloadCSV={downloadCSV} note={note}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={slices} cx="50%" cy="50%" innerRadius={chartType === "donut" ? "45%" : 0} outerRadius="75%"
              dataKey="value" labelLine={false} label={renderCustomLabel}>
              {slices.map((s, i) => <Cell key={i} fill={s.color} />)}
            </Pie>
            <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} ${unit}`, ""]} />
            <Legend wrapperStyle={{ fontSize: "0.7rem" }} />
          </PieChart>
        </ResponsiveContainer>
        {source && <div className="chart-source">{source}</div>}
      </ChartShell>;
    }
    pieData.length = 0; pieData.push(...slices.map((s) => ({ ...s, color: baseColor })));
  }

  const commonAxis = {
    xAxis: <XAxis dataKey="period" tick={{ fontSize: 10, fill: "var(--ink-5)" }} axisLine={false} tickLine={false} />,
    yAxis: <YAxis tick={{ fontSize: 10, fill: "var(--ink-5)" }} width={44} axisLine={false} tickLine={false} />,
    grid:  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />,
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", fontSize: "0.78rem", boxShadow: "var(--shadow-2)", minWidth: 140 }}>
        <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 6, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>{label}</div>
        {payload.map((p) => (
          <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 2 }}>
            <span style={{ color: "var(--ink-4)" }}>{p.name}</span>
            <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)", color: p.color }}>{Number(p.value).toLocaleString()} {unit}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderChart = () => {
    if (chartType === "pie" || chartType === "donut") {
      return (
        <PieChart>
          <Pie data={pieData} cx="50%" cy="50%" innerRadius={chartType === "donut" ? "45%" : 0} outerRadius="75%"
            dataKey="value" nameKey="name" labelLine={false} label={renderCustomLabel}>
            {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} ${unit}`, ""]} />
          <Legend wrapperStyle={{ fontSize: "0.7rem" }} />
        </PieChart>
      );
    }
    if (chartType === "radar") {
      const radarData = data.slice(0, 12).map((d) => ({ subject: d.period, ...Object.fromEntries(series.map((s) => [s.key, d[s.key]])) }));
      return (
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: "var(--ink-5)" }} />
          <Tooltip content={<CustomTooltip />} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: "0.72rem" }} />}
          {series.map((s) => <Radar key={s.key} name={s.label} dataKey={s.key} stroke={s.color} fill={s.color} fillOpacity={0.2} />)}
        </RadarChart>
      );
    }
    if (chartType === "scatter") {
      const scatterData = data.map((d, i) => ({ x: i + 1, y: Number(d[series[0].key] ?? 0), z: series[1] ? Number(d[series[1].key] ?? 0) : 1 }));
      return (
        <ScatterChart margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          {commonAxis.grid}
          <XAxis type="number" dataKey="x" name="Index" tick={{ fontSize: 10, fill: "var(--ink-5)" }} axisLine={false} tickLine={false} />
          <YAxis type="number" dataKey="y" name={series[0].label} tick={{ fontSize: 10, fill: "var(--ink-5)" }} width={44} axisLine={false} tickLine={false} />
          {series[1] && <ZAxis type="number" dataKey="z" range={[30, 200]} name={series[1].label} />}
          <Tooltip cursor={{ strokeDasharray: "3 3" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 10px", fontSize: "0.75rem" }}><div style={{ fontWeight: 700 }}>{series[0].label}</div><div style={{ fontFamily: "var(--font-mono)", color: series[0].color }}>{d.y.toLocaleString()} {unit}</div></div>;
          }} />
          <Scatter data={scatterData} fill={series[0].color} />
        </ScatterChart>
      );
    }
    if (chartType === "histogram") {
      return (
        <BarChart data={histData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          {commonAxis.grid}{commonAxis.xAxis}{commonAxis.yAxis}
          <Tooltip formatter={(v) => [`${v} observations`, "Frequency"]} />
          <Bar dataKey="value" name="Frequency" fill={series[0]?.color ?? "#0E7A3C"} radius={[3, 3, 0, 0]} />
        </BarChart>
      );
    }
    if (chartType === "column") {
      return (
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 60, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: "var(--ink-5)" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="period" tick={{ fontSize: 9, fill: "var(--ink-5)" }} axisLine={false} tickLine={false} width={55} />
          <Tooltip content={<CustomTooltip />} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: "0.72rem" }} />}
          {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[0, 3, 3, 0]} maxBarSize={28} />)}
        </BarChart>
      );
    }
    if (chartType === "area") {
      return (
        <AreaChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <defs>{series.map((s) => <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={s.color} stopOpacity={0.18} /><stop offset="95%" stopColor={s.color} stopOpacity={0} /></linearGradient>)}</defs>
          {commonAxis.grid}{commonAxis.xAxis}{commonAxis.yAxis}
          <Tooltip content={<CustomTooltip />} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: "0.72rem" }} />}
          {series.map((s) => <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} fill={`url(#grad-${s.key})`} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />)}
        </AreaChart>
      );
    }
    if (chartType === "bar") {
      return (
        <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          {commonAxis.grid}{commonAxis.xAxis}{commonAxis.yAxis}
          <Tooltip content={<CustomTooltip />} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: "0.72rem" }} />}
          {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={40} />)}
        </BarChart>
      );
    }
    // default: line
    return (
      <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        {commonAxis.grid}{commonAxis.xAxis}{commonAxis.yAxis}
        <Tooltip content={<CustomTooltip />} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: "0.72rem" }} />}
        {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />)}
      </LineChart>
    );
  };

  return (
    <ChartShell title={title} subtitle={subtitle} chartType={chartType} setChartType={setChartType} downloadCSV={downloadCSV} note={note}>
      <div className="chart-panel-body" style={{ padding: "0.75rem 0.25rem 0.25rem" }}>
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
      {source && <div className="chart-source">Source: {source} &nbsp;·&nbsp; Sample data — real records populate as uploads are committed</div>}
    </ChartShell>
  );
}

function ChartShell({ title, subtitle, chartType, setChartType, downloadCSV, note, children }: {
  title: string; subtitle?: string; chartType: ChartType; setChartType: (t: ChartType) => void;
  downloadCSV: () => void; note?: string; children: React.ReactNode;
}) {
  return (
    <div className="chart-panel">
      <div className="chart-panel-head" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ minWidth: 0 }}>
          <div className="chart-panel-title">{title}</div>
          {subtitle && <div className="chart-panel-sub">{subtitle}</div>}
        </div>
        <div style={{ display: "flex", gap: 3, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
          {CHART_TYPES.map((t) => (
            <button key={t.id} onClick={() => setChartType(t.id)} title={t.label} style={{
              height: 26, padding: "0 7px", fontSize: "0.68rem", fontWeight: 700,
              border: "1px solid var(--border)", borderRadius: 4,
              background: chartType === t.id ? "var(--ink)" : "transparent",
              color: chartType === t.id ? "#fff" : "var(--ink-4)", cursor: "pointer",
            }}>
              <span title={t.label}>{t.icon}</span>
            </button>
          ))}
          <button onClick={downloadCSV} style={{ height: 26, padding: "0 10px", fontSize: "0.68rem", fontWeight: 700, border: "1px solid var(--green-line)", borderRadius: 4, background: "var(--green-strong)", color: "var(--green-deep)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            CSV
          </button>
          {note && <span style={{ fontSize: "0.65rem", color: "var(--amber)", fontWeight: 600 }}>{note}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}
