"use client";

import type { EnergyRecord } from "@/lib/api";

interface Props {
  data: EnergyRecord[];
  unit: string;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function Heatmap({ data, unit }: Props) {
  // Build year × month grid
  const cellMap = new Map<string, number>();
  let min = Infinity, max = -Infinity;

  data.forEach((r) => {
    if (!r.period || r.value === null) return;
    // Monthly: "2024-07" → year=2024, month=07
    // Quarterly: "2024-Q2" → expand to 3 months (Q2 = Apr/May/Jun = 04,05,06)
    // Annual: "2024" → spread across all 12 months
    const monthly = /^\d{4}-\d{2}$/.test(r.period);
    const quarterly = /^\d{4}-Q([1-4])$/.test(r.period);
    const annual = /^\d{4}$/.test(r.period);
    const year = r.period.slice(0, 4);
    const val = r.value ?? 0;

    if (monthly) {
      const key = r.period;
      cellMap.set(key, val);
      if (val < min) min = val;
      if (val > max) max = val;
    } else if (quarterly) {
      const q = parseInt(r.period.slice(-1));
      const startMonth = (q - 1) * 3 + 1;
      for (let m = startMonth; m < startMonth + 3; m++) {
        const key = `${year}-${String(m).padStart(2, "0")}`;
        cellMap.set(key, val);
      }
      if (val < min) min = val;
      if (val > max) max = val;
    } else if (annual) {
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, "0")}`;
        cellMap.set(key, val);
      }
      if (val < min) min = val;
      if (val > max) max = val;
    }
  });

  const years = [...new Set(data.map((r) => r.period?.slice(0, 4)).filter(Boolean))].sort();
  const range = max - min || 1;

  function getColor(val: number): string {
    const intensity = (val - min) / range;
    const g = Math.round(122 + intensity * (60 - 122));
    const opacity = 0.12 + intensity * 0.88;
    return `rgba(14, ${g}, 60, ${opacity.toFixed(2)})`;
  }

  if (!years.length) {
    return <div style={{ color: "var(--ink-muted)", textAlign: "center", padding: "3rem" }}>Not enough monthly data for heatmap.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
        <thead>
          <tr>
            <th style={{ width: 48, fontSize: 11, color: "var(--ink-muted)", fontWeight: 600, textAlign: "left", paddingBottom: 8 }}>Year</th>
            {MONTHS.map((m) => (
              <th key={m} style={{ fontSize: 10, color: "var(--ink-muted)", fontWeight: 500, textAlign: "center", padding: "0 3px 8px", letterSpacing: "0.04em" }}>{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td style={{ fontSize: 11, color: "var(--ink-secondary)", fontWeight: 500, paddingRight: 8, fontFamily: "JetBrains Mono, monospace" }}>{year}</td>
              {Array.from({ length: 12 }, (_, i) => {
                const key = `${year}-${String(i + 1).padStart(2, "0")}`;
                const val = cellMap.get(key);
                return (
                  <td key={i} title={val !== undefined ? `${key}: ${val.toLocaleString()} ${unit}` : key} style={{ padding: 3 }}>
                    <div style={{
                      width: 32, height: 28, borderRadius: 4,
                      background: val !== undefined ? getColor(val) : "var(--surface-muted)",
                      border: "1px solid var(--border-soft)",
                    }} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 11, color: "var(--ink-muted)" }}>
        <span>Low</span>
        <div style={{ display: "flex", gap: 2 }}>
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <div key={v} style={{ width: 24, height: 12, borderRadius: 2, background: getColor(min + v * range) }} />
          ))}
        </div>
        <span>High · {unit}</span>
      </div>
    </div>
  );
}
