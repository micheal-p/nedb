"use client";

// ── PENA analysis bulletin ──────────────────────────────────────────────────
// A printable findings report generated from one assessment. Written findings
// rather than charts: what the data says, what it rests on, and what it cannot
// support. Prints to A4 with the standard letterhead and cover.

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import CoatOfArms from "@/components/layout/CoatOfArms";
import { getTokenFresh } from "@/lib/auth";
import { analyse, type AnalysisInput } from "@/lib/pena-analysis";
import { TIERS, TIER_ORDER, K_ANON_MIN, type PenaTier } from "@/lib/pena";

type Insights = AnalysisInput & {
  form: { id: number; title: string; slug: string; status: string; is_public_stats: boolean };
  access?: { level: string; reason: string };
};

const naira = (v: number | null | undefined) => (v == null ? "—" : `₦${Math.round(v).toLocaleString()}`);

export default function PenaAnalysisPage() {
  const { id } = useParams<{ id: string }>();
  const [ins, setIns] = useState<Insights | null>(null);
  const [failed, setFailed] = useState(false);
  const today = new Date();

  useEffect(() => {
    (async () => {
      try {
        const token = await getTokenFresh();
        const r = await fetch(`/api/pena/forms/${id}/insights`, {
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!r.ok) { setFailed(true); return; }
        setIns(await r.json());
      } catch { setFailed(true); }
    })();
  }, [id]);

  if (failed) return <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "var(--ink-4)", fontSize: "var(--t-base)" }}>This assessment is not available to your account.</div>;
  if (!ins)   return <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "var(--ink-5)", fontSize: "var(--t-base)" }}>Preparing the analysis…</div>;

  const { findings, summary, caveats } = analyse({ ...ins, title: ins.form.title });
  const tierTotal = Math.max(1, ins.tier_distribution.reduce((a, t) => a + t.count, 0));
  const states = ins.by_state.filter((s) => s.count >= K_ANON_MIN);
  const reference = `NEDB/PENA/${today.getFullYear()}/${String(ins.form.id).padStart(4, "0")}`;

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "1.5rem 1.25rem 4rem" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>

        {/* Controls — screen only */}
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          <Link href={`/data-point/pena/${id}`} style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)" }}>← Back to insights</Link>
          <button onClick={() => window.print()} className="btn btn-primary btn-sm">Print or save as PDF</button>
        </div>

        {/* Print cover */}
        <div className="print-only bulletin-cover" style={{ display: "none" }}>
          <CoatOfArms size={86} />
          <div className="cover-republic">FEDERAL REPUBLIC OF NIGERIA</div>
          <div className="cover-org">ENERGY COMMISSION OF NIGERIA</div>
          <div className="cover-title">Energy Needs<br />Assessment Findings</div>
          <div className="cover-edition">{ins.form.title}</div>
          <div className="cover-rule" />
          <div className="cover-meta">
            {ins.total.toLocaleString()} verified responses<br />
            Prepared {today.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div className="cover-stamp">PENA ANALYSIS</div>
          <div className="cover-foot">{reference} · National Energy Data Bank · energy.gov.ng</div>
        </div>

        {/* Screen header */}
        <div className="no-print" style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderTop: "3px solid var(--green)", padding: "1.5rem 1.75rem", marginBottom: "1.25rem" }}>
          <div className="eyebrow">PENA analysis · {reference}</div>
          <h1 style={{ fontSize: "var(--t-2xl)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.2, marginBottom: "0.5rem", letterSpacing: "-0.015em" }}>
            {ins.form.title}
          </h1>
          <p style={{ fontSize: "var(--t-md)", color: "var(--ink-3)", lineHeight: 1.7, maxWidth: "var(--measure)" }}>{summary}</p>
        </div>

        {/* Headline figures */}
        <div className="grid-4 grid-hair" style={{ marginBottom: "1.5rem" }}>
          {[
            { l: "Verified responses", v: ins.total.toLocaleString() },
            { l: "Median income", v: naira(ins.stats.median_income), s: "per month" },
            { l: "Average supply", v: ins.stats.avg_light_hours == null ? "—" : `${ins.stats.avg_light_hours.toFixed(1)} h`, s: "per day, of 24" },
            { l: "Energy burden", v: ins.stats.avg_burden_pct == null ? "—" : `${ins.stats.avg_burden_pct.toFixed(1)}%`, s: "of income" },
          ].map((c) => (
            <div key={c.l} className="stat-cell">
              <div className="val">{c.v}</div>
              <div className="lbl">{c.l}</div>
              {c.s && <div className="sub">{c.s}</div>}
            </div>
          ))}
        </div>

        {/* Findings */}
        {findings.length === 0 ? (
          <div className="panel" style={{ marginBottom: "1.5rem" }}>
            <div style={{ padding: "1.5rem", fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.7 }}>
              {summary}
            </div>
          </div>
        ) : (
          <>
            <div className="sec-hd"><h2>Findings</h2><span className="sec-hd-meta">Generated from the verified responses</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.75rem" }}>
              {findings.map((f, i) => (
                <div key={i} style={{
                  background: "var(--surface-white)",
                  border: "1px solid var(--border)",
                  borderLeft: `3px solid ${f.weight === "headline" ? "var(--green)" : "var(--border-strong)"}`,
                  padding: "1.1rem 1.35rem",
                  pageBreakInside: "avoid",
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: "0.4rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "var(--t-2xs)", fontWeight: 700, color: "var(--ink-5)", fontVariantNumeric: "tabular-nums" }}>{String(i + 1).padStart(2, "0")}</span>
                    <h3 style={{ fontSize: "var(--t-lg)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.3, letterSpacing: "-0.01em" }}>{f.heading}</h3>
                  </div>
                  <p style={{ fontSize: "var(--t-md)", color: "var(--ink-2)", lineHeight: 1.75, margin: "0 0 0.6rem", maxWidth: "var(--measure)" }}>{f.body}</p>
                  <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", borderTop: "1px solid var(--border-soft)", paddingTop: "0.5rem" }}>
                    <strong style={{ color: "var(--ink-3)" }}>Basis:</strong> {f.basis}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Tier table */}
        {ins.total >= K_ANON_MIN && (
          <div className="panel" style={{ marginBottom: "1.5rem", pageBreakInside: "avoid" }}>
            <div className="panel-header">
              <span className="panel-title">Tier distribution</span>
              <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>A energy secure → E energy critical</span>
            </div>
            <table className="data-table">
              <thead><tr><th>Tier</th><th>Description</th><th style={{ textAlign: "right" }}>Responses</th><th style={{ textAlign: "right" }}>Share</th></tr></thead>
              <tbody>
                {TIER_ORDER.map((t) => {
                  const c = ins.tier_distribution.find((x) => x.tier === t)?.count ?? 0;
                  return (
                    <tr key={t}>
                      <td className="td-primary">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 10, height: 10, background: TIERS[t as PenaTier].color, flexShrink: 0 }} />
                          {t}
                        </span>
                      </td>
                      <td>{TIERS[t as PenaTier].label}</td>
                      <td style={{ textAlign: "right" }}>{c}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{((c / tierTotal) * 100).toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="chart-source">Tier is assigned from daily supply hours and energy burden at the moment each response is submitted.</div>
          </div>
        )}

        {/* State table */}
        {states.length > 0 && (
          <div className="panel" style={{ marginBottom: "1.5rem" }}>
            <div className="panel-header">
              <span className="panel-title">By state</span>
              <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>States below {K_ANON_MIN} responses are withheld</span>
            </div>
            <div className="scroll-x">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>State</th>
                    <th style={{ textAlign: "right" }}>Responses</th>
                    <th style={{ textAlign: "right" }}>Median-scale income</th>
                    <th style={{ textAlign: "right" }}>Supply (h/day)</th>
                    <th style={{ textAlign: "right" }}>Energy spend</th>
                    <th style={{ textAlign: "right" }}>Burden</th>
                  </tr>
                </thead>
                <tbody>
                  {states.map((s) => {
                    const burden = s.avg_income && s.avg_energy_expense ? (s.avg_energy_expense / s.avg_income) * 100 : null;
                    return (
                      <tr key={s.name}>
                        <td className="td-primary">{s.name}</td>
                        <td style={{ textAlign: "right" }}>{s.count}</td>
                        <td style={{ textAlign: "right" }}>{naira(s.avg_income)}</td>
                        <td style={{ textAlign: "right" }}>{s.avg_light_hours?.toFixed(1) ?? "—"}</td>
                        <td style={{ textAlign: "right" }}>{naira(s.avg_energy_expense)}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: burden != null && burden > 10 ? "var(--red)" : "var(--ink)" }}>
                          {burden == null ? "—" : `${burden.toFixed(1)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Caveats */}
        <div className="panel print-break">
          <div className="panel-header"><span className="panel-title">How to read this analysis</span></div>
          <div style={{ padding: "1.1rem 1.35rem" }}>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.9 }}>
              {caveats.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
          <div className="chart-source">
            Cite as: {ins.form.title}, PENA Analysis {reference}, National Energy Data Bank, Energy Commission of Nigeria,{" "}
            {today.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}.
          </div>
        </div>
      </div>
    </div>
  );
}
