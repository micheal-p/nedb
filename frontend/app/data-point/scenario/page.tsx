"use client";

// ── Scenario Studio (NECAL-lite) ─────────────────────────────────────────────
// Interactive what-if projections over any populated NEDB series: two scenarios
// with adjustable growth rates (defaulting to the series' own historical CAGR)
// and an optional one-off shock year, projected to 2030/2040/2050. A deliberate,
// honest simplification of the NECAL2050 idea — compound paths, not a full
// energy-system model, and labelled as such.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { isLoggedIn } from "@/lib/auth";
import { fmtCompact } from "@/lib/format";
import CoatOfArms from "@/components/layout/CoatOfArms";

interface SeriesInfo { id: string; name: string; unit_default: string; record_count: number }
interface Row { period: string; period_date: string; value: number | null; region: string }

const NATIONAL = new Set(["NGA", "", "national", "National", "NATIONAL"]);
const STOCK_UNITS = ["MW"]; // capacity-like series: yearly level = last value, not sum

function annualize(rows: Row[], unit: string): { year: number; value: number }[] {
  const nat = rows.filter((r) => (!r.region || NATIONAL.has(r.region)) && r.value !== null);
  const byYear = new Map<number, number[]>();
  for (const r of nat) {
    const y = parseInt(r.period_date.slice(0, 4));
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(Number(r.value));
  }
  const stock = STOCK_UNITS.includes(unit);
  return [...byYear.entries()]
    .map(([year, vals]) => ({ year, value: stock ? vals[vals.length - 1] : vals.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => a.year - b.year);
}

function cagrOf(hist: { year: number; value: number }[]): number {
  if (hist.length < 2) return 2;
  const a = hist[0], b = hist[hist.length - 1];
  if (a.value <= 0 || b.value <= 0 || b.year === a.year) return 2;
  return (Math.pow(b.value / a.value, 1 / (b.year - a.year)) - 1) * 100;
}

export default function ScenarioStudio() {
  const router = useRouter();
  const [series, setSeries] = useState<SeriesInfo[]>([]);
  const [sel, setSel] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [horizon, setHorizon] = useState(2040);
  const [growthA, setGrowthA] = useState(2);
  const [growthB, setGrowthB] = useState(5);
  const [shockYear, setShockYear] = useState(0);   // 0 = none
  const [shockPct, setShockPct] = useState(-20);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/data-point/scenario"); return; }
    fetch("/api/series").then((r) => r.json()).then((list: SeriesInfo[]) => {
      const populated = list.filter((s) => s.record_count > 0);
      setSeries(populated);
      if (populated.length) setSel(populated[0].id);
    }).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!sel) return;
    setLoading(true);
    fetch(`/api/series/${sel}/data?limit=500`)
      .then((r) => r.json())
      .then((j) => setRows(j.rows ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sel]);

  const info = series.find((s) => s.id === sel);
  const hist = useMemo(() => annualize(rows, info?.unit_default ?? ""), [rows, info]);
  const histCagr = useMemo(() => cagrOf(hist), [hist]);

  // Default scenario A to the series' own trajectory whenever the series changes
  useEffect(() => { setGrowthA(Math.round(histCagr * 10) / 10); }, [histCagr]);

  const chart = useMemo(() => {
    if (!hist.length) return [];
    const lastYear = hist[hist.length - 1].year;
    const lastVal = hist[hist.length - 1].value;
    const out: { year: number; history?: number; scenarioA?: number; scenarioB?: number }[] =
      hist.map((h) => ({ year: h.year, history: h.value }));
    let a = lastVal, b = lastVal;
    for (let y = lastYear + 1; y <= horizon; y++) {
      a *= 1 + growthA / 100;
      b *= 1 + growthB / 100;
      if (y === shockYear) { a *= 1 + shockPct / 100; b *= 1 + shockPct / 100; }
      out.push({ year: y, scenarioA: Math.max(0, a), scenarioB: Math.max(0, b) });
    }
    // stitch the projection lines to the last historical point
    const last = out.find((o) => o.year === lastYear);
    if (last) { last.scenarioA = lastVal; last.scenarioB = lastVal; }
    return out;
  }, [hist, horizon, growthA, growthB, shockYear, shockPct]);

  const endA = chart.at(-1)?.scenarioA ?? 0;
  const endB = chart.at(-1)?.scenarioB ?? 0;
  const lastVal = hist.at(-1)?.value ?? 0;
  const shockYears = hist.length ? Array.from({ length: horizon - hist[hist.length - 1].year }, (_, i) => hist[hist.length - 1].year + 1 + i) : [];

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)" }}>
      {/* Header */}
      <div style={{ background: "#1B2A4A", padding: "1.5rem 0" }}>
        <div className="page-wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
            <CoatOfArms size={40} />
            <div>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Data Point · NECAL-lite</div>
              <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "1.4rem", fontWeight: 400, color: "#fff", margin: 0 }}>Scenario Studio</h1>
            </div>
          </div>
          <Link href="/data-point/dashboard" className="btn btn-ghost btn-sm">← Dashboard</Link>
        </div>
      </div>

      <main className="page-wrap" style={{ padding: "1.75rem 2rem 4rem" }}>
        {/* Controls */}
        <div className="panel" style={{ marginBottom: "1.25rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem", padding: "1.1rem 1.25rem" }}>
            <div>
              <label className="form-label">Series</label>
              <select className="form-input form-select" value={sel} onChange={(e) => setSel(e.target.value)}>
                {series.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Horizon</label>
              <select className="form-input form-select" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
                {[2030, 2040, 2050].map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Scenario A growth %/yr <span style={{ color: "var(--ink-5)", fontWeight: 400 }}>(historical: {histCagr.toFixed(1)}%)</span></label>
              <input className="form-input" type="number" step="0.1" value={growthA} onChange={(e) => setGrowthA(Number(e.target.value))} />
            </div>
            <div>
              <label className="form-label">Scenario B growth %/yr</label>
              <input className="form-input" type="number" step="0.1" value={growthB} onChange={(e) => setGrowthB(Number(e.target.value))} />
            </div>
            <div>
              <label className="form-label">One-off shock (both paths)</label>
              <div style={{ display: "flex", gap: 6 }}>
                <select className="form-input form-select" value={shockYear} onChange={(e) => setShockYear(Number(e.target.value))} style={{ flex: 1 }}>
                  <option value={0}>None</option>
                  {shockYears.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <input className="form-input" type="number" step="5" value={shockPct} onChange={(e) => setShockPct(Number(e.target.value))} style={{ width: 84 }} title="% shock" />
              </div>
            </div>
          </div>
        </div>

        {/* Outcome cards */}
        {hist.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
            <div className="panel" style={{ padding: "1rem 1.25rem" }}>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", color: "var(--ink-5)" }}>Latest ({hist.at(-1)?.year})</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{fmtCompact(lastVal)} <span style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>{info?.unit_default}</span></div>
            </div>
            <div className="panel" style={{ padding: "1rem 1.25rem", borderTop: "3px solid #0E7A3C" }}>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", color: "var(--ink-5)" }}>Scenario A · {horizon}</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "#0E7A3C" }}>{fmtCompact(endA)}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--ink-5)" }}>{growthA}%/yr → {lastVal ? ((endA / lastVal - 1) * 100).toFixed(0) : 0}% vs today</div>
            </div>
            <div className="panel" style={{ padding: "1rem 1.25rem", borderTop: "3px solid #1D4ED8" }}>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", color: "var(--ink-5)" }}>Scenario B · {horizon}</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "#1D4ED8" }}>{fmtCompact(endB)}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--ink-5)" }}>{growthB}%/yr → {lastVal ? ((endB / lastVal - 1) * 100).toFixed(0) : 0}% vs today</div>
            </div>
            <div className="panel" style={{ padding: "1rem 1.25rem" }}>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", color: "var(--ink-5)" }}>A vs B gap at {horizon}</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{fmtCompact(Math.abs(endB - endA))}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--ink-5)" }}>{info?.unit_default}</div>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="chart-panel">
          <div className="chart-panel-head">
            <div>
              <div className="chart-panel-title">{info?.name ?? "—"} — history &amp; scenarios to {horizon}</div>
              <div className="chart-panel-sub">{loading ? "Loading…" : `${hist.length} historical years · annualised · ${info?.unit_default ?? ""}`}</div>
            </div>
          </div>
          <div className="chart-panel-body" style={{ minHeight: 380 }}>
            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={chart} margin={{ top: 10, right: 18, bottom: 6, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E0" />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#8E867B" }} axisLine={{ stroke: "#E7E5E0" }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#8E867B" }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
                <Tooltip formatter={(v: unknown, name: unknown) => [`${Number(v).toLocaleString()} ${info?.unit_default ?? ""}`, name === "history" ? "History" : name === "scenarioA" ? "Scenario A" : "Scenario B"]} />
                <Legend wrapperStyle={{ fontSize: "0.72rem" }} formatter={(v) => v === "history" ? "History" : v === "scenarioA" ? `Scenario A (${growthA}%/yr)` : `Scenario B (${growthB}%/yr)`} />
                {shockYear > 0 && <ReferenceLine x={shockYear} stroke="#C0392B" strokeDasharray="4 4" label={{ value: `shock ${shockPct}%`, fontSize: 10, fill: "#C0392B", position: "top" }} />}
                <Line type="monotone" dataKey="history" stroke="#0A0A0A" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="scenarioA" stroke="#0E7A3C" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
                <Line type="monotone" dataKey="scenarioB" stroke="#1D4ED8" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-source">
            Compound-growth what-if paths over NEDB historical data — an indicative planning aid, not the full NECAL2050 energy-system model. Flows are annual totals; capacity series use year-end levels.
          </div>
        </div>
      </main>
    </div>
  );
}
