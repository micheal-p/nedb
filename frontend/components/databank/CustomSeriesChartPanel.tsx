"use client";

// ── CustomSeriesChartPanel.tsx ──────────────────────────────────────────────
// Public visualisation for custom (staff-built) series. Custom tables can hold
// several numeric columns (e.g. barrels, USD rate, CBN rate), so a column picker
// selects the metric; the three public viz modes are Line, Bar and Nigeria Map
// (map only offered when records carry state-level regions). Values are read out
// of the JSONB `data` payload keyed by column slug.

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const NigeriaMap = dynamic(() => import("@/components/datapoint/NigeriaMap"), { ssr: false });

export interface CustomColumn {
  name: string;
  slug: string;
  column_type: string;
  unit: string | null;
  is_readonly: boolean;
  display_order: number;
}

export interface CustomRecord {
  period_date: string;
  region: string | null;
  data: Record<string, unknown>;
}

interface Props {
  seriesName: string;
  columns: CustomColumn[];
  records: CustomRecord[];
}

const NATIONAL = new Set(["NGA", "", "national", "National", "NATIONAL"]);

export default function CustomSeriesChartPanel({ seriesName, columns, records }: Props) {
  const numericCols = useMemo(
    () => columns
      .filter((c) => c.column_type === "numeric" || c.column_type === "cbn_rate")
      .sort((a, b) => a.display_order - b.display_order),
    [columns]
  );

  const [colSlug, setColSlug] = useState(numericCols[0]?.slug ?? "");
  const [mode, setMode] = useState<"line" | "bar" | "map">("line");

  const activeCol = numericCols.find((c) => c.slug === colSlug) ?? numericCols[0];
  const unit = activeCol?.unit ?? "";

  // time series for the active column, ascending by date
  const chartData = useMemo(() => {
    if (!activeCol) return [];
    return [...records]
      .filter((r) => typeof r.data?.[activeCol.slug] === "number" || !Number.isNaN(Number(r.data?.[activeCol.slug])))
      .sort((a, b) => a.period_date.localeCompare(b.period_date))
      .map((r) => ({ period: r.period_date, value: Number(r.data[activeCol.slug]) }))
      .filter((r) => Number.isFinite(r.value));
  }, [records, activeCol]);

  // latest value per state for the map mode
  const stateData = useMemo(() => {
    if (!activeCol) return {};
    const latest: Record<string, { date: string; value: number }> = {};
    for (const r of records) {
      const region = r.region ?? "";
      if (NATIONAL.has(region)) continue;
      const v = Number(r.data?.[activeCol.slug]);
      if (!Number.isFinite(v)) continue;
      if (!latest[region] || r.period_date > latest[region].date) {
        latest[region] = { date: r.period_date, value: v };
      }
    }
    return Object.fromEntries(Object.entries(latest).map(([k, v]) => [k, v.value]));
  }, [records, activeCol]);

  const hasGeo = Object.keys(stateData).length > 0;

  if (!numericCols.length || !records.length) {
    return (
      <div className="chart-panel">
        <div className="chart-panel-body" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 280, color: "var(--ink-5)", fontSize: "0.82rem" }}>
          {records.length ? "This table has no numeric columns to chart." : "No records yet — data will appear here once staff commit entries."}
        </div>
      </div>
    );
  }

  return (
    <div className="chart-panel">
      <div className="chart-panel-head" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <div style={{ minWidth: 0 }}>
          <div className="chart-panel-title">{seriesName} — {activeCol?.name}</div>
          <div className="chart-panel-sub">{chartData.length.toLocaleString()} records{unit ? ` · ${unit}` : ""}</div>
        </div>
        {/* Controls: metric picker left of the viz tabs, exports handled by page header */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {numericCols.length > 1 && (
            <select
              value={colSlug}
              onChange={(e) => setColSlug(e.target.value)}
              style={{ height: 30, padding: "0 8px", fontSize: "0.75rem", border: "1px solid var(--border)", borderRadius: 6, background: "#fff", color: "var(--ink)", cursor: "pointer" }}
            >
              {numericCols.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}{c.unit ? ` (${c.unit})` : ""}</option>
              ))}
            </select>
          )}
          <div className="viz-tabs">
            <button className={`viz-tab${mode === "line" ? " active" : ""}`} onClick={() => setMode("line")}>Line</button>
            <button className={`viz-tab${mode === "bar" ? " active" : ""}`} onClick={() => setMode("bar")}>Bar</button>
            {hasGeo && (
              <button className={`viz-tab${mode === "map" ? " active" : ""}`} onClick={() => setMode("map")}>Nigeria Map</button>
            )}
          </div>
        </div>
      </div>

      <div className="chart-panel-body" style={{ minHeight: 320 }}>
        {mode === "map" && hasGeo ? (
          <NigeriaMap
            stateData={stateData}
            title={`${seriesName} — ${activeCol?.name}`}
            unit={unit || ""}
            colorLow="#C8E6C9"
            colorHigh="#1B5E20"
            higherIsBetter
            id="custom-series-map"
            bare
          />
        ) : mode === "bar" ? (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E0" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#8E867B" }} axisLine={{ stroke: "#E7E5E0" }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#8E867B" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toLocaleString()} />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid #E7E5E0", borderRadius: 8, fontSize: 12 }}
                formatter={(v: unknown) => [`${Number(v).toLocaleString()}${unit ? ` ${unit}` : ""}`, activeCol?.name]}
              />
              <Bar dataKey="value" fill="#0E7A3C" radius={[3, 3, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E0" />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#8E867B" }} axisLine={{ stroke: "#E7E5E0" }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#8E867B" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toLocaleString()} />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid #E7E5E0", borderRadius: 8, fontSize: 12 }}
                formatter={(v: unknown) => [`${Number(v).toLocaleString()}${unit ? ` ${unit}` : ""}`, activeCol?.name]}
              />
              <Line type="monotone" dataKey="value" stroke="#0E7A3C" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#0E7A3C" }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="chart-source">
        Data source: ECN / NEDB custom series &nbsp;·&nbsp; Entered via Staff Data Portal{activeCol?.is_readonly ? " · CBN rate captured automatically at entry time" : ""}{unit ? ` · Unit: ${unit}` : ""}
      </div>
    </div>
  );
}
