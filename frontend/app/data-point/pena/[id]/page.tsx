"use client";

// PENA insights — Data Point side. Headline tiles, tier distribution,
// LGA choropleth (avg income), geocoded response map, per-state aggregates,
// and a filterable response table with CSV export.

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import LgaMap from "@/components/datapoint/LgaMap";
import PenaPointsMap, { type PenaPoint } from "@/components/pena/PenaPointsMap";
import { isLoggedIn } from "@/lib/auth";
import { TIERS, TIER_ORDER, type PenaTier } from "@/lib/pena";

type Insights = {
  form: { id: number; title: string; slug: string; status: string; is_public_stats: boolean };
  total: number;
  stats: {
    avg_income: number | null; median_income: number | null; avg_light_hours: number | null;
    avg_energy_expense: number | null; avg_burden_pct: number | null; geocoded: number;
  };
  tier_distribution: { tier: PenaTier; count: number }[];
  unclassified: number;
  by_state: { name: string; count: number; avg_income: number | null; avg_light_hours: number | null; avg_energy_expense: number | null; tiers: number[] }[];
  lga_income_map: Record<string, number>;
  energy_sources: { name: string; count: number }[];
  points: PenaPoint[];
};

type ResponseRow = {
  id: number; email: string | null; state_name: string | null; lga_name: string | null;
  income: number | null; light_hours: number | null; energy_expense: number | null;
  tier: string | null; created_at: string;
};

const naira = (v: number | null) => (v == null ? "—" : `₦${Math.round(v).toLocaleString()}`);
const fixed = (v: number | null, d = 1) => (v == null ? "—" : v.toFixed(d));

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1rem 1.25rem", flex: "1 1 150px", minWidth: 150 }}>
      <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.66rem", color: "var(--ink-5)", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

