"use client";

// PENA insights — Data Point side. Headline tiles, tier distribution,
// LGA choropleth (avg income), geocoded response map, per-state aggregates,
// and a filterable response table with CSV export.

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import LgaMap from "@/components/datapoint/LgaMap";
import PenaPointsMap, { type PenaPoint } from "@/components/pena/PenaPointsMap";
import { isLoggedIn, getRole } from "@/lib/auth";
import { TIERS, TIER_ORDER, type PenaTier } from "@/lib/pena";
import { normLga } from "@/lib/geo";

type Insights = {
  form: { id: number; title: string; slug: string; status: string; is_public_stats: boolean };
  questions: { label: string; slug: string }[];
  timeline: { date: string; count: number }[];
  income_histogram: { label: string; count: number }[];
  total: number;
  pending: number;
  expired: number;
  stats: {
    avg_income: number | null; median_income: number | null; avg_light_hours: number | null;
    avg_energy_expense: number | null; avg_burden_pct: number | null; geocoded: number;
  };
  tier_distribution: { tier: PenaTier; count: number }[];
  unclassified: number;
  by_state: { name: string; count: number; avg_income: number | null; avg_light_hours: number | null; avg_energy_expense: number | null; tiers: number[] }[];
  by_lga: { name: string; count: number; avg_income: number | null; avg_light_hours: number | null; avg_energy_expense: number | null; tiers: number[] }[];
  lga_income_map: Record<string, number>;
  energy_sources: { name: string; count: number }[];
  points: PenaPoint[];
};

type ResponseRow = {
  id: number; email: string | null; state_name: string | null; lga_name: string | null;
  address_text: string | null; lat: number | null; lng: number | null;
  answers: Record<string, unknown>;
  income: number | null; light_hours: number | null; energy_expense: number | null;
  tier: string | null; verify_status: string; created_at: string;
};

const PAGE_SIZE = 50;

const naira = (v: number | null) => (v == null ? "—" : `₦${Math.round(v).toLocaleString()}`);
const fixed = (v: number | null, d = 1) => (v == null ? "—" : v.toFixed(d));

const ctl: React.CSSProperties = { padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: "0.76rem", background: "#fff", color: "var(--ink-2)" };

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "var(--green)", margin: "0 0 0.625rem", display: "flex", alignItems: "center", gap: 8 }}>
      {children}
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

