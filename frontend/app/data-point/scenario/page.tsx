"use client";

// ── NECAL2050 — National Energy Calculator ──────────────────────────────────
// A planning instrument, not a chart. Six modules:
//
//   Data      what NEDB can actually anchor, and what it cannot
//   Drivers   population, activity, efficiency, access, system assumptions
//   Policy    instruments you switch on, each reaching the model by a mechanism
//   Goals     sector targets with the gap to them
//   Results   demand, build, mix, emissions, economics
//   Climate   the plan measured against Nigeria's stated commitments
//
// Nothing here is invented data. Every figure is either measured from NEDB, or
// an assumption the model shows you and lets you change.

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { getTokenFresh } from "@/lib/auth";
import NecalGate from "@/components/necal/NecalGate";
import VizTooltip from "@/components/charts/VizTooltip";
import { SERIES_COLORS, axisProps, fmtAxis, AXIS, STATUS } from "@/lib/viz";
import {
  PRESETS, TECHNOLOGIES, TECH_ASSUMPTIONS,
  DEFAULT_DRIVERS, DEFAULT_MIX,
  type PlanningDrivers, type MixTargets,
} from "@/lib/necal";
import {
  INSTRUMENTS, SECTOR_GOALS, DEFAULT_ECONOMICS, type PolicyMix,
} from "@/lib/necal-policy";
import { deriveScenario, encodeScenario, type Scenario } from "@/lib/necal-scenario";

type ModelInput = {
  id: string; label: string; status: "measured" | "derived" | "missing" | "unavailable";
  value: number | null; unit: string; period: string | null; series_id: string | null; note: string;
};

type InputSummary = {
  measured: number; derived: number; missing: number; unavailable: number; total: number;
  anchored: boolean; anchorComplete: boolean; anchorOvercounted: boolean; readFailure: boolean;
};

/** The T&D loss slider's range. A derived figure outside it is not usable as a driver. */
const LOSS_MIN = 5;
const LOSS_MAX = 40;

/** Drop the goals that have no target, so "not set" never travels as a zero. */
function definedGoals(goals: Record<string, number | undefined>): Record<string, number> {
  return Object.fromEntries(Object.entries(goals).filter(([, v]) => v != null)) as Record<string, number>;
}

type Tab = "data" | "drivers" | "policy" | "goals" | "results" | "climate";

// Task language, and the plan comes FIRST.
//
// The old order opened on a table of model inputs with the charts sitting on
// tab five, so the reasonable conclusion on landing was that this tool has no
// charts. The plan is the point of the instrument, so it is what you land on;
// the numbered steps are the things you change to move it.
const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "results", label: "The plan",       hint: "What this scenario requires: demand, build, cost, emissions" },
  { id: "data",    label: "1 · Starting point", hint: "What NEDB can anchor, and what has to be assumed" },
  { id: "drivers", label: "2 · Drivers",    hint: "Population, growth, efficiency, access, losses, the mix" },
  { id: "policy",  label: "3 · Policy",     hint: "Instruments to switch on, each through a stated mechanism" },
  { id: "goals",   label: "4 · Targets",    hint: "Set a target and see the gap to it" },
  { id: "climate", label: "Commitments",    hint: "The plan measured against Nigeria's stated commitments" },
];

/** The four things a planner does, shown on first arrival. */
const STEPS: { tab: Tab; title: string; body: string }[] = [
  { tab: "data",    title: "See what is real", body: "Every input the model wants, marked measured, derived or assumed. Nothing here is invented." },
  { tab: "drivers", title: "Set the future",   body: "Population, growth, efficiency, access, network losses and the capacity mix you are aiming at." },
  { tab: "policy",  title: "Switch on policy", body: "Eight instruments. Each reaches the model through a stated mechanism, so you can see why the result moved." },
  { tab: "goals",   title: "Test it",          body: "Set targets, read the gap, then check the plan against Nigeria's commitments." },
];

const fmt = (v: number, d = 0) => v.toLocaleString("en-NG", { maximumFractionDigits: d });

function Slider({ label, hint, value, min, max, step, unit, onChange }: {
  label: string; hint?: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <label style={{ display: "block", marginBottom: "0.85rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: "var(--t-sm)", fontWeight: 600, color: "var(--ink-2)" }}>{label}</span>
        <span style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--green-deep)", fontVariantNumeric: "tabular-nums" }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--green)" }} />
      {hint && <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)", lineHeight: 1.5, marginTop: 2 }}>{hint}</div>}
    </label>
  );
}