export default function PenaInsightsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [ins, setIns] = useState<Insights | null>(null);
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [fState, setFState] = useState("");
  const [fTier, setFTier] = useState("");
  const [fMin, setFMin] = useState("");
  const [fMax, setFMax] = useState("");
  const [failed, setFailed] = useState(false);

  const filterQS = useCallback(() => {
    const p = new URLSearchParams();
    if (fState) p.set("state", fState);
    if (fTier)  p.set("tier", fTier);
    if (fMin)   p.set("income_min", fMin);
    if (fMax)   p.set("income_max", fMax);
    return p.toString();
  }, [fState, fTier, fMin, fMax]);

  const loadRows = useCallback(() => {
    fetch(`/api/pena/forms/${id}/responses?limit=100&${filterQS()}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { total: 0, rows: [] }))
      .then((j) => { setRows(j.rows ?? []); setTotal(j.total ?? 0); })
      .catch(() => {});
  }, [id, filterQS]);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace(`/data-point/login?redirect=/data-point/pena/${id}`); return; }
    fetch(`/api/pena/forms/${id}/insights`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setIns)
      .catch(() => setFailed(true));
  }, [router, id]);

  useEffect(() => { if (ins) loadRows(); }, [ins, loadRows]);

  if (failed) return <div style={{ minHeight: "100vh", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-4)", fontSize: "0.85rem" }}>Assessment not found or access denied.</div>;
  if (!ins) return <div style={{ minHeight: "100vh", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-5)", fontSize: "0.85rem" }}>Loading insights…</div>;

  const maxTier = Math.max(1, ...ins.tier_distribution.map((t) => t.count));
  const maxSrc  = Math.max(1, ...ins.energy_sources.map((s) => s.count));

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.25rem" }}>Data Point · PENA Insights</div>
            <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>{ins.form.title}</h1>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Link href="/data-point/dashboard" style={{ fontSize: "0.78rem", color: "var(--ink-4)", textDecoration: "none" }}>← Dashboard</Link>
            <Link href={`/admin/pena/${ins.form.id}`} style={{ fontSize: "0.78rem", color: "var(--green)", textDecoration: "none", fontWeight: 600 }}>Manage form →</Link>
          </div>
        </div>

        {/* Stat tiles */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          <StatTile label="Responses" value={ins.total.toLocaleString()} sub={`${ins.stats.geocoded} geocoded`} />
          <StatTile label="Avg Income" value={naira(ins.stats.avg_income)} sub={`median ${naira(ins.stats.median_income)}`} />
          <StatTile label="Avg Light Hours" value={fixed(ins.stats.avg_light_hours)} sub="hours per day" />
          <StatTile label="Avg Energy Spend" value={naira(ins.stats.avg_energy_expense)} sub="per month" />
          <StatTile label="Energy Burden" value={ins.stats.avg_burden_pct == null ? "—" : `${ins.stats.avg_burden_pct.toFixed(1)}%`} sub="of income spent on energy" />
        </div>

        {/* Tier distribution + energy sources */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
          <div className="chart-panel">
            <div className="chart-panel-head">
              <div>
                <div className="chart-panel-title">Environmental–Economic Tiers</div>
                <div className="chart-panel-sub">A = energy secure &nbsp;·&nbsp; E = energy critical{ins.unclassified ? ` · ${ins.unclassified} unclassified` : ""}</div>
              </div>
            </div>
            <div style={{ padding: "0.75rem 0", display: "flex", flexDirection: "column", gap: 10 }}>
              {ins.tier_distribution.map(({ tier, count }) => (
                <div key={tier} style={{ display: "grid", gridTemplateColumns: "150px 1fr 44px", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 11, height: 11, borderRadius: 3, background: TIERS[tier].color, flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }} />
                    <span style={{ fontSize: "0.72rem", color: "var(--ink-2)", whiteSpace: "nowrap" }}><strong>{tier}</strong> · {TIERS[tier].label}</span>
                  </div>
                  <div style={{ height: 14, background: "var(--surface)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${(count / maxTier) * 100}%`, height: "100%", background: TIERS[tier].color, borderRadius: 4, minWidth: count ? 3 : 0 }} />
                  </div>
                  <div style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--ink-3)", textAlign: "right" }}>{count}</div>
                </div>
              ))}
            </div>
            <div className="chart-source">Tier = light hours/day + share of income spent on energy · computed at submission</div>
          </div>

          <div className="chart-panel">
            <div className="chart-panel-head">
              <div>
                <div className="chart-panel-title">Primary Energy Source</div>
                <div className="chart-panel-sub">Respondent-reported</div>
              </div>
            </div>
            <div style={{ padding: "0.75rem 0", display: "flex", flexDirection: "column", gap: 10 }}>
              {ins.energy_sources.length === 0 && <div style={{ fontSize: "0.75rem", color: "var(--ink-5)" }}>No energy-source question on this form.</div>}
              {ins.energy_sources.map((s) => (
                <div key={s.name} style={{ display: "grid", gridTemplateColumns: "150px 1fr 44px", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                  <div style={{ height: 14, background: "var(--surface)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${(s.count / maxSrc) * 100}%`, height: "100%", background: "var(--green)", borderRadius: 4, minWidth: 3 }} />
                  </div>
                  <div style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--ink-3)", textAlign: "right" }}>{s.count}</div>
                </div>
              ))}
            </div>
            <div className="chart-source">Data source: PENA field assessment / NEDB</div>
          </div>
        </div>

        {/* Maps */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginBottom: "1.25rem" }}>
          <LgaMap lgaData={ins.lga_income_map} title="Average Monthly Income by LGA" unit="₦/month" source="PENA field assessment / NEDB" />
          <PenaPointsMap points={ins.points} title="Assessed Locations" source="PENA field assessment / NEDB" />
        </div>

        {/* Per-state table */}
        <div className="chart-panel" style={{ marginBottom: "1.25rem" }}>
          <div className="chart-panel-head">
            <div>
              <div className="chart-panel-title">State Summary</div>
              <div className="chart-panel-sub">Averages per state, with tier counts A→E</div>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", fontSize: "0.76rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>State</th>
                  <th style={{ textAlign: "right" }}>Responses</th>
                  <th style={{ textAlign: "right" }}>Avg Income</th>
                  <th style={{ textAlign: "right" }}>Avg Light Hrs</th>
                  <th style={{ textAlign: "right" }}>Avg Energy Spend</th>
                  {TIER_ORDER.map((t) => <th key={t} style={{ textAlign: "right" }}>{t}</th>)}
                </tr>
              </thead>
              <tbody>
                {ins.by_state.map((s) => (
                  <tr key={s.name}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{s.count}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{naira(s.avg_income)}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{fixed(s.avg_light_hours)}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{naira(s.avg_energy_expense)}</td>
                    {s.tiers.map((n, i) => <td key={i} style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: n ? "var(--ink-2)" : "var(--ink-5)" }}>{n}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Responses table + filters */}
        <div className="chart-panel">
          <div className="chart-panel-head">
            <div>
              <div className="chart-panel-title">Responses</div>
              <div className="chart-panel-sub">{total.toLocaleString()} matching · showing first {Math.min(100, rows.length)}</div>
            </div>
            <a href={`/api/pena/forms/${id}/responses?format=csv&${filterQS()}`}
              style={{ padding: "4px 10px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid var(--green-line)", borderRadius: 4, background: "var(--green-tint)", color: "var(--green)", textDecoration: "none" }}>
              Export CSV
            </a>
          </div>

          {/* Filter row */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", padding: "0.625rem 0", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
            <select value={fState} onChange={(e) => setFState(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: "0.74rem" }}>
              <option value="">All states</option>
              {ins.by_state.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
            <select value={fTier} onChange={(e) => setFTier(e.target.value)} style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: "0.74rem" }}>
              <option value="">All tiers</option>
              {TIER_ORDER.map((t) => <option key={t} value={t}>Tier {t} — {TIERS[t].label}</option>)}
            </select>
            <input value={fMin} onChange={(e) => setFMin(e.target.value)} placeholder="Income min ₦" inputMode="numeric" style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: "0.74rem", width: 110 }} />
            <input value={fMax} onChange={(e) => setFMax(e.target.value)} placeholder="Income max ₦" inputMode="numeric" style={{ padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: "0.74rem", width: 110 }} />
            <button onClick={loadRows} style={{ padding: "6px 14px", background: "var(--green)", color: "#fff", border: "none", borderRadius: 4, fontSize: "0.74rem", fontWeight: 700, cursor: "pointer" }}>Apply</button>
            {(fState || fTier || fMin || fMax) && (
              <button onClick={() => { setFState(""); setFTier(""); setFMin(""); setFMax(""); }} style={{ padding: "6px 10px", background: "none", border: "1px solid var(--border)", borderRadius: 4, fontSize: "0.74rem", color: "var(--ink-4)", cursor: "pointer" }}>Clear</button>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", fontSize: "0.74rem" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Submitted</th>
                  <th style={{ textAlign: "left" }}>Email</th>
                  <th style={{ textAlign: "left" }}>State</th>
                  <th style={{ textAlign: "left" }}>LGA</th>
                  <th style={{ textAlign: "right" }}>Income</th>
                  <th style={{ textAlign: "right" }}>Light Hrs</th>
                  <th style={{ textAlign: "right" }}>Energy Spend</th>
                  <th style={{ textAlign: "left" }}>Tier</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--ink-5)", padding: "1.5rem" }}>No responses match these filters.</td></tr>
                )}
                {rows.map((r) => {
                  const t = r.tier as PenaTier | null;
                  return (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleDateString()}</td>
                      <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>{r.email ?? "—"}</td>
                      <td>{r.state_name ?? "—"}</td>
                      <td>{r.lga_name ?? "—"}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{naira(r.income)}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{fixed(r.light_hours)}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{naira(r.energy_expense)}</td>
                      <td>
                        {t ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <span style={{ width: 9, height: 9, borderRadius: "50%", background: TIERS[t].color, border: "1px solid rgba(0,0,0,0.08)" }} />
                            <span style={{ fontWeight: 700 }}>{t}</span>
                            <span style={{ color: "var(--ink-4)" }}>{TIERS[t].label}</span>
                          </span>
                        ) : <span style={{ color: "var(--ink-5)" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="chart-source">Internal view — includes personal data. Handle under NDPA 2023; the public page carries aggregates only.</div>
        </div>
      </div>
    </div>
  );
}
