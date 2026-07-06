"use client";

// Multi-country electricity generation comparison (Ember via OWID).
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { fmtCompact } from "@/lib/format";

export interface AfricaRow { year: number; [country: string]: number }

const COLORS: Record<string, string> = {
  Nigeria: "#0E7A3C", Ghana: "#B45309", Egypt: "#1D4ED8", "South Africa": "#0A0A0A", Kenya: "#7C3AED",
};

export default function AfricaCompare({ data, countries }: { data: AfricaRow[]; countries: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={420}>
      <LineChart data={data} margin={{ top: 10, right: 18, bottom: 6, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E0" />
        <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#8E867B" }} axisLine={{ stroke: "#E7E5E0" }} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#8E867B" }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} label={{ value: "TWh", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#8E867B" } }} />
        <Tooltip formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(1)} TWh`, String(name)]} />
        <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
        {countries.map((c) => (
          <Line key={c} type="monotone" dataKey={c} stroke={COLORS[c] ?? "#57534E"} strokeWidth={c === "Nigeria" ? 3 : 1.8} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