function TierPill({ t }: { t: PenaTier }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${TIERS[t].color}1C`, border: `1px solid ${TIERS[t].color}40`, borderRadius: 999, padding: "2px 10px 2px 6px" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: TIERS[t].color, border: "1px solid rgba(0,0,0,0.08)" }} />
      <span style={{ fontWeight: 700, fontSize: "0.72rem", color: "var(--ink)" }}>{t}</span>
      <span style={{ fontSize: "0.7rem", color: "var(--ink-3)" }}>{TIERS[t].label}</span>
    </span>
  );
}

function StatTile({ label, value, sub, hint, accent = false }: { label: string; value: string; sub?: string; hint?: string; accent?: boolean }) {
  return (
    <div title={hint} style={{ background: "#fff", border: "1px solid var(--border)", borderTop: accent ? "3px solid var(--green)" : "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "1.1rem 1.3rem", flex: "1 1 165px", minWidth: 165, cursor: hint ? "help" : "default", boxShadow: "0 1px 3px rgba(16,24,16,0.05)" }}>
      <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
        {label}
        {hint && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        )}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: accent ? "var(--green)" : "var(--ink)", fontFamily: "var(--font-mono)", lineHeight: 1, letterSpacing: "-0.01em" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.68rem", color: "var(--ink-5)", marginTop: 6, lineHeight: 1.45 }}>{sub}</div>}
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
  const [fLga, setFLga] = useState("");
  const [fTier, setFTier] = useState("");
  const [fMin, setFMin] = useState("");
  const [fMax, setFMax] = useState("");
  const [offset, setOffset] = useState(0);
  const [detail, setDetail] = useState<ResponseRow | null>(null);
  const [failed, setFailed] = useState(false);

  const filterQS = useCallback(() => {
    const p = new URLSearchParams();
    if (fState) p.set("state", fState);
    if (fLga)   p.set("lga", fLga);
    if (fTier)  p.set("tier", fTier);
    if (fMin)   p.set("income_min", fMin);
    if (fMax)   p.set("income_max", fMax);
    return p.toString();
  }, [fState, fLga, fTier, fMin, fMax]);

  const loadRows = useCallback(() => {
    fetch(`/api/pena/forms/${id}/responses?limit=${PAGE_SIZE}&offset=${offset}&${filterQS()}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { total: 0, rows: [] }))
      .then((j) => { setRows(j.rows ?? []); setTotal(j.total ?? 0); })
      .catch(() => {});
  }, [id, filterQS, offset]);

  // Clicking an LGA polygon filters the response table to that LGA
  const onLgaClick = useCallback((norm: string) => {
    setIns((cur) => {
      const g = cur?.by_lga.find((x) => normLga(x.name) === norm);
      if (g) { setFLga(g.name); setOffset(0); }
      return cur;
    });
  }, []);

  async function deleteResponse(r: ResponseRow) {
    if (!confirm(`Delete response #${r.id} (${r.email ?? "no email"}) permanently? This honours an NDPA removal request and cannot be undone.`)) return;
    const res = await fetch(`/api/pena/forms/${id}/responses?response_id=${r.id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      setDetail(null);
      loadRows();
      fetch(`/api/pena/forms/${id}/insights`, { credentials: "include" })
        .then((x) => (x.ok ? x.json() : null)).then((j) => j && setIns(j)).catch(() => {});
    } else {
      alert("Delete failed.");
    }
  }

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
            <h1 style={{ fontSize: "1.6rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>{ins.form.title}</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px", borderRadius: 3, background: ins.form.status === "open" ? "var(--green-tint)" : "var(--surface)", color: ins.form.status === "open" ? "var(--green)" : "var(--ink-4)", border: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{ins.form.status}</span>
              {ins.form.is_public_stats && <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px", borderRadius: 3, background: "var(--surface)", color: "var(--ink-4)", border: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Open Data</span>}
              <span style={{ fontSize: "0.7rem", color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>{ins.form.slug}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Link href="/data-point/dashboard" style={{ fontSize: "0.78rem", color: "var(--ink-4)", textDecoration: "none" }}>← Dashboard</Link>
            <Link href={`/admin/pena/${ins.form.id}`} style={{ fontSize: "0.78rem", color: "var(--green)", textDecoration: "none", fontWeight: 600 }}>Manage form →</Link>
          </div>
        </div>

        {/* Stat tiles */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
          <StatTile label="Verified Responses" value={ins.total.toLocaleString()} accent
            sub={`${ins.stats.geocoded} pinned on the map${ins.pending ? ` · ${ins.pending} awaiting email confirm` : ""}${ins.expired ? ` · ${ins.expired} expired unconfirmed` : ""}`}
            hint="How many responses are counted in every chart, map and average on this page. 'Pinned' responses have an exact map location from their address." />
          <StatTile label="Avg Income" value={naira(ins.stats.avg_income)} sub={`typical (median): ${naira(ins.stats.median_income)}`}
            hint="Average of what respondents reported earning per month. The median is the middle respondent — half earn less, half earn more — and resists distortion by a few very high earners." />
          <StatTile label="Avg Light Hours" value={fixed(ins.stats.avg_light_hours)} sub="of electricity supply per day (out of 24)"
            hint="Average hours of electricity supply respondents say they get in a day. 24 = constant supply; under 8 signals serious energy poverty." />
          <StatTile label="Avg Energy Spend" value={naira(ins.stats.avg_energy_expense)} sub="on all energy per month"
            hint="Average total monthly spend on energy — electricity bills, generator fuel, solar payments, everything combined." />
          <StatTile label="Energy Burden" value={ins.stats.avg_burden_pct == null ? "—" : `${ins.stats.avg_burden_pct.toFixed(1)}%`} sub="of monthly income goes to energy"
            hint="Energy spend ÷ income. The higher this share, the less affordable energy is: under 5% is comfortable, while above 10% is internationally regarded as energy poverty. This ratio drives the A–E tier." />
        </div>
        <p style={{ fontSize: "0.7rem", color: "var(--ink-5)", margin: "0 0 1.25rem", lineHeight: 1.5 }}>
          All figures are averages across verified responses. <strong style={{ color: "var(--ink-3)" }}>Energy burden</strong> = monthly
          energy spend ÷ monthly income — e.g. ₦60,000 spent from ₦500,000 earned = 12%, meaning roughly ₦1 of every ₦8 earned goes to energy.
          Hover any tile's ⓘ for how it is calculated.
        </p>

        {/* Tier distribution + energy sources */}
        <Kicker>Distribution</Kicker>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
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

        {/* Submissions over time + income distribution */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="chart-panel">
            <div className="chart-panel-head">
              <div>
                <div className="chart-panel-title">Submissions Over Time</div>
                <div className="chart-panel-sub">Responses per day</div>
              </div>
            </div>
            {ins.timeline.length === 0 ? (
              <div style={{ padding: "1rem 0", fontSize: "0.75rem", color: "var(--ink-5)" }}>No submissions yet.</div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 130, padding: "0.75rem 0 0.25rem" }}>
                {ins.timeline.map((d) => {
                  const maxC = Math.max(...ins.timeline.map((x) => x.count));
                  return (
                    <div key={d.date} title={`${d.date} — ${d.count} response${d.count === 1 ? "" : "s"}`}
                      style={{ flex: 1, minWidth: 4, height: `${(d.count / maxC) * 100}%`, background: "var(--green)", borderRadius: "3px 3px 0 0" }} />
                  );
                })}
              </div>
            )}
            {ins.timeline.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>
                <span>{ins.timeline[0].date}</span>
                <span>{ins.timeline[ins.timeline.length - 1].date}</span>
              </div>
            )}
            <div className="chart-source">Hover a bar for the daily count</div>
          </div>

          <div className="chart-panel">
            <div className="chart-panel-head">
              <div>
                <div className="chart-panel-title">Income Distribution</div>
                <div className="chart-panel-sub">₦ per month, respondent-reported</div>
              </div>
            </div>
            <div style={{ padding: "0.75rem 0", display: "flex", flexDirection: "column", gap: 10 }}>
              {ins.income_histogram.map((b) => {
                const maxB = Math.max(1, ...ins.income_histogram.map((x) => x.count));
                return (
                  <div key={b.label} style={{ display: "grid", gridTemplateColumns: "80px 1fr 44px", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--ink-2)", fontFamily: "var(--font-mono)" }}>{b.label}</span>
                    <div style={{ height: 14, background: "var(--surface)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${(b.count / maxB) * 100}%`, height: "100%", background: "var(--green)", borderRadius: 4, minWidth: b.count ? 3 : 0 }} />
                    </div>
                    <div style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--ink-3)", textAlign: "right" }}>{b.count}</div>
                  </div>
                );
              })}
            </div>
            <div className="chart-source">Data source: PENA field assessment / NEDB</div>
          </div>
        </div>

        {/* Maps */}
        <Kicker>Geography</Kicker>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginBottom: "1.5rem" }}>
          <LgaMap lgaData={ins.lga_income_map} stateAware title="Average Monthly Income by LGA — click an LGA to filter the table" unit="₦/month" source="PENA field assessment / NEDB" onSelect={onLgaClick}
            emptyTitle="No LGA averages yet" emptyHint="An LGA colours in once at least one verified response reports both an income and a Local Government Area." />
          <PenaPointsMap points={ins.points} title="Assessed Locations" source="PENA field assessment / NEDB" />
        </div>

        {/* Per-state table */}
        <Kicker>State Summary</Kicker>
        <div className="chart-panel" style={{ marginBottom: "1.5rem" }}>
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
        <Kicker>Individual Responses</Kicker>
        <div className="chart-panel">
          <div className="chart-panel-head">
            <div>
              <div className="chart-panel-title">Responses</div>
              <div className="chart-panel-sub">{total.toLocaleString()} matching · showing {total === 0 ? 0 : offset + 1}–{offset + rows.length} · click a row for full answers</div>
            </div>
            <a href={`/api/pena/forms/${id}/responses?format=csv&${filterQS()}`}
              style={{ padding: "4px 10px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid var(--green-line)", borderRadius: 4, background: "var(--green-tint)", color: "var(--green)", textDecoration: "none" }}>
              Export CSV
            </a>
          </div>

          {/* Filter row */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", padding: "0.75rem 0", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
            <select value={fState} onChange={(e) => setFState(e.target.value)} style={ctl}>
              <option value="">All states</option>
              {ins.by_state.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
            <select value={fTier} onChange={(e) => setFTier(e.target.value)} style={ctl}>
              <option value="">All tiers</option>
              {TIER_ORDER.map((t) => <option key={t} value={t}>Tier {t} — {TIERS[t].label}</option>)}
            </select>
            <input value={fMin} onChange={(e) => setFMin(e.target.value)} placeholder="Income min ₦" inputMode="numeric" style={{ ...ctl, width: 110 }} />
            <input value={fMax} onChange={(e) => setFMax(e.target.value)} placeholder="Income max ₦" inputMode="numeric" style={{ ...ctl, width: 110 }} />
            <button onClick={() => { setOffset(0); loadRows(); }} style={{ padding: "7px 16px", background: "var(--green)", color: "#fff", border: "none", borderRadius: 6, fontSize: "0.76rem", fontWeight: 700, cursor: "pointer" }}>Apply</button>
            {fLga && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--green-tint)", border: "1px solid var(--green-line)", borderRadius: 12, fontSize: "0.72rem", color: "var(--green)", fontWeight: 600 }}>
                LGA: {fLga}
                <button onClick={() => { setFLga(""); setOffset(0); }} style={{ background: "none", border: "none", color: "var(--green)", cursor: "pointer", fontSize: "0.8rem", padding: 0, lineHeight: 1 }}>×</button>
              </span>
            )}
            {(fState || fLga || fTier || fMin || fMax) && (
              <button onClick={() => { setFState(""); setFLga(""); setFTier(""); setFMin(""); setFMax(""); setOffset(0); }} style={{ padding: "6px 10px", background: "none", border: "1px solid var(--border)", borderRadius: 4, fontSize: "0.74rem", color: "var(--ink-4)", cursor: "pointer" }}>Clear</button>
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
                    <tr key={r.id} onClick={() => setDetail(r)} style={{ cursor: "pointer" }}>
                      <td style={{ whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleDateString()}</td>
                      <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.email ?? "—"}
                        {r.verify_status === "pending" && (
                          <span style={{ marginLeft: 6, fontSize: "0.6rem", fontWeight: 700, background: "var(--red-tint)", color: "var(--red)", padding: "1px 5px", borderRadius: 3, verticalAlign: "middle" }}>UNVERIFIED</span>
                        )}
                      </td>
                      <td>{r.state_name ?? "—"}</td>
                      <td>{r.lga_name ?? "—"}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{naira(r.income)}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{fixed(r.light_hours)}</td>
                      <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{naira(r.energy_expense)}</td>
                      <td>{t ? <TierPill t={t} /> : <span style={{ color: "var(--ink-5)" }}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.75rem", padding: "0.75rem 0 0.25rem" }}>
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                style={{ padding: "5px 14px", border: "1px solid var(--border)", borderRadius: 4, background: "#fff", fontSize: "0.74rem", color: offset === 0 ? "var(--ink-5)" : "var(--ink-2)", cursor: offset === 0 ? "default" : "pointer" }}>
                ← Prev
              </button>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>
                Page {Math.floor(offset / PAGE_SIZE) + 1} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
              </span>
              <button disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}
                style={{ padding: "5px 14px", border: "1px solid var(--border)", borderRadius: 4, background: "#fff", fontSize: "0.74rem", color: offset + PAGE_SIZE >= total ? "var(--ink-5)" : "var(--ink-2)", cursor: offset + PAGE_SIZE >= total ? "default" : "pointer" }}>
                Next →
              </button>
            </div>
          )}
          <div className="chart-source">Internal view — includes personal data. Handle under NDPA 2023; the public page carries aggregates only.</div>
        </div>

        {/* Response detail modal */}
        {detail && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={() => setDetail(null)}>
            <div style={{ background: "#fff", borderRadius: "var(--r-lg)", width: "100%", maxWidth: 560, maxHeight: "88vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ padding: "1.1rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)" }}>Response #{detail.id}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--ink-4)" }}>{new Date(detail.created_at).toLocaleString()}</div>
                </div>
                <button onClick={() => setDetail(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", fontSize: "1.2rem" }}>×</button>
              </div>

              <div style={{ padding: "1.25rem 1.5rem" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                  <tbody>
                    {ins.questions.map((q) => {
                      const v = detail.answers?.[q.slug];
                      if (v === undefined || v === null || v === "") return null;
                      return (
                        <tr key={q.slug} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "0.5rem 0.75rem 0.5rem 0", color: "var(--ink-4)", verticalAlign: "top", width: "42%" }}>{q.label}</td>
                          <td style={{ padding: "0.5rem 0", color: "var(--ink)", fontWeight: 600, wordBreak: "break-word" }}>
                            {Array.isArray(v) ? v.join(", ") : String(v)}
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.5rem 0.75rem 0.5rem 0", color: "var(--ink-4)" }}>Geography</td>
                      <td style={{ padding: "0.5rem 0", color: "var(--ink)", fontWeight: 600 }}>
                        {[detail.lga_name, detail.state_name].filter(Boolean).join(", ") || "—"}
                        {detail.lat != null && <span style={{ color: "var(--ink-4)", fontWeight: 400, fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}> · {detail.lat.toFixed(4)}, {detail.lng?.toFixed(4)}</span>}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "0.5rem 0.75rem 0.5rem 0", color: "var(--ink-4)" }}>Tier</td>
                      <td style={{ padding: "0.5rem 0" }}>
                        {detail.tier ? <TierPill t={detail.tier as PenaTier} /> : <span style={{ color: "var(--ink-5)" }}>Unclassified</span>}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {getRole() === "admin" && (
                  <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "0.68rem", color: "var(--ink-5)", maxWidth: 300, lineHeight: 1.5 }}>
                      NDPA 2023: respondents may request removal of their data at any time. Deleting also refreshes the public aggregates.
                    </div>
                    <button onClick={() => deleteResponse(detail)}
                      style={{ padding: "0.5rem 1.1rem", background: "#fff", border: "1px solid var(--red)", color: "var(--red)", borderRadius: 6, fontSize: "0.76rem", fontWeight: 700, cursor: "pointer" }}>
                      Delete Response
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