function NecalWorkspace() {
  const [tab, setTab] = useState<Tab>("results");
  const [name, setName] = useState("Untitled scenario");
  /** Cleared once the planner changes anything, so the guidance stops nagging. */
  const [touched, setTouched] = useState(false);
  const [drivers, setDrivers] = useState<PlanningDrivers>(DEFAULT_DRIVERS);
  const [mix, setMix] = useState<MixTargets>(DEFAULT_MIX);
  const [policy, setPolicy] = useState<PolicyMix>({});
  const [econ, setEcon] = useState(DEFAULT_ECONOMICS);
  const [preset, setPreset] = useState("custom");
  // A goal is either set or not set. Clearing the box must remove the target,
  // not silently set it to zero — "aim for 0% clean generation" would read as met.
  const [goals, setGoals] = useState<Record<string, number | undefined>>({ clean_share: 60, access: 100, losses: 8 });

  const setGoal = useCallback((id: string, raw: string) => {
    const text = raw.trim();
    setGoals((g) => {
      if (text === "") { const next = { ...g }; delete next[id]; return next; }
      const n = Number(text);
      return Number.isFinite(n) ? { ...g, [id]: n } : g;
    });
  }, []);

  const [inputs, setInputs] = useState<ModelInput[]>([]);
  const [inputSummary, setInputSummary] = useState<InputSummary | null>(null);
  const [base, setBase] = useState<{ generationGwh: number }>({ generationGwh: 0 });
  const [baseYear, setBaseYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Anchor on what NEDB actually holds ────────────────────────────────────
  const loadInputs = useCallback(async () => {
    setLoadError(null);
    try {
      const token = await getTokenFresh();
      const r = await fetch("/api/necal/inputs", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        setLoadError(body?.error ?? `The data bank did not answer (${r.status}). The plan below runs on assumptions only.`);
        return;
      }
      const j = await r.json();
      const list: ModelInput[] = j.inputs ?? [];
      setInputs(list);
      setInputSummary(j.summary ?? null);

      const gen = list.find((i) => i.id === "generation");
      const loss = list.find((i) => i.id === "td_loss");
      if (gen?.value) {
        setBase({ generationGwh: gen.value });
        if (gen.period) { const y = Number(gen.period); setBaseYear(y); setDrivers((d) => ({ ...d, baseYear: y })); }
      }
      // A measured loss rate beats an assumed one, but only inside the range the
      // driver accepts. A figure outside it would sit off the end of the slider,
      // where the user can see the number but cannot move it back.
      if (loss?.status === "derived" && loss.value != null && Number.isFinite(loss.value)) {
        const clamped = Math.min(LOSS_MAX, Math.max(LOSS_MIN, Math.round(loss.value)));
        setDrivers((d) => ({ ...d, tdLossPct: clamped }));
      }
    } catch {
      // A failed read is not an empty data bank. Say which one happened.
      setLoadError("The model inputs could not be loaded. This is a connection problem, not a statement that NEDB holds nothing.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { loadInputs(); }, [loadInputs]);

  function applyPreset(id: string) {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setTouched(true);
    setDrivers((d) => ({ ...DEFAULT_DRIVERS, baseYear: d.baseYear, horizon: d.horizon, tdLossPct: d.tdLossPct, ...p.drivers }));
    setMix(p.mix);
    // Only rename while the planner has not named it themselves.
    setName((n) => (n === "Untitled scenario" || PRESETS.some((x) => x.label === n) ? p.label : n));
  }

  /** Back to a clean sheet, keeping the anchor the data bank gave us. */
  function newScenario() {
    setName("Untitled scenario");
    // "custom", not "access": the reset uses DEFAULT_MIX, which is not the
    // access preset's mix, and the chip and the report cover both read the id.
    setPreset("custom");
    setDrivers((d) => ({ ...DEFAULT_DRIVERS, baseYear: d.baseYear, tdLossPct: d.tdLossPct }));
    setMix(DEFAULT_MIX);
    setPolicy({});
    setEcon(DEFAULT_ECONOMICS);
    setGoals({ clean_share: 60, access: 100, losses: 8 });
    setTouched(false);
    setTab("results");
  }

  // The whole run, in one place. The printable report derives from exactly this,
  // so the paper version can never carry different numbers from the screen.
  const scenario: Scenario = useMemo(
    () => ({ v: 1, name, presetId: preset, drivers, mix, policy, econ, goals: definedGoals(goals), anchorGwh: base.generationGwh }),
    [name, preset, drivers, mix, policy, econ, goals, base.generationGwh]
  );

  // ── Saved scenarios: name it, keep it, publish it ─────────────────────────
  type SavedScn = { id: number; name: string; scenario: Scenario; is_published: boolean };
  const [saved, setSaved] = useState<SavedScn[]>([]);
  const [savedMsg, setSavedMsg] = useState("");
  const [loadedId, setLoadedId] = useState("");
  const authedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getTokenFresh();
    return fetch(url, { ...init, credentials: "include", headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.body ? { "Content-Type": "application/json" } : {}) } });
  }, []);
  const loadSaved = useCallback(async () => {
    const r = await authedFetch("/api/necal/scenarios");
    if (r.ok) setSaved(await r.json());
  }, [authedFetch]);
  useEffect(() => { loadSaved(); }, [loadSaved]);

  const applyScenario = useCallback((scn: Scenario) => {
    setName(scn.name);
    setDrivers(scn.drivers);
    setMix(scn.mix);
    setPolicy(scn.policy ?? {});
    setEcon(scn.econ);
    setGoals(scn.goals ?? {});
    setTouched(true);
  }, []);

  const saveScenario = useCallback(async () => {
    if (!name.trim() || name === "Untitled scenario") { setSavedMsg("Name the scenario first — the name is how you get it back."); return; }
    const r = await authedFetch("/api/necal/scenarios", { method: "POST", body: JSON.stringify({ name, scenario }) });
    const j = await r.json().catch(() => ({}));
    setSavedMsg(r.ok ? `Saved "${name}".` : (j.error ?? "Saving failed."));
    if (r.ok) loadSaved();
  }, [name, scenario, authedFetch, loadSaved]);

  const publishScenario = useCallback(async (row: SavedScn, publish: boolean) => {
    const r = await authedFetch(`/api/necal/scenarios/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify(publish ? { is_published: true, base: { generationGwh: scenario.anchorGwh ?? 0 } } : { is_published: false }),
    });
    const j = await r.json().catch(() => ({}));
    setSavedMsg(r.ok ? (publish ? `"${row.name}" is on the public explorer.` : `"${row.name}" withdrawn.`) : (j.error ?? "Failed."));
    if (r.ok) loadSaved();
  }, [authedFetch, loadSaved, scenario.anchorGwh]);

  const { applied, plan, counterfactual, econResult, commitments, shownMix } =
    useMemo(() => deriveScenario(scenario, base), [scenario, base]);

  const reportHref = `/data-point/scenario/report?s=${encodeScenario(scenario)}`;

  const chartData = useMemo(() => plan.years.map((y, i) => ({
    year: y.year,
    demand: Math.round(y.demandGwh),
    generation: Math.round(y.generationGwh),
    emissions: Number(y.emissionsMt.toFixed(1)),
    baseline: counterfactual.years[i] ? Math.round(counterfactual.years[i].demandGwh) : undefined,
    baselineEmissions: counterfactual.years[i] ? Number(counterfactual.years[i].emissionsMt.toFixed(1)) : undefined,
  })), [plan, counterfactual]);

  const mixData = useMemo(() => plan.years
    .filter((_, i) => i % Math.max(1, Math.floor(plan.years.length / 12)) === 0 || i === plan.years.length - 1)
    .map((y) => ({ year: y.year, ...Object.fromEntries(TECHNOLOGIES.map((t) => [t, Math.round(y.capacityByTech[t])])) })), [plan]);

  const horizon = plan.years[plan.years.length - 1];
  const activeCount = Object.values(policy).filter((v) => (v ?? 0) > 0).length;

  const axes = (
    <>
      <CartesianGrid stroke={AXIS.grid} vertical={false} />
      <XAxis dataKey="year" {...axisProps} minTickGap={28} />
      <YAxis {...axisProps} width={56} tickFormatter={fmtAxis} />
    </>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "1.5rem 1.25rem 4rem" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <div className="eyebrow">Planning · NECAL2050</div>
            <h1 style={{ fontSize: "var(--t-2xl)", fontWeight: 700, color: "var(--ink)", margin: 0, letterSpacing: "-0.015em" }}>National Energy Calculator</h1>
            <p style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", marginTop: "0.4rem", maxWidth: "var(--measure)", lineHeight: 1.7 }}>
              Plans forward from drivers: population, activity, efficiency and access set demand; the energy balance sets
              required generation; availability and reserve set the capacity that must exist; the mix sets what it costs and
              what it emits. Policy instruments reach the model through those same drivers, so every effect is traceable to a
              mechanism.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={newScenario} className="btn btn-secondary btn-sm">New scenario</button>
            <Link href={reportHref} className="btn btn-primary btn-sm">Generate report</Link>
            <Link href="/data-point/dashboard" style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)" }}>← Dashboard</Link>
          </div>
        </div>

        {/* ── The scenario itself ────────────────────────────────────────────
            A scenario used to be an implicit thing that existed only as slider
            positions, so there was nothing to create, name or hand to anyone.
            It is now an object on the page: it has a name, a starting pathway,
            and a visible count of what you have changed. */}
        <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderTop: "3px solid var(--green)", padding: "0.9rem 1.15rem", marginBottom: "1.15rem" }}>
          <div style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 260px", minWidth: 220 }}>
              <span className="eyebrow" style={{ display: "block", marginBottom: 4 }}>Scenario name</span>
              <input className="form-input" value={name} maxLength={120}
                onChange={(e) => { setName(e.target.value); setTouched(true); }}
                placeholder="e.g. Universal access by 2040, gas-led" />
            </label>
            <div style={{ flex: "2 1 420px", minWidth: 280 }}>
              <span className="eyebrow" style={{ display: "block", marginBottom: 4 }}>Start from a pathway, then change anything</span>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {PRESETS.map((p) => (
                  <button key={p.id} onClick={() => applyPreset(p.id)} title={p.description}
                    style={{
                      cursor: "pointer", padding: "0.4rem 0.7rem", fontSize: "var(--t-sm)", fontWeight: 600,
                      background: preset === p.id ? "var(--green-tint)" : "var(--surface-white)",
                      color: preset === p.id ? "var(--green-deep)" : "var(--ink-3)",
                      border: `1px solid ${preset === p.id ? "var(--green)" : "var(--border)"}`,
                    }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", lineHeight: 1.6, flex: "0 1 200px", minWidth: 160 }}>
              To {drivers.horizon} · {activeCount} {activeCount === 1 ? "instrument" : "instruments"} on
              {inputSummary?.anchored ? <> · anchored on {baseYear}</> : null}
            </div>
          </div>

          {/* Keep, reload, publish. A scenario is the account holder's work,
              saved under their name; publishing puts it on the public shelf
              with the anchor frozen so anyone can check it. */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-soft)" }}>
            <button className="btn btn-primary btn-sm" onClick={saveScenario}>Save scenario</button>
            <select className="form-input form-select" value={loadedId} style={{ maxWidth: 260, padding: "0.35rem 0.6rem", fontSize: "var(--t-sm)" }}
              onChange={(e) => {
                setLoadedId(e.target.value);
                const row = saved.find((x) => String(x.id) === e.target.value);
                if (row) applyScenario(row.scenario);
              }}>
              <option value="">My scenarios ({saved.length})…</option>
              {saved.map((x) => <option key={x.id} value={x.id}>{x.name}{x.is_published ? " · published" : ""}</option>)}
            </select>
            {loadedId && (() => {
              const row = saved.find((x) => String(x.id) === loadedId);
              if (!row) return null;
              return (
                <button className="btn btn-secondary btn-sm" onClick={() => publishScenario(row, !row.is_published)}>
                  {row.is_published ? "Withdraw from public explorer" : "Publish to public explorer"}
                </button>
              );
            })()}
            <Link href="/data-point/scenario/folder" style={{ fontSize: "var(--t-sm)", color: "var(--green)", fontWeight: 600 }}>Planning folder →</Link>
            <Link href="/data-point/scenario/drivers" style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)" }}>Driver documentation</Link>
            {savedMsg && <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-3)" }}>{savedMsg}</span>}
          </div>
        </div>

        {/* Anchor status — always visible, never buried.
            Three distinct states, because they mean different things: anchored on
            a complete year, anchored on a partial one (which understates
            everything downstream), and could not be read at all. */}
        {(() => {
          const partial = !!inputSummary?.anchored && inputSummary.anchorComplete === false;
          const doubled = !!inputSummary?.anchorOvercounted;
          const shaky = partial || doubled;
          const failed = !!loadError || !!inputSummary?.readFailure;
          const tone = failed ? "var(--ink-4)" : inputSummary?.anchored && !shaky ? "var(--green)" : "var(--amber)";
          const deep = failed ? "var(--ink-3)" : inputSummary?.anchored && !shaky ? "var(--green-deep)" : "var(--amber)";
          const badge = loading ? "Checking" : failed ? "Could not read" : !inputSummary?.anchored ? "Not anchored"
            : doubled ? "Anchor suspect" : partial ? "Partial year" : "Anchored on NEDB";
          return (
            <div style={{
              background: "var(--surface-white)", border: "1px solid var(--border)",
              borderLeft: `3px solid ${tone}`,
              padding: "0.75rem 1.05rem", marginBottom: "1.15rem",
              display: "flex", alignItems: "center", gap: "0.9rem", flexWrap: "wrap",
            }}>
              <span style={{ fontSize: "var(--t-2xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: deep, border: `1px solid ${tone}`, padding: "2px 8px" }}>
                {badge}
              </span>
              <span style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)", flex: 1, minWidth: 260, lineHeight: 1.6 }}>
                {loading ? "Reading the data bank…"
                  : loadError ? loadError
                  : inputSummary?.anchored
                    ? <>
                        Base year {baseYear}: {fmt(base.generationGwh)} GWh of committed generation
                        {doubled ? <strong style={{ color: "var(--amber)" }}> from a year holding more records than it should, so the anchor is probably double counted</strong>
                          : partial ? <strong style={{ color: "var(--amber)" }}> from an incomplete year, so demand, capacity and capital below are all understated</strong>
                          : null}.
                        {" "}{inputSummary.measured} of {inputSummary.total} model inputs are measured, {inputSummary.derived} derived, {inputSummary.missing} supplied by assumption
                        {inputSummary.unavailable > 0 ? <>, and {inputSummary.unavailable} could not be read</> : null}.
                      </>
                    : <>No committed generation records, so the plan runs on a nominal anchor rather than Nigeria&apos;s real position. Every figure below is illustrative until that series is filled.</>}
              </span>
              {loadError ? (
                <button onClick={() => { setLoading(true); loadInputs(); }} className="btn btn-secondary btn-sm">Try again</button>
              ) : (
                <button onClick={() => setTab("data")} style={{ fontSize: "var(--t-xs)", fontWeight: 700, color: "var(--green)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
                  See every input
                </button>
              )}
            </div>
          );
        })()}

        <div className="scroll-x" style={{ borderBottom: "1px solid var(--border)", marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", gap: 2, minWidth: "max-content" }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== "results") setTouched(true); }} title={t.hint}
                style={{
                  padding: "0.55rem 0.9rem", background: "none", border: "none", whiteSpace: "nowrap",
                  borderBottom: `2px solid ${tab === t.id ? "var(--green)" : "transparent"}`,
                  color: tab === t.id ? "var(--ink)" : "var(--ink-4)",
                  fontWeight: tab === t.id ? 700 : 500, fontSize: "var(--t-base)", cursor: "pointer",
                }}>
                {t.label}
                {t.id === "policy" && activeCount > 0 && (
                  <span style={{ marginLeft: 6, fontSize: "var(--t-2xs)", fontWeight: 700, background: "var(--green)", color: "#fff", padding: "1px 6px" }}>{activeCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        {/* Says what the tab you are on is for, so the vocabulary is never the barrier. */}
        <p style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)", margin: "0 0 1.15rem", lineHeight: 1.6 }}>
          {TABS.find((t) => t.id === tab)?.hint}
        </p>

        {/* Headline figures — on every tab, because they are the point */}
        <div className="grid-auto grid-hair" style={{ marginBottom: "1.25rem" }}>
          {[
            { l: `Demand ${drivers.horizon}`, v: horizon ? `${fmt(horizon.demandGwh)} GWh` : "—", s: plan.totals.demandGrowthMultiple ? `${plan.totals.demandGrowthMultiple.toFixed(1)}× today` : "" },
            { l: "Capacity required", v: horizon ? `${fmt(horizon.capacityMw)} MW` : "—", s: `${fmt(plan.totals.capacityAddedMw)} MW to build` },
            { l: "Capital requirement", v: `$${fmt(econResult.capexUsdBn, 1)}bn`, s: `₦${fmt(econResult.capexNgnTn, 1)}tn at ₦${econ.fxNgnPerUsd}/$` },
            { l: `Emissions ${drivers.horizon}`, v: `${fmt(plan.totals.horizonEmissionsMt, 1)} Mt`, s: `peak ${fmt(plan.totals.peakEmissionsMt, 1)} Mt` },
            { l: "Clean generation", v: `${fmt(plan.totals.horizonCleanPct, 0)}%`, s: "at horizon" },
          ].map((c) => (
            <div key={c.l} className="stat-cell">
              <div className="val">{c.v}</div>
              <div className="lbl">{c.l}</div>
              {c.s && <div className="sub">{c.s}</div>}
            </div>
          ))}
        </div>

        {/* A chart on EVERY tab. The instrument is a picture of a trajectory, and
            burying every picture behind one tab made it read as a form. This one
            moves as you drag a slider, which is the whole point of the tool. */}
        <figure className="chart-panel" style={{ margin: "0 0 1.25rem" }}>
          <div className="chart-panel-head">
            <figcaption>
              <div className="chart-panel-title">Electricity demand to {drivers.horizon}</div>
              <div className="chart-panel-sub">GWh a year · this scenario against the current trajectory</div>
            </figcaption>
            <div className="viz-legend" style={{ padding: 0, border: 0 }}>
              <span className="viz-legend-item"><span className="viz-swatch" style={{ background: SERIES_COLORS[0] }} />This scenario</span>
              <span className="viz-legend-item"><span className="viz-swatch" style={{ background: SERIES_COLORS[2] }} />Current trajectory</span>
            </div>
          </div>
          <div className="chart-panel-body">
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={chartData} margin={{ top: 6, right: 18, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="necalDemand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES_COLORS[0]} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={SERIES_COLORS[0]} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                {axes}
                <Tooltip content={<VizTooltip unit="GWh" />} cursor={{ stroke: AXIS.grid }} />
                <Area type="monotone" dataKey="demand" name="This scenario" stroke={SERIES_COLORS[0]} strokeWidth={2} fill="url(#necalDemand)" />
                <Line type="monotone" dataKey="baseline" name="Current trajectory" stroke={SERIES_COLORS[2]} strokeWidth={1.6} strokeDasharray="5 4" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-source">
            Move any driver or switch on a policy instrument and this line moves with it. The dashed line is the same model
            run on the current-trajectory pathway, so the gap between them is what your scenario changes.
          </div>
        </figure>

        {/* First arrival: say what the four steps are, and jump straight to them. */}
        {!touched && (
          <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1rem 1.15rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
              <div className="eyebrow">How to build a scenario</div>
              <button onClick={() => setTouched(true)} style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", background: "none", border: "none", cursor: "pointer" }}>Hide</button>
            </div>
            <div className="grid-auto" style={{ gap: "0.7rem" }}>
              {STEPS.map((s, i) => (
                <button key={s.tab} onClick={() => { setTab(s.tab); setTouched(true); }}
                  style={{ textAlign: "left", cursor: "pointer", padding: "0.7rem 0.85rem", background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
                  <div style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{i + 1} · {s.title}</div>
                  <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", lineHeight: 1.55 }}>{s.body}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {plan.warnings.length > 0 && (
          <div style={{ background: "var(--amber-tint)", border: "1px solid var(--amber)", padding: "0.75rem 1.05rem", marginBottom: "1.15rem" }}>
            <div className="eyebrow" style={{ color: "var(--amber)", marginBottom: 4 }}>Read this plan with these caveats</div>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "var(--t-sm)", color: "var(--ink-2)", lineHeight: 1.7 }}>
              {plan.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        {/* ── DATA ── */}
        {tab === "data" && (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Model inputs and where they come from</span>
              <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>Nothing here is invented</span>
            </div>
            <div className="scroll-x">
              <table className="data-table" style={{ fontSize: "var(--t-sm)" }}>
                <thead><tr><th>Input</th><th>Status</th><th style={{ textAlign: "right" }}>Value</th><th>Period</th><th>Basis</th></tr></thead>
                <tbody>
                  {inputs.map((i) => (
                    <tr key={i.id}>
                      <td className="td-primary">{i.label}</td>
                      <td>
                        <span className={`tag ${i.status === "measured" ? "tag-green" : i.status === "derived" ? "tag-amber" : i.status === "unavailable" ? "tag-red" : "tag-muted"}`}>
                          {i.status === "measured" ? "Measured"
                            : i.status === "derived" ? "Derived"
                            : i.status === "unavailable" ? "Could not read"
                            : "Assumption"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: i.value != null ? 600 : 400, color: i.value != null ? "var(--ink)" : "var(--ink-5)" }}>
                        {i.value != null ? `${fmt(i.value, 1)} ${i.unit}` : "—"}
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-4)" }}>{i.period ?? "—"}</td>
                      <td style={{ fontSize: "var(--t-xs)", color: "var(--ink-3)", lineHeight: 1.55, maxWidth: 420 }}>
                        {i.note}
                        {i.series_id && i.status === "missing" && (
                          <> <Link href={`/terminal/entry?series=${i.series_id}`} style={{ color: "var(--green)", fontWeight: 600 }}>Fill it →</Link></>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="chart-source">
              Measured figures are read from committed NEDB records. Derived figures are computed from two or more measured
              series. Assumptions are yours: the model shows the value it used and never presents one as a measurement.
            </div>
          </div>
        )}

        {/* ── DRIVERS ── */}
        {tab === "drivers" && (
          <>
            {/* The starting pathway lives in the scenario bar at the top of the
                page now, so it is chosen once rather than repeated here. */}
            <div className="grid-3" style={{ gap: "1rem", alignItems: "start" }}>
              <div className="panel">
                <div className="panel-header"><span className="panel-title">Demand drivers</span></div>
                <div style={{ padding: "1rem" }}>
                  <Slider label="Horizon" value={drivers.horizon} min={2030} max={2060} step={5} unit="" onChange={(v) => setDrivers({ ...drivers, horizon: v })} />
                  <Slider label="Population growth" value={drivers.populationGrowthPct} min={0} max={4} step={0.1} unit="%/yr" hint="Drives household demand." onChange={(v) => setDrivers({ ...drivers, populationGrowthPct: v })} />
                  <Slider label="GDP growth" value={drivers.gdpGrowthPct} min={0} max={8} step={0.1} unit="%/yr" hint="Drives commercial and industrial demand." onChange={(v) => setDrivers({ ...drivers, gdpGrowthPct: v })} />
                  <Slider label="Energy intensity change" value={Number(drivers.energyIntensityChangePct.toFixed(1))} min={-3} max={1} step={0.1} unit="%/yr" hint="Negative means efficiency improving." onChange={(v) => setDrivers({ ...drivers, energyIntensityChangePct: v })} />
                  <Slider label="Access at horizon" value={drivers.accessTargetPct} min={drivers.accessPct} max={100} step={1} unit="%" hint={`From ${drivers.accessPct}% today. Closing this gap adds real demand.`} onChange={(v) => setDrivers({ ...drivers, accessTargetPct: v })} />
                  <Slider label="Suppressed demand" value={drivers.suppressedDemandPct} min={0} max={80} step={5} unit="%" hint="Unmet need behind today's consumption. Planning off metered consumption alone under-builds the system." onChange={(v) => setDrivers({ ...drivers, suppressedDemandPct: v })} />
                </div>
              </div>

              <div className="panel">
                <div className="panel-header"><span className="panel-title">System assumptions</span></div>
                <div style={{ padding: "1rem" }}>
                  <Slider label="T&D losses today" value={drivers.tdLossPct} min={5} max={40} step={1} unit="%" onChange={(v) => setDrivers({ ...drivers, tdLossPct: v })} />
                  <Slider label="T&D losses at horizon" value={Number(drivers.tdLossTargetPct.toFixed(0))} min={4} max={40} step={1} unit="%" hint="Every point of loss avoided is capacity you do not have to build." onChange={(v) => setDrivers({ ...drivers, tdLossTargetPct: v })} />
                  <Slider label="Fleet availability" value={drivers.availabilityPct} min={20} max={90} step={1} unit="%" hint="Share of installed capacity that actually delivers." onChange={(v) => setDrivers({ ...drivers, availabilityPct: v })} />
                  <Slider label="Reserve margin" value={drivers.reserveMarginPct} min={0} max={40} step={1} unit="%" hint="Headroom for outages and peaks." onChange={(v) => setDrivers({ ...drivers, reserveMarginPct: v })} />
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Capacity mix at horizon</span>
                  <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>normalised</span>
                </div>
                <div style={{ padding: "0.9rem 1rem" }}>
                  {TECHNOLOGIES.map((t) => (
                    <div key={t} style={{ marginBottom: "0.65rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                        <span style={{ fontSize: "var(--t-sm)", color: "var(--ink-2)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 9, height: 9, background: TECH_ASSUMPTIONS[t].color }} />
                          {TECH_ASSUMPTIONS[t].label}
                        </span>
                        <span style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--green-deep)", fontVariantNumeric: "tabular-nums" }}>
                          {shownMix[t].toFixed(0)}%
                        </span>
                      </div>
                      <input type="range" min={0} max={100} step={1} value={mix[t]}
                        onChange={(e) => setMix({ ...mix, [t]: Number(e.target.value) })}
                        style={{ width: "100%", accentColor: TECH_ASSUMPTIONS[t].color }} />
                    </div>
                  ))}
                  {applied.cleanBoost > 0 && (
                    <div style={{ fontSize: "var(--t-xs)", color: "var(--green-deep)", background: "var(--green-tint)", padding: "0.45rem 0.6rem", marginTop: "0.4rem", lineHeight: 1.5 }}>
                      Policy instruments add {applied.cleanBoost.toFixed(0)} points of clean share on top of your targets, taken proportionally from the emitting slots.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── POLICY ── */}
        {tab === "policy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            <div style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.7, maxWidth: "var(--measure)" }}>
              Each instrument reaches the model through a stated mechanism rather than a fudge factor, so you can see why the
              result moved. Strength is how fully the policy is implemented, not how well it works.
            </div>
            {INSTRUMENTS.map((inst) => {
              const strength = policy[inst.id] ?? 0;
              const on = strength > 0;
              return (
                <div key={inst.id} style={{
                  background: "var(--surface-white)", border: `1px solid ${on ? "var(--green-line)" : "var(--border)"}`,
                  borderLeft: `3px solid ${on ? "var(--green)" : "var(--border)"}`, padding: "0.95rem 1.15rem",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                    <div style={{ minWidth: 260, flex: 1 }}>
                      <div style={{ fontSize: "var(--t-md)", fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{inst.label}</div>
                      <div style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)", lineHeight: 1.6 }}>{inst.lever}</div>
                    </div>
                    <div style={{ minWidth: 220, flex: "0 1 260px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--t-xs)", marginBottom: 2 }}>
                        <span style={{ color: "var(--ink-4)" }}>Implementation</span>
                        <span style={{ fontWeight: 700, color: on ? "var(--green-deep)" : "var(--ink-5)", fontVariantNumeric: "tabular-nums" }}>{strength}%</span>
                      </div>
                      <input type="range" min={0} max={100} step={5} value={strength}
                        onChange={(e) => setPolicy({ ...policy, [inst.id]: Number(e.target.value) })}
                        style={{ width: "100%", accentColor: "var(--green)" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.6rem", borderTop: "1px solid var(--border-soft)", paddingTop: "0.5rem" }}>
                    <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-3)", lineHeight: 1.6 }}>
                      <strong style={{ color: "var(--ink-2)" }}>Mechanism:</strong> {inst.mechanism}
                    </div>
                    <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", lineHeight: 1.6 }}>
                      <strong style={{ color: "var(--ink-3)" }}>Basis:</strong> {inst.basis}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── GOALS ── */}
        {tab === "goals" && (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Sector goals and the gap to them</span>
              <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>Set a target; the plan is measured against it</span>
            </div>
            <div style={{ padding: "0.6rem 0" }}>
              {SECTOR_GOALS.map((g) => {
                const delivered = g.read(plan);
                const target = goals[g.id];
                const gap = target !== undefined && delivered != null ? delivered - target : null;
                const meets = gap == null ? null : g.higherIsBetter ? gap >= 0 : gap <= 0;
                return (
                  <div key={g.id} style={{ padding: "0.8rem 1.15rem", borderBottom: "1px solid var(--border-soft)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(200px, 1.4fr) repeat(auto-fit, minmax(120px, 1fr))", gap: "0.9rem", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "var(--t-base)", fontWeight: 700, color: "var(--ink)" }}>{g.label}</div>
                        <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", lineHeight: 1.5 }}>{g.hint}</div>
                        {g.reference && (
                          <div style={{ fontSize: "var(--t-2xs)", color: "var(--ink-5)", marginTop: 2 }}>
                            Reference: {g.reference.value}{g.unit === "%" ? "%" : ` ${g.unit}`} — {g.reference.label}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="eyebrow" style={{ marginBottom: 2 }}>This plan</div>
                        <div style={{ fontSize: "var(--t-lg)", fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                          {delivered == null ? "—" : `${fmt(delivered, 1)}${g.unit === "%" ? "%" : ""}`}
                          {g.unit !== "%" && delivered != null && <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", marginLeft: 4 }}>{g.unit}</span>}
                        </div>
                      </div>
                      <div>
                        <label>
                          <span className="eyebrow" style={{ marginBottom: 2, display: "block" }}>Your target</span>
                          <input className="form-input" type="number" value={target ?? ""}
                            onChange={(e) => setGoal(g.id, e.target.value)}
                            placeholder="—" style={{ minHeight: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }} />
                        </label>
                      </div>
                      <div>
                        <div className="eyebrow" style={{ marginBottom: 2 }}>Gap</div>
                        {gap == null ? (
                          <span style={{ fontSize: "var(--t-sm)", color: "var(--ink-5)" }}>Set a target</span>
                        ) : (
                          <span style={{ fontSize: "var(--t-base)", fontWeight: 700, color: meets ? "var(--green)" : "var(--amber)", fontVariantNumeric: "tabular-nums" }}>
                            {meets ? "▲ met" : `${gap > 0 ? "+" : "−"}${fmt(Math.abs(gap), 1)}${g.unit === "%" ? "%" : ` ${g.unit}`}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="chart-source">
              Targets are yours. Where a published national commitment exists it is shown as a reference, but the model does
              not assume you are aiming at it.
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {tab === "results" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>

            <figure className="chart-panel" style={{ margin: 0 }}>
              <div className="chart-panel-head">
                <figcaption>
                  <div className="chart-panel-title">Electricity demand and required generation</div>
                  <div className="chart-panel-sub">GWh per year · generation exceeds demand by network losses</div>
                </figcaption>
              </div>
              <div className="viz-legend">
                <span className="viz-legend-item"><span className="viz-swatch" style={{ background: SERIES_COLORS[1] }} />Required generation</span>
                <span className="viz-legend-item"><span className="viz-swatch" style={{ background: SERIES_COLORS[0] }} />Delivered demand</span>
                <span className="viz-legend-item"><span className="viz-swatch" style={{ background: SERIES_COLORS[2] }} />Current trajectory</span>
              </div>
              <div className="chart-panel-body">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                    {axes}
                    <Tooltip content={<VizTooltip unit="GWh" />} cursor={{ stroke: AXIS.grid }} />
                    <Line type="monotone" dataKey="generation" name="Required generation" stroke={SERIES_COLORS[1]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-white)" }} />
                    <Line type="monotone" dataKey="demand" name="Delivered demand" stroke={SERIES_COLORS[0]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-white)" }} />
                    <Line type="monotone" dataKey="baseline" name="Current trajectory" stroke={SERIES_COLORS[2]} strokeWidth={1.6} strokeDasharray="5 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-source">
                Demand = base demand × population × activity × efficiency × access. The dashed line is the same model run on
                the current-trajectory pathway, for comparison.
              </div>
            </figure>

            <figure className="chart-panel" style={{ margin: 0 }}>
              <div className="chart-panel-head">
                <figcaption>
                  <div className="chart-panel-title">Installed capacity by technology</div>
                  <div className="chart-panel-sub">MW · the build this plan implies</div>
                </figcaption>
              </div>
              <div className="viz-legend">
                {TECHNOLOGIES.map((t) => (
                  <span key={t} className="viz-legend-item"><span className="viz-swatch" style={{ background: TECH_ASSUMPTIONS[t].color }} />{TECH_ASSUMPTIONS[t].label}</span>
                ))}
              </div>
              <div className="chart-panel-body">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={mixData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                    {axes}
                    <Tooltip content={<VizTooltip unit="MW" />} />
                    {TECHNOLOGIES.map((t) => (
                      <Area key={t} type="monotone" dataKey={t} name={TECH_ASSUMPTIONS[t].label} stackId="1"
                        stroke={TECH_ASSUMPTIONS[t].color} strokeWidth={1}
                        fill={TECH_ASSUMPTIONS[t].color} fillOpacity={0.85} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-source">
                Capacity = generation ÷ (8,760 h × availability) × (1 + reserve margin), walked from today&apos;s mix to your target.
              </div>
            </figure>

            <div className="split-rail" style={{ gap: "1.15rem" }}>
              <figure className="chart-panel" style={{ margin: 0 }}>
                <div className="chart-panel-head">
                  <figcaption>
                    <div className="chart-panel-title">Annual capital requirement</div>
                    <div className="chart-panel-sub">USD billion per year, overnight cost</div>
                  </figcaption>
                </div>
                <div className="chart-panel-body">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={econResult.annualCapexUsdBn} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={AXIS.grid} vertical={false} />
                      <XAxis dataKey="year" {...axisProps} minTickGap={28} />
                      <YAxis {...axisProps} width={48} tickFormatter={fmtAxis} />
                      <Tooltip content={<VizTooltip unit="bn USD" />} />
                      <Bar dataKey="value" name="Capital requirement" fill={SERIES_COLORS[3]} radius={[4, 4, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-source">Excludes grid reinforcement, storage and financing costs.</div>
              </figure>

              <div className="panel">
                <div className="panel-header"><span className="panel-title">Economic consequences</span></div>
                <div style={{ padding: "0.9rem 1.1rem" }}>
                  {[
                    { l: "Total capital", v: `$${fmt(econResult.capexUsdBn, 1)}bn`, s: `₦${fmt(econResult.capexNgnTn, 1)}tn` },
                    { l: "Present value", v: `$${fmt(econResult.presentValueUsdBn, 1)}bn`, s: `at ${econ.discountRatePct}% discount` },
                    { l: "Domestic spend", v: `$${fmt(econResult.domesticSpendUsdBn, 1)}bn`, s: `${econ.localContentPct}% local content` },
                    { l: "Construction jobs", v: fmt(econResult.constructionJobYears), s: "job-years over the plan" },
                    { l: "Operating jobs", v: fmt(econResult.operatingJobsAtHorizon), s: "at the horizon" },
                    ...(applied.carbonPriceUsd > 0 ? [{ l: "Carbon revenue", v: `$${fmt(econResult.carbonRevenueUsdBn, 1)}bn`, s: `at $${applied.carbonPriceUsd.toFixed(0)}/tonne` }] : []),
                  ].map((r) => (
                    <div key={r.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", padding: "0.4rem 0", borderBottom: "1px solid var(--border-soft)" }}>
                      <span style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)" }}>{r.l}</span>
                      <span style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "var(--t-base)", fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{r.v}</span>
                        <span style={{ display: "block", fontSize: "var(--t-2xs)", color: "var(--ink-5)" }}>{r.s}</span>
                      </span>
                    </div>
                  ))}
                  <div style={{ marginTop: "0.8rem" }}>
                    <Slider label="Local content" value={econ.localContentPct} min={0} max={100} step={5} unit="%" onChange={(v) => setEcon({ ...econ, localContentPct: v })} />
                    <Slider label="Discount rate" value={econ.discountRatePct} min={0} max={20} step={0.5} unit="%" onChange={(v) => setEcon({ ...econ, discountRatePct: v })} />
                  </div>
                </div>
                <div className="chart-source">
                  Job coefficients and local content are assumptions, not Nigerian measurements. They are shown so the figures
                  can be challenged rather than taken on trust.
                </div>
              </div>
            </div>

            <figure className="chart-panel" style={{ margin: 0 }}>
              <div className="chart-panel-head">
                <figcaption>
                  <div className="chart-panel-title">Emissions trajectory</div>
                  <div className="chart-panel-sub">Million tonnes CO₂e per year from the generation mix</div>
                </figcaption>
              </div>
              <div className="viz-legend">
                <span className="viz-legend-item"><span className="viz-swatch" style={{ background: STATUS.critical }} />This pathway</span>
                <span className="viz-legend-item"><span className="viz-swatch" style={{ background: SERIES_COLORS[2] }} />Current trajectory</span>
              </div>
              <div className="chart-panel-body">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                    {axes}
                    <Tooltip content={<VizTooltip unit="Mt CO₂e" />} cursor={{ stroke: AXIS.grid }} />
                    {chartData.some((d) => d.year === 2030) && (
                      <ReferenceLine x={2030} stroke={AXIS.tick} strokeDasharray="3 3"
                        label={{ value: "NDC 2030", fontSize: 10, fill: AXIS.tick, position: "top" }} />
                    )}
                    <Line type="monotone" dataKey="baselineEmissions" name="Current trajectory" stroke={SERIES_COLORS[2]} strokeWidth={1.6} strokeDasharray="5 4" dot={false} />
                    <Line type="monotone" dataKey="emissions" name="This pathway" stroke={STATUS.critical} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface-white)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-source">
                Emissions apportion generation by each technology&apos;s realistic capacity factor, not by installed capacity —
                solar capacity does not generate like gas capacity.
              </div>
            </figure>

            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Assumptions register</span>
                <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>Every coefficient the model uses</span>
              </div>
              <div className="scroll-x">
                <table className="data-table" style={{ fontSize: "var(--t-sm)" }}>
                  <thead><tr><th>Technology</th><th style={{ textAlign: "right" }}>Capex (USD/kW)</th><th style={{ textAlign: "right" }}>Capacity factor</th><th style={{ textAlign: "right" }}>Emission factor (gCO₂e/kWh)</th><th style={{ textAlign: "right" }}>Share at horizon</th></tr></thead>
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
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{shownMix[t].toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="chart-source">
                Planning assumptions, not NEDB measurements. Capital costs are overnight costs excluding grid reinforcement,
                storage and financing. Emission factors are lifecycle medians.
              </div>
            </div>
          </div>
        )}

        {/* ── CLIMATE ── */}
        {tab === "climate" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <div style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.7, maxWidth: "var(--measure)" }}>
              Nigeria&apos;s stated commitments, and what this pathway does against them. The model covers power sector
              emissions only, so a pass here is a pass on one sector, not on the whole economy-wide commitment.
            </div>
            {commitments.map((c) => {
              const tone = c.status === "on_track" ? STATUS.good : c.status === "off_track" ? STATUS.serious : "var(--ink-4)";
              return (
                <div key={c.id} style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderLeft: `3px solid ${tone}`, padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap", marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "var(--t-2xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: tone, border: `1px solid ${tone}`, padding: "1px 7px" }}>
                      {c.status === "on_track" ? "On track" : c.status === "off_track" ? "Off track" : "Not assessable"}
                    </span>
                    <span style={{ fontSize: "var(--t-md)", fontWeight: 700, color: "var(--ink)" }}>{c.label}</span>
                  </div>
                  <p style={{ fontSize: "var(--t-base)", color: "var(--ink-2)", lineHeight: 1.75, margin: "0 0 0.5rem", maxWidth: "var(--measure)" }}>{c.reading}</p>
                  <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", lineHeight: 1.6, borderTop: "1px solid var(--border-soft)", paddingTop: "0.45rem" }}>
                    <strong style={{ color: "var(--ink-3)" }}>Commitment:</strong> {c.detail}
                    <br />
                    <strong style={{ color: "var(--ink-3)" }}>Test applied:</strong> {c.test}
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", lineHeight: 1.7, borderTop: "1px solid var(--border)", paddingTop: "0.8rem" }}>
              Commitment values are as published by the Federal Government. The assessment is this model&apos;s reading of a
              single pathway and is not an official compliance determination.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NecalPage() {
  return (
    <NecalGate>
      <NecalWorkspace />
    </NecalGate>
  );
}
