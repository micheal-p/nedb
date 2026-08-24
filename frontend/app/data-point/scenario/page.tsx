"use client";

// ── NECAL2050 — National Energy Calculator ──────────────────────────────────
// Anchored on committed NEDB data, planned from drivers, and honest about its
// assumptions. See lib/necal.ts for the model itself.

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { getTokenFresh } from "@/lib/auth";
import {
  runPlan, normaliseMix, PRESETS, TECHNOLOGIES, TECH_ASSUMPTIONS,
  DEFAULT_DRIVERS, DEFAULT_MIX,
  type PlanningDrivers, type MixTargets, type Technology,
} from "@/lib/necal";

type SeriesRow = { period: string; value: number; unit?: string };

const fmt = (v: number, d = 0) => v.toLocaleString("en-NG", { maximumFractionDigits: d });

function Slider({ label, hint, value, min, max, step, unit, onChange }: {
  label: string; hint?: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "block", marginBottom: "0.9rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--ink-2)" }}>{label}</span>
        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--green-deep)", fontVariantNumeric: "tabular-nums" }}>
          {value}{unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--green)" }} />
      {hint && <div style={{ fontSize: "0.68rem", color: "var(--ink-5)", lineHeight: 1.5, marginTop: 2 }}>{hint}</div>}
    </label>
  );
}

