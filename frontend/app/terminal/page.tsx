"use client";

// ── /terminal — Pipeline board ──────────────────────────────────────────────
// One screen answering the question a data officer actually has when they sit
// down: what is in flight, what is waiting on me, and what is wrong.
//
// The stages are the real upload_sessions states, so this is the pipeline
// itself rather than a picture of one.

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { getTokenFresh, getRole, isAdminRole } from "@/lib/auth";

type Session = {
  id: number; series_type_id: string; filename: string; status: string;
  row_count: number | null; error_count: number | null; uploaded_by: string | null; created_at: string;
};
type Series = { id: string; name: string; sector: string; frequency: string; is_public: boolean; record_count: number };
type Coverage = { id: string; name: string; sector: string; frequency: string; is_public: boolean; record_count: number; latest_period: string | null; periods_behind: number | null; gaps: string[] };
type Audit = { action: string; series_type_id: string | null; period: string | null; old_value: number | null; new_value: number | null; performed_by: string; performed_at: string; notes: string | null };
type Anomaly = { id: number; series_type_id: string; period: string; severity: string; message: string; status: string };

const STAGES = [
  { id: "pending",        label: "Staged",          blurb: "Uploaded, not yet validated" },
  { id: "validated",      label: "Validated",       blurb: "Passed checks, awaiting submission" },
  { id: "pending_review", label: "Awaiting review", blurb: "Submitted, needs a decision" },
  { id: "committed",      label: "Committed",       blurb: "Published to the data bank" },
  { id: "rejected",       label: "Rejected",        blurb: "Sent back" },
];

