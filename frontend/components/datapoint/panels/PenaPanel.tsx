"use client";

// ── PenaPanel.tsx ───────────────────────────────────────────────────────────
// PENA on the main Data Point dashboard: pick an assessment, see its headline
// numbers, tier mix and top states at a glance, then jump to full insights.
// Auth-aware: refreshes the access token before fetching (the cookie lives
// 15 minutes) and distinguishes "session expired" from "no assessments" —
// an expired session must never render the false empty state.

import { useState, useEffect } from "react";
import Link from "next/link";
import { getTokenFresh } from "@/lib/auth";
import { TIERS, type PenaTier } from "@/lib/pena";
import { buildBenchmarkIndex, coveragePer100k, DEFAULT_NBS_ROWS, type NbsRow } from "@/lib/nbs-benchmarks";

type FormRow = { id: number; title: string; status: string; response_count: number };
type Insights = {
  total: number;
  stats: { avg_income: number | null; avg_light_hours: number | null; avg_burden_pct: number | null };
  tier_distribution: { tier: PenaTier; count: number }[];
  by_state: { name: string; count: number; avg_income: number | null }[];
};

const naira = (v: number | null | undefined) => (v == null ? "—" : `₦${Math.round(v).toLocaleString()}`);

async function authedFetch(url: string): Promise<Response> {
  const token = await getTokenFresh();
  return fetch(url, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export default function PenaPanel() {
  const [forms, setForms] = useState<FormRow[]>([]);
  const [formId, setFormId] = useState<number | null>(null);
  const [ins, setIns] = useState<Insights | null>(null);
  const [national, setNational] = useState<number | null>(buildBenchmarkIndex(DEFAULT_NBS_ROWS).national);
  const [loading, setLoading] = useState(true);
  const [authExpired, setAuthExpired] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await authedFetch("/api/pena/forms");
        if (r.status === 401 || r.status === 403) { setAuthExpired(true); setLoading(false); return; }
        if (!r.ok) { setLoadError(true); setLoading(false); return; }
        const rows: FormRow[] = await r.json();
        setForms(rows);
        const best = [...rows].sort((a, b) => b.response_count - a.response_count)[0];
        if (best) setFormId(best.id);
        else setLoading(false);
      } catch {
        setLoadError(true);
        setLoading(false);
      }
    })();
    fetch("/api/pena/benchmarks")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { rows: NbsRow[] } | null) => { if (j?.rows?.length) setNational(buildBenchmarkIndex(j.rows).national); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (formId == null) return;
    setLoading(true);
    (async () => {
      try {
        const r = await authedFetch(`/api/pena/forms/${formId}/insights`);
        if (r.status === 401 || r.status === 403) { setAuthExpired(true); return; }
        setIns(r.ok ? await r.json() : null);
        if (!r.ok) setLoadError(true);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [formId]);

  const tierTotal = Math.max(1, (ins?.tier_distribution ?? []).reduce((a, t) => a + t.count, 0));
  const topStates = (ins?.by_state ?? []).slice(0, 3);
  const cov = ins ? coveragePer100k(ins.total, national) : null;

  return (
    <div className="panel" style={{ minWidth: 0 }}>
      <div className="panel-header" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
        <span className="panel-title">PENA — Energy Needs Assessments</span>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          {forms.length > 0 && (
            <select value={formId ?? ""} onChange={(e) => setFormId(Number(e.target.value))}
              style={{ padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 5, fontSize: "0.72rem", background: "#fff", color: "var(--ink-2)", maxWidth: 220 }}>
              {forms.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          )}
          {formId != null && (
            <Link href={`/data-point/pena/${formId}`} style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--green)", textDecoration: "none", whiteSpace: "nowrap" }}>
              Full insights →
            </Link>
          )}
        </div>
      </div>

      <div className="panel-body" style={{ padding: "1rem 1.25rem" }}>
        {authExpired ? (
          <div style={{ fontSize: "0.78rem", color: "var(--ink-3)", padding: "0.75rem 0", lineHeight: 1.6 }}>
            Your session has expired — <a href="" onClick={(e) => { e.preventDefault(); window.location.reload(); }} style={{ color: "var(--green)", fontWeight: 700 }}>reload the page</a> to sign back in and see PENA data.
          </div>
        ) : loading ? (
          <div style={{ fontSize: "0.78rem", color: "var(--ink-5)", padding: "0.75rem 0" }}>Loading…</div>
        ) : loadError && !ins ? (
          <div style={{ fontSize: "0.78rem", color: "var(--ink-5)", padding: "0.75rem 0" }}>PENA data could not be loaded right now — it will retry on your next visit.</div>
        ) : forms.length === 0 ? (
          <div style={{ fontSize: "0.78rem", color: "var(--ink-4)", padding: "0.75rem 0", lineHeight: 1.6 }}>
            No assessments yet — create one from <Link href="/admin/pena" style={{ color: "var(--green)" }}>the admin dashboard</Link> and
            share its link to start collecting field data.
          </div>
        ) : !ins ? (
          <div style={{ fontSize: "0.78rem", color: "var(--ink-5)", padding: "0.75rem 0" }}>Could not load insights for this assessment.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            {/* Headline mini-stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "0.75rem" }}>
              {[
                { label: "Verified", value: ins.total.toLocaleString() },
                { label: "Avg income", value: naira(ins.stats.avg_income) },
                { label: "Light hrs/day", value: ins.stats.avg_light_hours == null ? "—" : ins.stats.avg_light_hours.toFixed(1) },
                { label: "Energy burden", value: ins.stats.avg_burden_pct == null ? "—" : `${ins.stats.avg_burden_pct.toFixed(1)}%` },
                { label: "Coverage /100k", value: cov == null ? "—" : cov > 0 && cov < 0.01 ? "<0.01" : cov.toFixed(2) },
              ].map((s) => (
                <div key={s.label} style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.value}</div>
                  <div style={{ fontSize: "0.62rem", color: "var(--ink-5)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tier mix — one stacked bar, letters always visible */}
            {ins.total > 0 && (
              <div>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Tier mix (A secure → E critical)</div>
                <div style={{ display: "flex", gap: 2, height: 12, borderRadius: 4, overflow: "hidden" }}>
                  {ins.tier_distribution.map(({ tier, count }) => count > 0 && (
                    <div key={tier} title={`Tier ${tier} — ${TIERS[tier].label}: ${count}`}
                      style={{ flex: `${count} 1 0%`, background: TIERS[tier].color, minWidth: 6 }} />
                  ))}
                </div>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: 5, flexWrap: "wrap" }}>
                  {ins.tier_distribution.filter((t) => t.count > 0).map(({ tier, count }) => (
                    <span key={tier} style={{ fontSize: "0.64rem", color: "var(--ink-4)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: TIERS[tier].color }} />
                      <strong style={{ color: "var(--ink-2)" }}>{tier}</strong> {Math.round((count / tierTotal) * 100)}%
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Top states */}
            {topStates.length > 0 && (
              <div style={{ fontSize: "0.72rem", color: "var(--ink-3)", lineHeight: 1.6, minWidth: 0 }}>
                <strong style={{ color: "var(--ink-2)" }}>Top states:</strong>{" "}
                {topStates.map((s) => `${s.name} (${s.count} · ${naira(s.avg_income)})`).join(" · ")}
              </div>
            )}

            {ins.total === 0 && (
              <div style={{ fontSize: "0.74rem", color: "var(--ink-5)" }}>No verified responses yet — share the assessment link to start collecting.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
