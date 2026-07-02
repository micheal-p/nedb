"use client";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import InfoTip from "@/components/ui/InfoTip";
import type { SeriesType, EnergyRecord } from "@/lib/api";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

const COLORS = ["#0E7A3C", "#E04F39"];

export default function ComparePage() {
  const [seriesList, setSeriesList] = useState<SeriesType[]>([]);
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [dataA, setDataA] = useState<EnergyRecord[]>([]);
  const [dataB, setDataB] = useState<EnergyRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/series").then((r) => r.json()).then(setSeriesList).catch(() => {});
  }, []);

  async function loadSeries(id: string): Promise<EnergyRecord[]> {
    if (!id) return [];
    const r = await fetch(`/api/series/${id}/data?limit=500`);
    const j = await r.json();
    return (j.rows ?? j) as EnergyRecord[];
  }

  async function compare() {
    if (!idA || !idB) return;
    setLoading(true);
    const [a, b] = await Promise.all([loadSeries(idA), loadSeries(idB)]);
    setDataA(a); setDataB(b);
    setLoading(false);
  }

  const merged = useMemo(() => {
    if (!dataA.length && !dataB.length) return [];
    const map = new Map<string, { period: string; a?: number; b?: number }>();
    for (const r of dataA) {
      const row = map.get(r.period) ?? { period: r.period };
      row.a = r.value ?? undefined;
      map.set(r.period, row);
    }
    for (const r of dataB) {
      const row = map.get(r.period) ?? { period: r.period };
      row.b = r.value ?? undefined;
      map.set(r.period, row);
    }
    return [...map.values()].sort((x, y) => x.period.localeCompare(y.period));
  }, [dataA, dataB]);

  const metaA = seriesList.find((s) => s.id === idA);
  const metaB = seriesList.find((s) => s.id === idB);

  return (
    <>
      <Navbar active="databank" />
      <div style={{ background: "var(--surface-white)", borderBottom: "1px solid var(--border)", padding: "2rem 0" }}>
        <div className="page-wrap">
          <div style={{ fontSize: "0.75rem", color: "var(--ink-4)", marginBottom: "0.75rem" }}>
            <Link href="/" style={{ color: "var(--green)", fontWeight: 600 }}>Data Bank</Link>
            <span style={{ margin: "0 0.5rem" }}>/</span>
            <span>Series Comparison</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.75rem", fontWeight: 400, color: "var(--ink)" }}>Series Comparison</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--ink-4)", marginTop: "0.4rem" }}>Overlay two data series on a dual-axis chart to compare trends over time.</p>
        </div>
      </div>

      <main style={{ background: "var(--surface)", padding: "2rem 0 5rem" }}>
        <div className="page-wrap">
          {/* Selector row */}
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: 1, minWidth: 220 }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: COLORS[0], display: "flex", alignItems: "center", gap: 4 }}>
                Series A
                <InfoTip text="Plotted on the left Y-axis in green. Tip: compare series with different units (e.g. production vs revenue) — each axis scales independently." position="bottom" width={230} />
              </span>
              <select className="form-input" value={idA} onChange={(e) => setIdA(e.target.value)}>
                <option value="">Select series…</option>
                {seriesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: 1, minWidth: 220 }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: COLORS[1] }}>Series B</span>
              <select className="form-input" value={idB} onChange={(e) => setIdB(e.target.value)}>
                <option value="">Select series…</option>
                {seriesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <button className="btn btn-primary" onClick={compare} disabled={!idA || !idB || loading} style={{ paddingBottom: "0.55rem", paddingTop: "0.55rem" }}>
              {loading ? "Loading…" : "Compare"}
            </button>
          </div>

          {/* Chart */}
          {merged.length > 0 && (
            <div className="chart-panel">
              <div className="chart-panel-head">
                <div>
                  <div className="chart-panel-title">
                    <span style={{ color: COLORS[0] }}>{metaA?.name ?? idA}</span>
                    <span style={{ color: "var(--ink-5)", margin: "0 0.5rem" }}>vs</span>
                    <span style={{ color: COLORS[1] }}>{metaB?.name ?? idB}</span>
                  </div>
                  <div className="chart-panel-sub">{merged.length} shared periods · dual Y-axis</div>
                </div>
              </div>
              <div className="chart-panel-body" style={{ minHeight: 380 }}>
                <ResponsiveContainer width="100%" height={380}>
                  <ComposedChart data={merged} margin={{ top: 8, right: 40, bottom: 8, left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E0" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#8E867B" }} axisLine={{ stroke: "#E7E5E0" }} tickLine={false} interval="preserveStartEnd" />
                    <YAxis yAxisId="a" orientation="left"  tick={{ fontSize: 11, fill: COLORS[0] }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toLocaleString()} label={{ value: metaA?.unit_default ?? "", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: COLORS[0] } }} />
                    <YAxis yAxisId="b" orientation="right" tick={{ fontSize: 11, fill: COLORS[1] }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v.toLocaleString()} label={{ value: metaB?.unit_default ?? "", angle: 90,  position: "insideRight", style: { fontSize: 11, fill: COLORS[1] } }} />
                    <Tooltip
                      contentStyle={{ background: "#fff", border: "1px solid #E7E5E0", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: unknown, name: unknown) => [Number(v).toLocaleString(), name === "a" ? (metaA?.name ?? "A") : (metaB?.name ?? "B")]}
                    />
                    <Legend formatter={(v) => v === "a" ? (metaA?.name ?? "A") : (metaB?.name ?? "B")} />
                    <Line yAxisId="a" type="monotone" dataKey="a" stroke={COLORS[0]} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls />
                    <Line yAxisId="b" type="monotone" dataKey="b" stroke={COLORS[1]} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-source">
                {metaA?.name} ({metaA?.unit_default}) &nbsp;·&nbsp; {metaB?.name} ({metaB?.unit_default}) &nbsp;·&nbsp; Source: ECN / NEDB
              </div>
            </div>
          )}

          {!merged.length && idA && idB && !loading && (
            <div style={{ textAlign: "center", padding: "4rem", color: "var(--ink-5)", fontSize: "0.85rem" }}>
              Click <strong>Compare</strong> to load the chart.
            </div>
          )}

          {!idA && !idB && (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--ink-5)" }}>
              <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24" style={{ opacity: 0.3, marginBottom: "0.75rem" }}><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 4-4"/></svg>
              <p style={{ fontSize: "0.82rem" }}>Select two series above and click Compare.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
