"use client";

import { SERIES_COLORS } from "@/lib/viz";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Sample downstream throughput data (FY 2026)
const DATA = [
  { period: "Jan", pms: 4800, ago: 6200 },
  { period: "Feb", pms: 5100, ago: 6800 },
  { period: "Mar", pms: 5600, ago: 7100 },
  { period: "Apr", pms: 4900, ago: 6500 },
  { period: "May", pms: 5800, ago: 7400 },
  { period: "Jun", pms: 6200, ago: 7900 },
  { period: "Jul", pms: 5900, ago: 7600 },
  { period: "Aug", pms: 6100, ago: 8100 },
  { period: "Sep", pms: 5700, ago: 7700 },
  { period: "Oct", pms: 6400, ago: 8400 },
  { period: "Nov", pms: 6000, ago: 8000 },
  { period: "Dec", pms: 5800, ago: 7800 },
];

export default function OverviewChart() {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={DATA} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
        <defs>
          <linearGradient id="gradPMS" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={SERIES_COLORS[0]} stopOpacity={0.25} />
            <stop offset="95%" stopColor={SERIES_COLORS[0]} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradAGO" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={SERIES_COLORS[2]} stopOpacity={0.2} />
            <stop offset="95%" stopColor={SERIES_COLORS[2]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border-soft)" vertical={false} />
        <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--ink-4)" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "var(--ink-4)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
        <Tooltip
          contentStyle={{ background: "#FFFFFF", border: "1px solid #E7E5E0", borderRadius: 8, fontSize: 12 }}
          formatter={(v, name) => [`${Number(v).toLocaleString()} L`, name === "pms" ? "PMS" : "AGO"]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#5C5650" }} formatter={(v) => v === "pms" ? "PMS (Petrol)" : "AGO (Diesel)"} />
        <Area type="monotone" dataKey="pms" stroke={SERIES_COLORS[0]} fill="url(#gradPMS)" strokeWidth={2} />
        <Area type="monotone" dataKey="ago" stroke={SERIES_COLORS[2]} fill="url(#gradAGO)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
