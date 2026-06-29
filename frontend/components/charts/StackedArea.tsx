"use client";

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
import type { EnergyRecord } from "@/lib/api";

interface Props {
  data: EnergyRecord[];
  unit: string;
}

export default function StackedArea({ data, unit }: Props) {
  // Group by fuel_product if available, else use single series
  const hasFuelProduct = data.some((r) => r.fuel_product);

  if (!hasFuelProduct) {
    const chartData = data.map((r) => ({ period: r.period, value: r.value ?? 0 }));
    return (
      <ResponsiveContainer width="100%" height={360}>
        <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0E7A3C" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#0E7A3C" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E0" />
          <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#8E867B" }} tickLine={false} axisLine={{ stroke: "#E7E5E0" }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: "#8E867B" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toLocaleString()} />
          <Tooltip
            contentStyle={{ background: "#FFFFFF", border: "1px solid #E7E5E0", borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [Number(v).toLocaleString(), unit]}
          />
          <Area type="monotone" dataKey="value" stroke="#0E7A3C" fill="url(#colorValue)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Multi-product stacked area
  const products = [...new Set(data.map((r) => r.fuel_product ?? "").filter(Boolean))];
  const periods = [...new Set(data.map((r) => r.period))].sort();
  const chartData = periods.map((period) => {
    const entry: Record<string, string | number> = { period };
    products.forEach((p) => {
      const row = data.find((r) => r.period === period && r.fuel_product === p);
      entry[p] = row?.value ?? 0;
    });
    return entry;
  });

  const PALETTE = ["#0E7A3C", "#E04F39", "#f59e0b", "#3b82f6", "#8b5cf6", "#06b6d4"];

  return (
    <ResponsiveContainer width="100%" height={360}>
      <AreaChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E0" />
        <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#8E867B" }} tickLine={false} axisLine={{ stroke: "#E7E5E0" }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: "#8E867B" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toLocaleString()} />
        <Tooltip
          contentStyle={{ background: "#FFFFFF", border: "1px solid #E7E5E0", borderRadius: 8, fontSize: 12 }}
          formatter={(v) => [Number(v).toLocaleString(), unit]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#5C5650" }} />
        {products.map((p, i) => (
          <Area
            key={p}
            type="monotone"
            dataKey={p}
            stackId="1"
            stroke={PALETTE[i % PALETTE.length]}
            fill={PALETTE[i % PALETTE.length]}
            fillOpacity={0.25}
            strokeWidth={1.5}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