async function authed(url: string) {
  const token = await getTokenFresh();
  return fetch(url, { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
}

export default function PipelinePage() {
  const [data, setData] = useState<{
    sessions: Session[]; series: Series[]; coverage: Coverage[];
    recent: Audit[]; anomalies: Anomaly[]; frozen: { series_type_id: string; period: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    authed("/api/terminal/pipeline")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const nameOf = useCallback((id: string | null) => data?.series.find((s) => s.id === id)?.name ?? id ?? "—", [data]);

  const byStage = useMemo(() => {
    const m: Record<string, Session[]> = {};
    for (const s of data?.sessions ?? []) (m[s.status] ??= []).push(s);
    return m;
  }, [data]);

  const stale = useMemo(
    () => (data?.coverage ?? []).filter((c) => (c.periods_behind ?? 0) >= 2).sort((a, b) => (b.periods_behind ?? 0) - (a.periods_behind ?? 0)),
    [data]
  );
  const empty = useMemo(() => (data?.coverage ?? []).filter((c) => c.record_count === 0), [data]);
  const withGaps = useMemo(() => (data?.coverage ?? []).filter((c) => c.gaps.length > 0), [data]);

  if (loading) return <div style={{ padding: "2rem", color: "var(--ink-5)", fontSize: "var(--t-base)" }}>Reading the pipeline…</div>;
  if (failed || !data) return <div style={{ padding: "2rem", color: "var(--ink-4)", fontSize: "var(--t-base)" }}>The pipeline could not be read. Refresh to try again.</div>;

  const awaiting = byStage["pending_review"]?.length ?? 0;
  const admin = isAdminRole(getRole());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>

      {/* What needs a person, right now */}
      <div className="grid-4 grid-hair">
        {[
          { label: "Awaiting review", value: awaiting, tone: awaiting ? "var(--amber)" : "var(--ink-5)", sub: admin ? "You can decide these" : "With an administrator" },
          { label: "Open anomalies",  value: data.anomalies.length, tone: data.anomalies.length ? "var(--red)" : "var(--ink-5)", sub: "Flagged on commit" },
          { label: "Series overdue",  value: stale.length, tone: stale.length ? "var(--amber)" : "var(--green)", sub: "Two or more periods behind" },
          { label: "Series with no data", value: empty.length, tone: empty.length ? "var(--red)" : "var(--green)", sub: "Registered but never filled" },
        ].map((c) => (
          <div key={c.label} className="stat-cell">
            <div className="val" style={{ color: c.tone }}>{c.value}</div>
            <div className="lbl">{c.label}</div>
            <div className="sub">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* The pipeline itself */}
      <div className="term-card">
        <div className="term-card-head">
          <span className="term-card-title">Batches in flight</span>
          <span className="term-card-meta">{data.sessions.length} most recent</span>
        </div>
        <div className="scroll-x">
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${STAGES.length}, minmax(190px, 1fr))`, gap: 1, background: "var(--border)", minWidth: 960 }}>
            {STAGES.map((st) => {
              const rows = byStage[st.id] ?? [];
              return (
                <div key={st.id} style={{ background: "var(--surface-white)", minHeight: 190 }}>
                  <div style={{ padding: "0.5rem 0.7rem", borderBottom: "1px solid var(--border-soft)", background: "var(--surface-muted)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontSize: "var(--t-xs)", fontWeight: 700, color: "var(--ink)" }}>{st.label}</span>
                      <span style={{ fontSize: "var(--t-xs)", fontWeight: 700, color: rows.length ? "var(--ink)" : "var(--ink-5)", fontVariantNumeric: "tabular-nums" }}>{rows.length}</span>
                    </div>
                    <div style={{ fontSize: "var(--t-2xs)", color: "var(--ink-5)", lineHeight: 1.4 }}>{st.blurb}</div>
                  </div>
                  <div style={{ padding: "0.4rem" }}>
                    {rows.length === 0 ? (
                      <div style={{ fontSize: "var(--t-2xs)", color: "var(--ink-5)", padding: "0.5rem 0.3rem" }}>Nothing here.</div>
                    ) : rows.slice(0, 6).map((s) => (
                      <div key={s.id} style={{ padding: "0.45rem 0.5rem", borderBottom: "1px solid var(--border-soft)" }}>
                        <div style={{ fontSize: "var(--t-xs)", fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {nameOf(s.series_type_id)}
                        </div>
                        <div style={{ fontSize: "var(--t-2xs)", color: "var(--ink-5)" }}>
                          {s.row_count ?? 0} rows{s.error_count ? ` · ${s.error_count} errors` : ""} · {s.uploaded_by ?? "—"}
                        </div>
                        {st.id === "pending_review" && admin && (
                          <Link href="/terminal/review" style={{ fontSize: "var(--t-2xs)", fontWeight: 700, color: "var(--green)" }}>Decide →</Link>
                        )}
                      </div>
                    ))}
                    {rows.length > 6 && (
                      <div style={{ fontSize: "var(--t-2xs)", color: "var(--ink-5)", padding: "0.35rem 0.5rem" }}>and {rows.length - 6} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="split-rail" style={{ gap: "1.1rem" }}>

        {/* Coverage problems, ranked */}
        <div className="term-card">
          <div className="term-card-head">
            <span className="term-card-title">Where the data bank is thin</span>
            <Link href="/terminal/coverage" style={{ fontSize: "var(--t-xs)", fontWeight: 700, color: "var(--green)" }}>Full coverage →</Link>
          </div>
          {stale.length === 0 && empty.length === 0 && withGaps.length === 0 ? (
            <div style={{ padding: "1rem", fontSize: "var(--t-sm)", color: "var(--green-deep)" }}>
              Every registered series is current and complete.
            </div>
          ) : (
            <table className="data-table" style={{ fontSize: "var(--t-sm)" }}>
              <thead><tr><th>Series</th><th>Latest</th><th style={{ textAlign: "right" }}>Behind</th><th style={{ textAlign: "right" }}>Gaps</th><th /></tr></thead>
              <tbody>
                {[...empty, ...stale, ...withGaps.filter((c) => !stale.includes(c) && !empty.includes(c))].slice(0, 10).map((c) => (
                  <tr key={c.id}>
                    <td className="td-primary">
                      {c.name}
                      {!c.is_public && <span className="tag tag-muted" style={{ marginLeft: 6, fontSize: "0.55rem" }}>WITHHELD</span>}
                    </td>
                    <td style={{ fontVariantNumeric: "tabular-nums", color: c.latest_period ? "var(--ink-3)" : "var(--red)" }}>
                      {c.latest_period ?? "never"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: (c.periods_behind ?? 0) >= 3 ? "var(--red)" : (c.periods_behind ?? 0) >= 2 ? "var(--amber)" : "var(--ink-4)" }}>
                      {c.record_count === 0 ? "—" : `${c.periods_behind ?? 0}`}
                    </td>
                    <td style={{ textAlign: "right", color: c.gaps.length ? "var(--amber)" : "var(--ink-5)" }}>{c.gaps.length || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <Link href={`/terminal/entry?series=${c.id}`} style={{ fontSize: "var(--t-2xs)", fontWeight: 700, color: "var(--green)" }}>Fill →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="chart-source">
            &quot;Behind&quot; counts the series&apos; own periods, so a monthly series two behind is two months stale and an annual one is two years.
          </div>
        </div>

        {/* Right rail: anomalies then activity */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem", minWidth: 0 }}>
          <div className="term-card">
            <div className="term-card-head">
              <span className="term-card-title">Open anomalies</span>
              <span className="term-card-meta">{data.anomalies.length}</span>
            </div>
            {data.anomalies.length === 0 ? (
              <div style={{ padding: "0.9rem", fontSize: "var(--t-sm)", color: "var(--ink-4)" }}>Nothing flagged.</div>
            ) : (
              <div style={{ padding: "0.5rem 0" }}>
                {data.anomalies.slice(0, 6).map((a) => (
                  <div key={a.id} style={{ padding: "0.45rem 0.9rem", borderBottom: "1px solid var(--border-soft)" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                      <span style={{ fontSize: "var(--t-2xs)", fontWeight: 700, textTransform: "uppercase", color: a.severity === "high" ? "var(--red)" : "var(--amber)" }}>{a.severity}</span>
                      <span style={{ fontSize: "var(--t-xs)", fontWeight: 600, color: "var(--ink)" }}>{nameOf(a.series_type_id)}</span>
                      <span style={{ fontSize: "var(--t-2xs)", color: "var(--ink-5)", marginLeft: "auto" }}>{a.period}</span>
                    </div>
                    <div style={{ fontSize: "var(--t-2xs)", color: "var(--ink-3)", lineHeight: 1.5 }}>{a.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="term-card">
            <div className="term-card-head">
              <span className="term-card-title">Recent activity</span>
              <Link href="/revisions" style={{ fontSize: "var(--t-xs)", fontWeight: 700, color: "var(--green)" }}>Revision log →</Link>
            </div>
            {data.recent.length === 0 ? (
              <div style={{ padding: "0.9rem", fontSize: "var(--t-sm)", color: "var(--ink-4)" }}>Nothing recorded yet.</div>
            ) : (
              <div style={{ padding: "0.5rem 0" }}>
                {data.recent.slice(0, 8).map((r, i) => (
                  <div key={i} style={{ padding: "0.4rem 0.9rem", borderBottom: "1px solid var(--border-soft)" }}>
                    <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-2)", lineHeight: 1.5 }}>
                      {r.notes ?? `${r.action} on ${nameOf(r.series_type_id)}`}
                    </div>
                    <div style={{ fontSize: "var(--t-2xs)", color: "var(--ink-5)" }}>
                      {r.performed_by} · {new Date(r.performed_at).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
