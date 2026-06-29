"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { EnergyRecord } from "@/lib/api";

interface Props {
  data: EnergyRecord[];
  unit: string;
}

export default function HorizontalBar({ data, unit }: Props) {
  // Show top 20 records sorted by value descending
  const sorted = [...data]
    .filter((r) => r.value !== null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 20);

  const chartData = sorted.map((r) => ({
    period: r.fuel_product ? `${r.period} · ${r.fuel_product}` : r.period,
    value: r.value ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 36)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: 40, bottom: 8, left: 80 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "#8E867B" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => v.toLocaleString()}
        />
        <YAxis
          type="category"
          dataKey="period"
          tick={{ fontSize: 11, fill: "#5C5650" }}
          axisLine={false}
          tickLine={false}
          width={76}
        />
        <Tooltip
          contentStyle={{ background: "#FFFFFF", border: "1px solid #E7E5E0", borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [Number(v).toLocaleString(), unit]}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={i === 0 ? "#0E7A3C" : i < 3 ? "#15803D" : "#E7E5E0"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
