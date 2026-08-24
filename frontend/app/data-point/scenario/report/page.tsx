"use client";

// ── NECAL2050 report ────────────────────────────────────────────────────────
// A printable planning report for the pathway you were just looking at. Written
// in the form a planning document actually takes: what was assumed, what the
// plan requires, what it costs, what it emits, and where it stands against the
// country's commitments.
//
// It reads the scenario out of the link the calculator generated, so the printed
// figures are the calculator's figures. It used to run a stock preset instead,
// which meant the document circulated in a board pack could carry a different
// capital requirement from the screen it was produced off.
//
// It states its own limits. A report that reads as more certain than the model
// behind it is the way a planning tool does damage.

import { Suspense, useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CoatOfArms from "@/components/layout/CoatOfArms";
import NecalGate from "@/components/necal/NecalGate";
import { getTokenFresh, getFullName } from "@/lib/auth";
import { PRESETS, TECHNOLOGIES, TECH_ASSUMPTIONS, DEFAULT_DRIVERS } from "@/lib/necal";
import { INSTRUMENTS } from "@/lib/necal-policy";
import {
  deriveScenario, decodeScenario, DEFAULT_SCENARIO, type Scenario,
} from "@/lib/necal-scenario";

type ModelInput = {
  id: string; label: string; status: "measured" | "derived" | "missing" | "unavailable";
  value: number | null; unit: string; period: string | null; note: string;
};

const fmt = (v: number, d = 0) => v.toLocaleString("en-NG", { maximumFractionDigits: d });

function ReportBody() {
  const params = useSearchParams();

  const [inputs, setInputs] = useState<ModelInput[]>([]);
  const [base, setBase] = useState<{ generationGwh: number }>({ generationGwh: 0 });
  const [baseYear, setBaseYear] = useState<number | null>(null);
  const [anchored, setAnchored] = useState(false);
  const [anchorComplete, setAnchorComplete] = useState(true);
  const [anchorOvercounted, setAnchorOvercounted] = useState(false);
  const [author, setAuthor] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const today = new Date();

  // The run this report is of. A link that carries one reproduces it exactly; a
  // bare visit falls back to a preset and says so rather than pretending.
  const shared = useMemo(() => decodeScenario(params.get("s")), [params]);
  const [scenario, setScenario] = useState<Scenario>(shared ?? DEFAULT_SCENARIO);
  useEffect(() => { if (shared) setScenario(shared); }, [shared]);
  const fromCalculator = !!shared;

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const token = await getTokenFresh();
      const r = await fetch("/api/necal/inputs", {
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        setLoadError(body?.error ?? `The data bank did not answer (${r.status}).`);
        return;
      }
      const j = await r.json();
      const list: ModelInput[] = j.inputs ?? [];
      setInputs(list);
      setAnchored(!!j.summary?.anchored);
      setAnchorComplete(j.summary?.anchorComplete !== false);
      setAnchorOvercounted(!!j.summary?.anchorOvercounted);
      const gen = list.find((i) => i.id === "generation");
      if (gen?.value) {
        setBase({ generationGwh: gen.value });
        if (gen.period) setBaseYear(Number(gen.period));
      }
    } catch {
      setLoadError("The model inputs could not be read, so this report cannot state what anchors it.");
    } finally {
      setLoading(false);
      setAuthor(getFullName() || "");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // When the calculator supplied a scenario its base year came with it. A bare
  // visit takes the anchor year the data bank reports.
  const effectiveScenario = useMemo<Scenario>(() => (
    fromCalculator
      ? scenario
      : { ...scenario, drivers: { ...scenario.drivers, baseYear: baseYear ?? DEFAULT_DRIVERS.baseYear } }
  ), [fromCalculator, scenario, baseYear]);

  const { plan, econResult, commitments, shownMix, applied } =
    useMemo(() => deriveScenario(effectiveScenario, base), [effectiveScenario, base]);

  const horizon = effectiveScenario.drivers.horizon;
  const presetLabel = PRESETS.find((p) => p.id === effectiveScenario.presetId)?.label ?? "Custom pathway";
  const presetDescription = PRESETS.find((p) => p.id === effectiveScenario.presetId)?.description
    ?? "A pathway built from your own drivers, policy instruments and capacity mix rather than a stock preset.";
  const last = plan.years[plan.years.length - 1];
  const reference = `NEDB/NECAL/${today.getFullYear()}/${effectiveScenario.presetId.toUpperCase()}-${horizon}`;
  const measured = inputs.filter((i) => i.status === "measured");
  const assumed = inputs.filter((i) => i.status === "missing" || i.status === "derived");
  const unreadable = inputs.filter((i) => i.status === "unavailable");
  const activeInstruments = INSTRUMENTS.filter((i) => (effectiveScenario.policy[i.id] ?? 0) > 0);

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

          <div style={{
            background: fromCalculator ? "var(--green-tint)" : "var(--amber-tint)",
            border: `1px solid ${fromCalculator ? "var(--green-line)" : "var(--amber)"}`,
            padding: "0.65rem 0.85rem", marginBottom: "0.9rem",
            fontSize: "var(--t-sm)", color: "var(--ink-2)", lineHeight: 1.65,
          }}>
            {fromCalculator
              ? <>This report is of the run you had open: your drivers, your capacity mix, {activeInstruments.length} policy {activeInstruments.length === 1 ? "instrument" : "instruments"} and your economic assumptions. The figures below are the figures you were shown.</>
              : <>You opened this report directly, so there is no run to report on. It shows the <strong>{presetLabel}</strong> preset on stock assumptions. Generate it from the calculator to report your own pathway.</>}
          </div>

          <div className="grid-2" style={{ gap: "0.8rem" }}>
            {!fromCalculator && (
              <>
                <label>
                  <span className="form-label">Pathway</span>
                  <select className="form-input form-select" value={effectiveScenario.presetId}
                    onChange={(e) => {
                      const p = PRESETS.find((x) => x.id === e.target.value);
                      if (!p) return;
                      setScenario((s) => ({ ...s, presetId: p.id, drivers: { ...DEFAULT_DRIVERS, baseYear: s.drivers.baseYear, horizon: s.drivers.horizon, ...p.drivers }, mix: p.mix }));
                    }}>
                    {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </label>
                <label>
                  <span className="form-label">Horizon</span>
                  <select className="form-input form-select" value={horizon}
                    onChange={(e) => setScenario((s) => ({ ...s, drivers: { ...s.drivers, horizon: Number(e.target.value) } }))}>
                    {[2030, 2040, 2050, 2060].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </label>
              </>
            )}
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
          <div className="cover-edition">{effectiveScenario.name && effectiveScenario.name !== "Untitled scenario" ? effectiveScenario.name : presetLabel} · to {horizon}</div>
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
            {effectiveScenario.name && effectiveScenario.name !== "Untitled scenario" ? effectiveScenario.name : presetLabel}, to {horizon}
          </h1>
          <div style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)", marginBottom: "0.5rem" }}>Based on the {presetLabel} pathway</div>
          <p style={{ fontSize: "var(--t-md)", color: "var(--ink-3)", lineHeight: 1.7, maxWidth: "var(--measure)" }}>{presetDescription}</p>
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
          <strong>{fmt(plan.totals.capacityAddedMw / Math.max(1, horizon - effectiveScenario.drivers.baseYear))} MW a year</strong> every year
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
                const capex = (built * 1000 * TECH_ASSUMPTIONS[t].capexUsdPerKw * applied.capexMultiplier) / 1_000_000_000;
                return (
                  <tr key={t}>
                    <td className="td-primary">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 9, height: 9, background: TECH_ASSUMPTIONS[t].color }} />
                        {TECH_ASSUMPTIONS[t].label}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{shownMix[t].toFixed(0)}%</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(cap)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(built)}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{capex.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="chart-source">
            Shares are the mix after any policy instruments have moved capacity out of the emitting slots. Capital is
            overnight cost at the capex assumptions in section 5.
          </div>
        </div>

        {/* 3 · Policy instruments, when any are switched on */}
        {activeInstruments.length > 0 && (
          <>
            <div className="sec-hd"><h2>3 · Policy instruments in this pathway</h2></div>
            <div className="panel" style={{ marginBottom: "1.5rem", pageBreakInside: "avoid" }}>
              <table className="data-table">
                <thead><tr><th>Instrument</th><th style={{ textAlign: "right" }}>Implementation</th><th>Mechanism</th></tr></thead>
                <tbody>
                  {activeInstruments.map((i) => (
                    <tr key={i.id}>
                      <td className="td-primary" style={{ width: "26%" }}>{i.label}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, width: "14%" }}>{effectiveScenario.policy[i.id]}%</td>
                      <td style={{ fontSize: "var(--t-xs)", color: "var(--ink-3)", lineHeight: 1.55 }}>{i.mechanism}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="chart-source">
                Implementation is how fully the policy is carried out, not how well it works. Each instrument reaches the
                model through the stated mechanism, so its effect on the figures above is traceable.
              </div>
            </div>
          </>
        )}

        {/* 4 · Economic consequences */}
        <div className="sec-hd"><h2>{activeInstruments.length > 0 ? "4" : "3"} · Economic consequences</h2></div>
        <div className="panel" style={{ marginBottom: "1.5rem", pageBreakInside: "avoid" }}>
          <table className="data-table">
            <tbody>
              {[
                ["Total capital requirement", `$${fmt(econResult.capexUsdBn, 1)} billion`, "Overnight cost, excluding grid reinforcement, storage and financing"],
                ["Present value", `$${fmt(econResult.presentValueUsdBn, 1)} billion`, `Discounted at ${effectiveScenario.econ.discountRatePct}%`],
                ["In naira", `₦${fmt(econResult.capexNgnTn, 1)} trillion`, `At ₦${effectiveScenario.econ.fxNgnPerUsd} to the dollar`],
                ["Domestic spend", `$${fmt(econResult.domesticSpendUsdBn, 1)} billion`, `At ${effectiveScenario.econ.localContentPct}% local content`],
                ["Construction employment", `${fmt(econResult.constructionJobYears)} job-years`, "Across the whole plan period"],
                ["Operating employment", `${fmt(econResult.operatingJobsAtHorizon)} jobs`, `Sustained at ${horizon}`],
                ...(applied.carbonPriceUsd > 0
                  ? [["Carbon revenue", `$${fmt(econResult.carbonRevenueUsdBn, 1)} billion`, `At $${applied.carbonPriceUsd.toFixed(0)} a tonne`]]
                  : []),
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

        {/* 5 · Commitments */}
        <div className="sec-hd print-break"><h2>{activeInstruments.length > 0 ? "5" : "4"} · Against Nigeria&apos;s commitments</h2></div>
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

        {/* 6 · Basis */}
        <div className="sec-hd"><h2>{activeInstruments.length > 0 ? "6" : "5"} · What this rests on</h2></div>
        <div className="panel" style={{ marginBottom: "1.25rem" }}>
          <div className="panel-header">
            <span className="panel-title">Measured from the data bank</span>
            <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>{measured.length} inputs</span>
          </div>
          {loadError ? (
            <div style={{ padding: "1rem 1.15rem", fontSize: "var(--t-base)", color: "var(--amber)", lineHeight: 1.7 }}>
              {loadError} This report cannot state which of its figures are anchored on committed records, so it should not
              be circulated until it can.
            </div>
          ) : measured.length === 0 ? (
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

        {unreadable.length > 0 && (
          <div className="panel" style={{ marginBottom: "1.5rem", borderLeft: "3px solid var(--amber)" }}>
            <div className="panel-header">
              <span className="panel-title">Could not be read</span>
              <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>{unreadable.length} inputs</span>
            </div>
            <div style={{ padding: "0.9rem 1.15rem", fontSize: "var(--t-sm)", color: "var(--ink-3)", lineHeight: 1.7 }}>
              {unreadable.map((i) => i.label).join(", ")}. These are not stated as absent from the data bank, because the
              data bank did not answer for them. Regenerate the report before circulating it.
            </div>
          </div>
        )}

        {/* 7 · Limits */}
        <div className="panel print-break">
          <div className="panel-header"><span className="panel-title">{activeInstruments.length > 0 ? "7" : "6"} · How to read this report</span></div>
          <div style={{ padding: "1.1rem 1.35rem" }}>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.9 }}>
              <li>This is a model output, not a forecast. It says what a pathway would require, not what will happen.</li>
              <li>It covers the <strong>power sector only</strong>. Transport, industrial heat and agriculture are outside it, so a commitment met here is met on one sector.</li>
              <li>Capital figures are overnight costs. Grid reinforcement, storage, land and financing are excluded and would add materially.</li>
              <li>Where variable renewables exceed roughly 60% of capacity, the system needs flexibility this model does not cost.</li>
              {!fromCalculator && <li>This report was opened directly rather than generated from a run, so it shows a stock preset rather than anyone&apos;s pathway.</li>}
              {!anchored && <li><strong>This run is not anchored on committed NEDB data.</strong> Treat every figure as illustrative until the generation series is filled.</li>}
              {anchored && !anchorComplete && <li><strong>The anchor year is incomplete.</strong> The base year does not hold a full set of records, so demand, capacity and capital are all understated.</li>}
              {anchored && anchorOvercounted && <li><strong>The anchor year holds more records than it should.</strong> The base-year total is probably double counting, which would overstate every figure here. Check the generation series for duplicates before circulating this.</li>}
              {plan.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
          <div className="chart-source">
            Cite as: {presetLabel} to {horizon}, NECAL2050 planning report {reference}, National Energy Data Bank, Energy
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
      <Suspense fallback={<div style={{ padding: "3rem", textAlign: "center", color: "var(--ink-5)" }}>Preparing the report…</div>}>
        <ReportBody />
      </Suspense>
    </NecalGate>
  );
}
