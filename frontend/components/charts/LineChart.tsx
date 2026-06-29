"use client";

import {
  LineChart as ReLineChart,
  Line,
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

export default function LineChart({ data, unit }: Props) {
  const chartData = data.map((r) => ({
    period: r.period,
    value: r.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={360}>
      <ReLineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E0" />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 11, fill: "#8E867B" }}
          axisLine={{ stroke: "#E7E5E0" }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#8E867B" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => v.toLocaleString()}
          label={{ value: unit, angle: -90, position: "insideLeft", offset: -4, style: { fontSize: 11, fill: "#8E867B" } }}
        />
        <Tooltip
          contentStyle={{
            background: "#FFFFFF",
            border: "1px solid #E7E5E0",
            borderRadius: 8,
            fontSize: 12,
            boxShadow: "0 4px 16px rgba(10,10,10,0.08)",
          }}
          formatter={(v) => [Number(v).toLocaleString(), unit]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#0E7A3C"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: "#0E7A3C" }}
        />
      </ReLineChart>
    </ResponsiveContainer>
  );
}
