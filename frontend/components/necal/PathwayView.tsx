"use client";

// ── PathwayView ─────────────────────────────────────────────────────────────
// One read-only renderer for a NECAL pathway, used by the public explorer and
// by shared planning-folder files. Everything is recomputed live from the
// scenario and its FROZEN base through the same model the author used — which
// is the whole point: a published pathway is checkable, not asserted.

import { useMemo } from "react";
import { deriveScenario, type Scenario } from "@/lib/necal-scenario";
import { buildRoadmap, buildProcurement } from "@/lib/necal-roadmap";
import { TECH_ASSUMPTIONS, TECHNOLOGIES, type PlanBase } from "@/lib/necal";

const fmt = (v: number, d = 0) => v.toLocaleString("en-NG", { maximumFractionDigits: d });

export default function PathwayView({ name, scenario, base, briefing, byline }: {
  name: string; scenario: Scenario; base: PlanBase; briefing?: string | null; byline?: string;
}) {
  const derived = useMemo(() => deriveScenario(scenario, base), [scenario, base]);
  const { plan, econResult, shownMix } = derived;
  const last = plan.years[plan.years.length - 1];
  const roadmap = useMemo(() => buildRoadmap(plan), [plan]);
  const procurement = useMemo(() => buildProcurement(plan), [plan]);
  const horizon = scenario.drivers.horizon;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderTop: "3px solid var(--green)", padding: "1.5rem 1.75rem", marginBottom: "1.25rem" }}>
        <div className="eyebrow">NECAL2050 pathway · read-only</div>
        <h1 style={{ fontSize: "var(--t-2xl)", fontWeight: 700, color: "var(--ink)", margin: 0, lineHeight: 1.2 }}>{name}</h1>
        {byline && <div style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)", marginTop: "0.4rem" }}>{byline}</div>}
        <p style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)", marginTop: "0.6rem", maxWidth: "var(--measure)", lineHeight: 1.7 }}>
          Computed against a base of {fmt(base.generationGwh)} GWh frozen when this pathway was {briefing !== undefined ? "saved" : "published"} —
          the figures below reproduce exactly, for anyone, from the scenario and that anchor. A model output, not a forecast.
        </p>
      </div>

      <div className="grid-auto grid-hair" style={{ marginBottom: "1.25rem" }}>
        {[
          { l: `Demand ${horizon}`, v: last ? `${fmt(last.demandGwh)} GWh` : "—", s: `${plan.totals.demandGrowthMultiple.toFixed(1)}× the base year` },
          { l: "Capacity to build", v: `${fmt(plan.totals.capacityAddedMw)} MW`, s: last ? `${fmt(last.capacityMw)} MW installed at ${horizon}` : "" },
          { l: "Capital", v: `$${fmt(econResult.capexUsdBn, 1)}bn`, s: `₦${fmt(econResult.capexNgnTn, 1)}tn` },
          { l: "Clean generation", v: `${fmt(plan.totals.horizonCleanPct, 0)}%`, s: `${fmt(plan.totals.horizonEmissionsMt, 1)} Mt CO2e at ${horizon}` },
          { l: "Carbon budget", v: `${fmt(plan.totals.cumulativeEmissionsMt, 0)} Mt`, s: "CO2e summed over the whole plan" },
        ].map((t) => (
          <div key={t.l} style={{ padding: "1rem 1.2rem" }}>
            <div style={{ fontSize: "var(--t-2xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-4)" }}>{t.l}</div>
            <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>{t.v}</div>
            <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", marginTop: 3 }}>{t.s}</div>
          </div>
        ))}
      </div>

      <div className="chart-panel" style={{ marginBottom: "1.25rem" }}>
        <div className="chart-panel-title" style={{ marginBottom: "0.6rem" }}>Generation mix target at {horizon}</div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {TECHNOLOGIES.map((t) => (
            <span key={t} style={{ fontSize: "var(--t-sm)", fontWeight: 600, padding: "4px 10px", border: "1px solid var(--border)", borderRadius: 2, color: "var(--ink-2)" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: TECH_ASSUMPTIONS[t].color, marginRight: 6 }} />
              {TECH_ASSUMPTIONS[t].label} {Math.round(shownMix[t])}%
            </span>
          ))}
        </div>
      </div>

      <div className="chart-panel" style={{ marginBottom: "1.25rem" }}>
        <div className="chart-panel-title" style={{ marginBottom: "0.6rem" }}>Roadmap</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--t-sm)" }}>
            <thead><tr style={{ borderBottom: "1.5px solid var(--ink)", textAlign: "left" }}>
              <th style={{ padding: "6px 10px" }}>Year</th><th style={{ padding: "6px 10px" }}>Milestone</th>
              <th style={{ padding: "6px 10px" }}>Responsible</th><th style={{ padding: "6px 10px" }}>Measured by</th>
            </tr></thead>
            <tbody>
              {roadmap.map((m) => (
                <tr key={m.year} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "7px 10px", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{m.year}</td>
                  <td style={{ padding: "7px 10px" }}>{m.headline}</td>
                  <td style={{ padding: "7px 10px", fontSize: "var(--t-xs)", color: "var(--ink-4)" }}>{m.responsible}</td>
                  <td style={{ padding: "7px 10px", fontFamily: "var(--font-mono)", fontSize: "var(--t-xs)", color: "var(--green)" }}>{m.measured_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="chart-panel" style={{ marginBottom: "1.25rem" }}>
        <div className="chart-panel-title" style={{ marginBottom: "0.6rem" }}>Procurement pipeline · first ten tenders</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--t-sm)" }}>
            <thead><tr style={{ borderBottom: "1.5px solid var(--ink)", textAlign: "left" }}>
              <th style={{ padding: "6px 10px" }}>Year</th><th style={{ padding: "6px 10px" }}>Technology</th>
              <th style={{ padding: "6px 10px", textAlign: "right" }}>Capacity</th><th style={{ padding: "6px 10px", textAlign: "right" }}>Indicative capex</th>
            </tr></thead>
            <tbody>
              {procurement.slice(0, 10).map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "6px 10px", fontFamily: "var(--font-mono)" }}>{r.year}</td>
                  <td style={{ padding: "6px 10px" }}>{TECH_ASSUMPTIONS[r.tech].label}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{r.addMw.toLocaleString()} MW</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>${r.capexUsdM.toLocaleString()}m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {briefing && (
        <div className="chart-panel" style={{ marginBottom: "1.25rem" }}>
          <div className="chart-panel-title" style={{ marginBottom: "0.6rem" }}>Briefing (machine-drafted, saved with the file)</div>
          <div style={{ fontSize: "var(--t-md)", color: "var(--ink-2)", lineHeight: 1.75, whiteSpace: "pre-wrap", maxWidth: "var(--measure)" }}>
            {briefing.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
              part.startsWith("**") && part.endsWith("**")
                ? <strong key={i} style={{ color: "var(--ink)" }}>{part.slice(2, -2)}</strong>
                : <span key={i}>{part}</span>
            )}
          </div>
        </div>
      )}

      {plan.warnings.length > 0 && (
        <div style={{ background: "var(--amber-tint)", border: "1px solid var(--amber)", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>What this rests on</div>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {plan.warnings.map((w, i) => <li key={i} style={{ fontSize: "var(--t-sm)", color: "var(--ink-2)", lineHeight: 1.6 }}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className="chart-source" style={{ background: "none", border: "none", padding: 0 }}>
        Power sector only. Capital cost assumptions are international planning figures, not Nigerian tender outcomes.
        National Energy Data Bank · Energy Commission of Nigeria.
      </div>
    </div>
  );
}
