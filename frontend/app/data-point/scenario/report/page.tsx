"use client";

// ── NECAL2050 report ────────────────────────────────────────────────────────
// A printable planning report from a pathway. Written in the form a planning
// document actually takes: what was assumed, what the plan requires, what it
// costs, what it emits, and where it stands against the country's commitments.
//
// It states its own limits. A report that reads as more certain than the model
// behind it is the way a planning tool does damage.

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import CoatOfArms from "@/components/layout/CoatOfArms";
import NecalGate from "@/components/necal/NecalGate";
import { getTokenFresh, getFullName } from "@/lib/auth";
import {
  runPlan, normaliseMix, PRESETS, TECHNOLOGIES, TECH_ASSUMPTIONS,
  DEFAULT_DRIVERS, DEFAULT_MIX,
} from "@/lib/necal";
import { DEFAULT_ECONOMICS, economics, assessCommitments } from "@/lib/necal-policy";

type ModelInput = {
  id: string; label: string; status: "measured" | "derived" | "missing";
  value: number | null; unit: string; period: string | null; note: string;
};

const fmt = (v: number, d = 0) => v.toLocaleString("en-NG", { maximumFractionDigits: d });

function ReportBody() {
  const [pathway, setPathway] = useState("access");
  const [horizon, setHorizon] = useState(2050);
  const [inputs, setInputs] = useState<ModelInput[]>([]);
  const [base, setBase] = useState({ generationGwh: 0, capacityMw: 0 });
  const [baseYear, setBaseYear] = useState<number | null>(null);
  const [anchored, setAnchored] = useState(false);
  const [author, setAuthor] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(true);
  const today = new Date();

  const load = useCallback(async () => {
    try {
      const token = await getTokenFresh();
      const r = await fetch("/api/necal/inputs", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!r.ok) return;
      const j = await r.json();
      const list: ModelInput[] = j.inputs ?? [];
      setInputs(list);
      setAnchored(!!j.summary?.anchored);
      const gen = list.find((i) => i.id === "generation");
      const ren = list.find((i) => i.id === "renewable_capacity");
      if (gen?.value) {
        setBase({ generationGwh: gen.value, capacityMw: ren?.value ?? 0 });
        if (gen.period) setBaseYear(Number(gen.period));
      }
    } finally {
      setLoading(false);
      setAuthor(getFullName() || "");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const preset = PRESETS.find((p) => p.id === pathway) ?? PRESETS[1];
  const drivers = { ...DEFAULT_DRIVERS, baseYear: baseYear ?? DEFAULT_DRIVERS.baseYear, horizon, ...preset.drivers };
  const plan = useMemo(() => runPlan(drivers, preset.mix, base), [drivers, preset, base]);
  const counterfactual = useMemo(() => {
    const cur = PRESETS.find((p) => p.id === "current")!;
    return runPlan({ ...DEFAULT_DRIVERS, baseYear: drivers.baseYear, horizon, ...cur.drivers }, cur.mix, base);
  }, [drivers.baseYear, horizon, base]);

  const econResult = useMemo(() => economics(plan, DEFAULT_ECONOMICS, 1, 0), [plan]);
  const commitments = useMemo(() => assessCommitments(plan, counterfactual), [plan, counterfactual]);
  const last = plan.years[plan.years.length - 1];
  const mix = normaliseMix(preset.mix);
  const reference = `NEDB/NECAL/${today.getFullYear()}/${pathway.toUpperCase()}-${horizon}`;
  const measured = inputs.filter((i) => i.status === "measured");
  const assumed = inputs.filter((i) => i.status !== "measured");

  if (loading) return <div style={{ padding: "3rem", textAlign: "center", color: "var(--ink-5)" }}>Preparing the report…</div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "1.5rem 1.25rem 4rem" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Controls — screen only */}
        <div className="no-print" style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1rem 1.15rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
            <Link href="/data-point/scenario" style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)" }}>← Back to the calculator</Link>
            <button onClick={() => window.print()} className="btn btn-primary btn-sm">Print or save as PDF</button>
          </div>
          <div className="grid-2" style={{ gap: "0.8rem" }}>
            <label>
              <span className="form-label">Pathway</span>
              <select className="form-input form-select" value={pathway} onChange={(e) => setPathway(e.target.value)}>
                {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <label>
              <span className="form-label">Horizon</span>
              <select className="form-input form-select" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
                {[2030, 2040, 2050, 2060].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label>
              <span className="form-label">Prepared by</span>
              <input className="form-input" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Name and directorate" />
            </label>
            <label>
              <span className="form-label">Prepared for</span>
              <input className="form-input" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Energy Commission Board, September sitting" />
            </label>
          </div>
        </div>

        {/* Print cover */}
        <div className="print-only bulletin-cover" style={{ display: "none" }}>
          <CoatOfArms size={86} />
          <div className="cover-republic">FEDERAL REPUBLIC OF NIGERIA</div>
          <div className="cover-org">ENERGY COMMISSION OF NIGERIA</div>
          <div className="cover-title">National Energy<br />Planning Report</div>
          <div className="cover-edition">{preset.label} · to {horizon}</div>
          <div className="cover-rule" />
          <div className="cover-meta">
            {author ? <>Prepared by {author}<br /></> : null}
            {purpose ? <>For {purpose}<br /></> : null}
            {today.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="cover-stamp">NECAL2050 · MODEL OUTPUT</div>
          <div className="cover-foot">{reference} · National Energy Data Bank · energy.gov.ng</div>
        </div>

        {/* Screen header */}
        <div className="no-print" style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderTop: "3px solid var(--green)", padding: "1.5rem 1.75rem", marginBottom: "1.25rem" }}>
          <div className="eyebrow">NECAL2050 planning report · {reference}</div>
          <h1 style={{ fontSize: "var(--t-2xl)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.2, letterSpacing: "-0.015em", marginBottom: "0.4rem" }}>
            {preset.label}, to {horizon}
          </h1>
          <p style={{ fontSize: "var(--t-md)", color: "var(--ink-3)", lineHeight: 1.7, maxWidth: "var(--measure)" }}>{preset.description}</p>
        </div>

        {/* 1 · What this plan requires */}
        <div className="sec-hd"><h2>1 · What this pathway requires</h2></div>
        <div className="grid-4 grid-hair" style={{ marginBottom: "1.25rem" }}>
          {[
            { l: `Demand ${horizon}`, v: last ? `${fmt(last.demandGwh)} GWh` : "—", s: `${plan.totals.demandGrowthMultiple.toFixed(1)}× the base year` },
            { l: "Capacity required", v: last ? `${fmt(last.capacityMw)} MW` : "—", s: `${fmt(plan.totals.capacityAddedMw)} MW to build` },
            { l: "Capital", v: `$${fmt(econResult.capexUsdBn, 1)}bn`, s: `₦${fmt(econResult.capexNgnTn, 1)}tn` },
            { l: "Clean generation", v: `${fmt(plan.totals.horizonCleanPct, 0)}%`, s: `emissions ${fmt(plan.totals.horizonEmissionsMt, 1)} Mt` },
          ].map((c) => (
            <div key={c.l} className="stat-cell">
              <div className="val">{c.v}</div>
              <div className="lbl">{c.l}</div>
              <div className="sub">{c.s}</div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: "var(--t-md)", color: "var(--ink-2)", lineHeight: 1.85, marginBottom: "1.5rem", maxWidth: "var(--measure)" }}>
          On this pathway, electricity demand reaches <strong>{last ? fmt(last.demandGwh) : "—"} GWh</strong> by {horizon},
          {" "}{plan.totals.demandGrowthMultiple.toFixed(1)} times the base year. Meeting it after network losses requires{" "}
          <strong>{last ? fmt(last.capacityMw) : "—"} MW</strong> of installed capacity, which means building{" "}
          <strong>{fmt(plan.totals.capacityAddedMw)} MW</strong> — an average of{" "}
          <strong>{fmt(plan.totals.capacityAddedMw / Math.max(1, horizon - drivers.baseYear))} MW a year</strong> every year
          between now and then. The capital requirement is <strong>${fmt(econResult.capexUsdBn, 1)} billion</strong> in
          overnight cost, excluding grid reinforcement, storage and financing.
        </p>

        {/* 2 · The build */}
        <div className="sec-hd"><h2>2 · The build, by technology</h2></div>
        <div className="panel" style={{ marginBottom: "1.5rem", pageBreakInside: "avoid" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Technology</th>
                <th style={{ textAlign: "right" }}>Share at {horizon}</th>
                <th style={{ textAlign: "right" }}>Capacity (MW)</th>
                <th style={{ textAlign: "right" }}>To build (MW)</th>
                <th style={{ textAlign: "right" }}>Capital (USD bn)</th>
              </tr>
            </thead>
            <tbody>
              {TECHNOLOGIES.map((t) => {
                const cap = last?.capacityByTech[t] ?? 0;
                const built = plan.years.reduce((a, y) => a + y.additionsByTech[t], 0);
                const capex = (built * 1000 * TECH_ASSUMPTIONS[t].capexUsdPerKw) / 1_000_000_000;
                return (
                  <tr key={t}>
                    <td className="td-primary">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 9, height: 9, background: TECH_ASSUMPTIONS[t].color }} />
                        {TECH_ASSUMPTIONS[t].label}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{mix[t].toFixed(0)}%</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(cap)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(built)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{capex.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="chart-source">Capital is overnight cost at the capex assumptions in section 5.</div>
        </div>

        {/* 3 · Economic consequences */}
        <div className="sec-hd"><h2>3 · Economic consequences</h2></div>
        <div className="panel" style={{ marginBottom: "1.5rem", pageBreakInside: "avoid" }}>
          <table className="data-table">
            <tbody>
              {[
                ["Total capital requirement", `$${fmt(econResult.capexUsdBn, 1)} billion`, "Overnight cost, excluding grid reinforcement, storage and financing"],
                ["Present value", `$${fmt(econResult.presentValueUsdBn, 1)} billion`, `Discounted at ${DEFAULT_ECONOMICS.discountRatePct}%`],
                ["In naira", `₦${fmt(econResult.capexNgnTn, 1)} trillion`, `At ₦${DEFAULT_ECONOMICS.fxNgnPerUsd} to the dollar`],
                ["Domestic spend", `$${fmt(econResult.domesticSpendUsdBn, 1)} billion`, `At ${DEFAULT_ECONOMICS.localContentPct}% local content`],
                ["Construction employment", `${fmt(econResult.constructionJobYears)} job-years`, "Across the whole plan period"],
                ["Operating employment", `${fmt(econResult.operatingJobsAtHorizon)} jobs`, `Sustained at ${horizon}`],
              ].map(([l, v, note]) => (
                <tr key={l}>
                  <td className="td-primary" style={{ width: "35%" }}>{l}</td>
                  <td style={{ fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums", width: "22%" }}>{v}</td>
                  <td style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)" }}>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="chart-source">
            Employment coefficients are planning assumptions, not Nigerian measurements. They are stated so they can be
            challenged.
          </div>
        </div>

        {/* 4 · Commitments */}
        <div className="sec-hd print-break"><h2>4 · Against Nigeria&apos;s commitments</h2></div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem", marginBottom: "1.5rem" }}>
          {commitments.map((c) => (
            <div key={c.id} style={{
              background: "var(--surface-white)", border: "1px solid var(--border)",
              borderLeft: `3px solid ${c.status === "on_track" ? "var(--green)" : c.status === "off_track" ? "var(--red)" : "var(--ink-4)"}`,
              padding: "0.9rem 1.15rem", pageBreakInside: "avoid",
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                <span style={{ fontSize: "var(--t-2xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: c.status === "on_track" ? "var(--green-deep)" : c.status === "off_track" ? "var(--red)" : "var(--ink-4)" }}>
                  {c.status === "on_track" ? "On track" : c.status === "off_track" ? "Off track" : "Not assessable"}
                </span>
                <strong style={{ fontSize: "var(--t-base)", color: "var(--ink)" }}>{c.label}</strong>
              </div>
              <p style={{ fontSize: "var(--t-base)", color: "var(--ink-2)", lineHeight: 1.75, margin: 0, maxWidth: "var(--measure)" }}>{c.reading}</p>
            </div>
          ))}
        </div>

        {/* 5 · Basis */}
        <div className="sec-hd"><h2>5 · What this rests on</h2></div>
        <div className="panel" style={{ marginBottom: "1.25rem" }}>
          <div className="panel-header">
            <span className="panel-title">Measured from the data bank</span>
            <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>{measured.length} inputs</span>
          </div>
          {measured.length === 0 ? (
            <div style={{ padding: "1rem 1.15rem", fontSize: "var(--t-base)", color: "var(--red)", lineHeight: 1.7 }}>
              None. No committed NEDB records anchor this plan, so every figure in this report is illustrative.
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Input</th><th style={{ textAlign: "right" }}>Value</th><th>Period</th></tr></thead>
              <tbody>
                {measured.map((i) => (
                  <tr key={i.id}>
                    <td className="td-primary">{i.label}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmt(i.value ?? 0, 1)} {i.unit}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-4)" }}>{i.period ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel" style={{ marginBottom: "1.5rem" }}>
          <div className="panel-header">
            <span className="panel-title">Supplied by assumption</span>
            <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>{assumed.length} inputs</span>
          </div>
          <table className="data-table">
            <thead><tr><th>Input</th><th>Why it is not measured</th></tr></thead>
            <tbody>
              {assumed.map((i) => (
                <tr key={i.id}>
                  <td className="td-primary" style={{ width: "30%" }}>{i.label}</td>
                  <td style={{ fontSize: "var(--t-xs)", color: "var(--ink-3)", lineHeight: 1.55 }}>{i.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 6 · Limits */}
        <div className="panel print-break">
          <div className="panel-header"><span className="panel-title">6 · How to read this report</span></div>
          <div style={{ padding: "1.1rem 1.35rem" }}>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.9 }}>
              <li>This is a model output, not a forecast. It says what a pathway would require, not what will happen.</li>
              <li>It covers the <strong>power sector only</strong>. Transport, industrial heat and agriculture are outside it, so a commitment met here is met on one sector.</li>
              <li>Capital figures are overnight costs. Grid reinforcement, storage, land and financing are excluded and would add materially.</li>
              <li>Where variable renewables exceed roughly 60% of capacity, the system needs flexibility this model does not cost.</li>
              {!anchored && <li><strong>This run is not anchored on committed NEDB data.</strong> Treat every figure as illustrative until the generation series is filled.</li>}
              {plan.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
          <div className="chart-source">
            Cite as: {preset.label} to {horizon}, NECAL2050 planning report {reference}, National Energy Data Bank, Energy
            Commission of Nigeria, {today.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}.
            {author ? ` Prepared by ${author}.` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NecalReportPage() {
  return (
    <NecalGate>
      <ReportBody />
    </NecalGate>
  );
}