export default function NecalPage() {
  const [drivers, setDrivers] = useState<PlanningDrivers>(DEFAULT_DRIVERS);
  const [mix, setMix] = useState<MixTargets>(DEFAULT_MIX);
  const [preset, setPreset] = useState("access");
  const [base, setBase] = useState({ generationGwh: 0, capacityMw: 0 });
  const [baseYearFound, setBaseYearFound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [compare, setCompare] = useState(true);

  // Anchor the plan on committed NEDB data rather than a round number.
  const loadBase = useCallback(async () => {
    try {
      const token = await getTokenFresh();
      const head = await fetch("/api/dashboard-data", { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined }).then((r) => r.json());
      const years: number[] = head.years ?? [];
      const latestYear = years.length ? Math.max(...years) : null;
      const payload = latestYear && latestYear !== head.year
        ? await fetch(`/api/dashboard-data?year=${latestYear}`, { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined }).then((r) => r.json())
        : head;

      const series: Record<string, SeriesRow[]> = payload.series ?? {};
      const sum = (id: string) => (series[id] ?? []).reduce((a, r) => a + Number(r.value ?? 0), 0);
      const last = (id: string) => { const rows = series[id] ?? []; return rows.length ? Number(rows[rows.length - 1].value) : 0; };

      const generationGwh = sum("electricity_generation");
      const capacityMw = last("renewable_energy");
      setBase({ generationGwh, capacityMw });
      if (latestYear) {
        setBaseYearFound(latestYear);
        setDrivers((d) => ({ ...d, baseYear: latestYear }));
      }
    } catch {
      /* the plan still runs on its nominal anchor */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBase(); }, [loadBase]);

  function applyPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setDrivers((d) => ({ ...DEFAULT_DRIVERS, baseYear: d.baseYear, horizon: d.horizon, ...p.drivers }));
    setMix(p.mix);
  }

  const plan = useMemo(() => runPlan(drivers, mix, base), [drivers, mix, base]);
  const counterfactual = useMemo(() => {
    const p = PRESETS.find((x) => x.id === "current")!;
    return runPlan({ ...DEFAULT_DRIVERS, baseYear: drivers.baseYear, horizon: drivers.horizon, ...p.drivers }, p.mix, base);
  }, [drivers.baseYear, drivers.horizon, base]);

  const chartData = plan.years.map((y, i) => ({
    year: y.year,
    demand: Math.round(y.demandGwh),
    generation: Math.round(y.generationGwh),
    capacity: Math.round(y.capacityMw),
    emissions: Number(y.emissionsMt.toFixed(1)),
    clean: Number(y.cleanSharePct.toFixed(1)),
    baseline: counterfactual.years[i] ? Math.round(counterfactual.years[i].demandGwh) : undefined,
  }));

  const mixData = plan.years.filter((_, i) => i % Math.max(1, Math.floor(plan.years.length / 12)) === 0 || i === plan.years.length - 1)
    .map((y) => ({
      year: y.year,
      ...Object.fromEntries(TECHNOLOGIES.map((t) => [t, Math.round(y.capacityByTech[t])])),
    }));

  const norm = normaliseMix(mix);
  const horizonYear = plan.years[plan.years.length - 1];

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem 1.5rem 4rem" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.25rem" }}>Planning · NECAL2050</div>
            <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>National Energy Calculator</h1>
            <p style={{ fontSize: "0.83rem", color: "var(--ink-3)", marginTop: "0.4rem", maxWidth: 720, lineHeight: 1.65 }}>
              Plans forward from drivers rather than extrapolating a line: population, economic activity, efficiency and
              access set demand; the energy balance sets required generation; availability and reserve margin set the
              capacity that must exist; the mix sets what it costs and what it emits.
            </p>
          </div>
          <Link href="/data-point/dashboard" style={{ fontSize: "0.78rem", color: "var(--ink-4)" }}>← Dashboard</Link>
        </div>

        {/* Anchor */}
        <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderLeft: "3px solid var(--green)", padding: "0.8rem 1.1rem", marginBottom: "1.25rem", fontSize: "0.8rem", color: "var(--ink-3)", lineHeight: 1.6 }}>
          {loading ? "Loading the committed base year from the data bank…" : base.generationGwh > 0 ? (
            <>Anchored on <strong style={{ color: "var(--ink)" }}>{fmt(base.generationGwh)} GWh</strong> of committed generation for {baseYearFound}. Demand is uplifted by the suppressed-demand assumption below, because consumption today reflects what the grid could supply, not what the country needed.</>
          ) : (
            <>No committed generation records were found, so the plan runs on a nominal anchor. Commit generation data to anchor it on the real position.</>
          )}
        </div>

        {/* Pathways */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {PRESETS.map((p) => (
            <button key={p.id} onClick={() => applyPreset(p.id)}
              style={{
                textAlign: "left", cursor: "pointer", padding: "0.9rem 1rem",
                background: preset === p.id ? "var(--green-tint)" : "var(--surface-white)",
                border: `1px solid ${preset === p.id ? "var(--green)" : "var(--border)"}`,
              }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: preset === p.id ? "var(--green-deep)" : "var(--ink)", marginBottom: 3 }}>{p.label}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--ink-4)", lineHeight: 1.5 }}>{p.description}</div>
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "1.25rem", alignItems: "start" }} className="necal-layout">

          {/* ── Drivers ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="panel">
              <div className="panel-header"><span className="panel-title">Drivers</span></div>
              <div style={{ padding: "1rem 1.1rem" }}>
                <Slider label="Horizon" value={drivers.horizon} min={2030} max={2060} step={5} unit=""
                  onChange={(v) => setDrivers({ ...drivers, horizon: v })} />
                <Slider label="Population growth" value={drivers.populationGrowthPct} min={0} max={4} step={0.1} unit="%/yr"
                  hint="Drives household demand." onChange={(v) => setDrivers({ ...drivers, populationGrowthPct: v })} />
                <Slider label="GDP growth" value={drivers.gdpGrowthPct} min={0} max={8} step={0.1} unit="%/yr"
                  hint="Drives commercial and industrial demand." onChange={(v) => setDrivers({ ...drivers, gdpGrowthPct: v })} />
                <Slider label="Energy intensity change" value={drivers.energyIntensityChangePct} min={-3} max={1} step={0.1} unit="%/yr"
                  hint="Negative means efficiency improving — less energy per unit of output." onChange={(v) => setDrivers({ ...drivers, energyIntensityChangePct: v })} />
                <Slider label="Access at horizon" value={drivers.accessTargetPct} min={drivers.accessPct} max={100} step={1} unit="%"
                  hint={`From ${drivers.accessPct}% today. Closing this gap adds real demand.`} onChange={(v) => setDrivers({ ...drivers, accessTargetPct: v })} />
                <Slider label="Suppressed demand" value={drivers.suppressedDemandPct} min={0} max={80} step={5} unit="%"
                  hint="How much unmet need sits behind today's consumption. Planning off metered consumption alone under-builds the system." onChange={(v) => setDrivers({ ...drivers, suppressedDemandPct: v })} />
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><span className="panel-title">System assumptions</span></div>
              <div style={{ padding: "1rem 1.1rem" }}>
                <Slider label="T&D losses today" value={drivers.tdLossPct} min={5} max={40} step={1} unit="%"
                  onChange={(v) => setDrivers({ ...drivers, tdLossPct: v })} />
                <Slider label="T&D losses at horizon" value={drivers.tdLossTargetPct} min={4} max={40} step={1} unit="%"
                  hint="Every point of loss avoided is capacity you do not have to build." onChange={(v) => setDrivers({ ...drivers, tdLossTargetPct: v })} />
                <Slider label="Fleet availability" value={drivers.availabilityPct} min={20} max={90} step={1} unit="%"
                  hint="Share of installed capacity that actually delivers. Nigeria's realised availability is well below nameplate." onChange={(v) => setDrivers({ ...drivers, availabilityPct: v })} />
                <Slider label="Reserve margin" value={drivers.reserveMarginPct} min={0} max={40} step={1} unit="%"
                  hint="Headroom over requirement for outages and demand peaks." onChange={(v) => setDrivers({ ...drivers, reserveMarginPct: v })} />
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Capacity mix at horizon</span>
                <span style={{ fontSize: "0.7rem", color: "var(--ink-5)" }}>normalised to 100%</span>
              </div>
              <div style={{ padding: "0.9rem 1.1rem" }}>
                {TECHNOLOGIES.map((t) => (
                  <div key={t} style={{ marginBottom: "0.7rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                      <span style={{ fontSize: "0.76rem", color: "var(--ink-2)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 9, height: 9, background: TECH_ASSUMPTIONS[t].color, flexShrink: 0 }} />
                        {TECH_ASSUMPTIONS[t].label}
                      </span>
                      <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--green-deep)", fontVariantNumeric: "tabular-nums" }}>{norm[t].toFixed(0)}%</span>
                    </div>
                    <input type="range" min={0} max={100} step={1} value={mix[t]}
                      onChange={(e) => setMix({ ...mix, [t]: Number(e.target.value) })}
                      style={{ width: "100%", accentColor: TECH_ASSUMPTIONS[t].color }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Results ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", minWidth: 0 }}>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1px", background: "var(--border)", border: "1px solid var(--border)" }}>
              {[
                { label: `Demand ${drivers.horizon}`, value: horizonYear ? `${fmt(horizonYear.demandGwh)} GWh` : "—", sub: plan.totals.demandGrowthMultiple ? `${plan.totals.demandGrowthMultiple.toFixed(1)}× today` : "" },
                { label: "Capacity required", value: horizonYear ? `${fmt(horizonYear.capacityMw)} MW` : "—", sub: `${fmt(plan.totals.capacityAddedMw)} MW to build` },
                { label: "Capital requirement", value: `$${fmt(plan.totals.capexUsdBn, 1)}bn`, sub: `to ${drivers.horizon}, overnight cost` },
                { label: `Emissions ${drivers.horizon}`, value: `${fmt(plan.totals.horizonEmissionsMt, 1)} Mt`, sub: `peak ${fmt(plan.totals.peakEmissionsMt, 1)} Mt` },
                { label: "Clean generation", value: `${fmt(plan.totals.horizonCleanPct, 0)}%`, sub: "non-emitting share at horizon" },
              ].map((c) => (
                <div key={c.label} style={{ background: "var(--surface-white)", padding: "1rem 1.1rem" }}>
                  <div style={{ fontSize: "0.64rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-4)", marginBottom: 5 }}>{c.label}</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{c.value}</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--ink-5)", marginTop: 3 }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {plan.warnings.length > 0 && (
              <div style={{ background: "var(--amber-tint)", border: "1px solid var(--amber)", padding: "0.8rem 1.1rem" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--amber)", marginBottom: 5 }}>Read the plan with these caveats</div>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.78rem", color: "var(--ink-2)", lineHeight: 1.7 }}>
                  {plan.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {/* Demand */}
            <div className="chart-panel">
              <div className="chart-panel-head">
                <div>
                  <div className="chart-panel-title">Electricity demand and required generation</div>
                  <div className="chart-panel-sub">GWh per year · generation exceeds demand by transmission and distribution losses</div>
                </div>
                <label style={{ fontSize: "0.72rem", color: "var(--ink-3)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} style={{ accentColor: "var(--green)" }} />
                  Compare with current trajectory
                </label>
              </div>
              <div className="chart-panel-body">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 10, fill: "var(--ink-5)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--ink-5)" }} width={62} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v, n) => [`${fmt(Number(v))} GWh`, String(n)]} />
                    <Legend wrapperStyle={{ fontSize: "0.72rem" }} />
                    <Line type="monotone" dataKey="generation" name="Required generation" stroke="#1B2A4A" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="demand" name="Delivered demand" stroke="#0E7A3C" strokeWidth={2} dot={false} />
                    {compare && <Line type="monotone" dataKey="baseline" name="Current trajectory" stroke="#B45309" strokeWidth={1.6} strokeDasharray="5 4" dot={false} />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-source">
                Demand = base demand × population × GDP × efficiency × access. Base demand uplifts committed consumption by the suppressed-demand assumption.
              </div>
            </div>

            {/* Capacity build */}
            <div className="chart-panel">
              <div className="chart-panel-head">
                <div>
                  <div className="chart-panel-title">Installed capacity by technology</div>
                  <div className="chart-panel-sub">MW · the build the plan implies</div>
                </div>
              </div>
              <div className="chart-panel-body">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={mixData} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 10, fill: "var(--ink-5)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--ink-5)" }} width={62} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v, n) => [`${fmt(Number(v))} MW`, TECH_ASSUMPTIONS[n as Technology]?.label ?? String(n)]} />
                    <Legend wrapperStyle={{ fontSize: "0.72rem" }} formatter={(n: string) => TECH_ASSUMPTIONS[n as Technology]?.label ?? n} />
                    {TECHNOLOGIES.map((t) => (
                      <Area key={t} type="monotone" dataKey={t} stackId="1" stroke={TECH_ASSUMPTIONS[t].color} fill={TECH_ASSUMPTIONS[t].color} fillOpacity={0.75} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-source">
                Capacity = generation ÷ (8,760 h × availability) × (1 + reserve margin), apportioned along the mix pathway from today&apos;s mix to the target.
              </div>
            </div>

            {/* Emissions */}
            <div className="chart-panel">
              <div className="chart-panel-head">
                <div>
                  <div className="chart-panel-title">Emissions and clean generation share</div>
                  <div className="chart-panel-sub">Million tonnes CO₂e per year, and the non-emitting share of generation</div>
                </div>
              </div>
              <div className="chart-panel-body">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 10, fill: "var(--ink-5)" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "var(--ink-5)" }} width={50} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--ink-5)" }} width={40} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: "0.72rem" }} />
                    <Line yAxisId="l" type="monotone" dataKey="emissions" name="Emissions (Mt CO₂e)" stroke="#B91C1C" strokeWidth={2} dot={false} />
                    <Line yAxisId="r" type="monotone" dataKey="clean" name="Clean share (%)" stroke="#059669" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-source">
                Emissions apportion generation by each technology&apos;s realistic capacity factor, not by installed capacity — solar capacity does not generate like gas capacity.
              </div>
            </div>

            {/* Assumptions register */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Assumptions register</span>
                <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>Every coefficient the plan uses</span>
              </div>
              <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
                <table className="data-table" style={{ fontSize: "0.76rem" }}>
                  <thead>
                    <tr>
                      <th>Technology</th>
                      <th style={{ textAlign: "right" }}>Capex (USD/kW)</th>
                      <th style={{ textAlign: "right" }}>Capacity factor</th>
                      <th style={{ textAlign: "right" }}>Emission factor (gCO₂e/kWh)</th>
                      <th style={{ textAlign: "right" }}>Share at horizon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TECHNOLOGIES.map((t) => (
                      <tr key={t}>
                        <td className="td-primary">
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                            <span style={{ width: 9, height: 9, background: TECH_ASSUMPTIONS[t].color }} />
                            {TECH_ASSUMPTIONS[t].label}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(TECH_ASSUMPTIONS[t].capexUsdPerKw)}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{TECH_ASSUMPTIONS[t].capacityFactorPct}%</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{TECH_ASSUMPTIONS[t].emissionFactor}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{norm[t].toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="chart-source">
                Planning assumptions, not measured NEDB data. Capital costs are overnight costs excluding grid reinforcement,
                storage and financing. Emission factors are lifecycle medians. Change any of them and the plan changes with them.
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .necal-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
