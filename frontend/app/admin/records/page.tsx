"use client";

// ── /admin/records — Data & Records ─────────────────────────────────────────
// The record-level console. Three things it does that the old Data Entry tab
// did not: the series list comes from the live registry (a hardcoded list of
// 13 meant any series added to the database was invisible here), records are
// paged with an exact total rather than silently capped at 200, and edits are
// validated — period was a free-text field while period_date was never
// recomputed, so a record's period and the date every chart sorts by could
// quietly diverge.

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { getTokenFresh } from "@/lib/auth";
import { ConfirmPanel } from "@/components/ui/gov";

type SeriesType = { id: string; name: string; sector: string; unit_default: string; frequency: string; record_count?: number };
type Rec = {
  id: number; series_type_id: string; period: string; period_date: string;
  region: string | null; value: number; unit: string; source: string | null;
  notes: string | null; created_at: string;
};
type Frozen = { id: number; series_type_id: string; period: string; reason: string | null };

const PAGE = 100;

async function authed(url: string, init?: RequestInit) {
  const token = await getTokenFresh();
  return fetch(url, {
    ...init, credentials: "include",
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

/** period → period_date. The two must never disagree: charts sort by the date. */
export function periodToDate(period: string): string | null {
  const p = period.trim();
  if (/^\d{4}$/.test(p)) return `${p}-01-01`;
  if (/^\d{4}-\d{2}$/.test(p)) {
    const m = Number(p.slice(5));
    return m >= 1 && m <= 12 ? `${p}-01` : null;
  }
  const q = p.match(/^(\d{4})-Q([1-4])$/);
  if (q) return `${q[1]}-${String((Number(q[2]) - 1) * 3 + 1).padStart(2, "0")}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(p) && !isNaN(Date.parse(p))) return p;
  return null;
}

export default function RecordsPage() {
  const [series, setSeries] = useState<SeriesType[]>([]);
  const [rows, setRows] = useState<Rec[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [frozen, setFrozen] = useState<Frozen[]>([]);
  const [loading, setLoading] = useState(true);

  const [fSeries, setFSeries] = useState("");
  const [fYear, setFYear] = useState("");
  const [fRegion, setFRegion] = useState("");
  const [q, setQ] = useState("");

  const [editing, setEditing] = useState<Rec | null>(null);
  const [editErr, setEditErr] = useState("");
  const [deleting, setDeleting] = useState<Rec | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // Series come from the live registry, so a newly registered series is
  // immediately visible here.
  useEffect(() => {
    authed("/api/admin/api-exposure")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setSeries(j.series ?? []); })
      .catch(() => {});
    authed("/api/admin/freeze")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) setFrozen(j.frozen ?? j ?? []); })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (fSeries) p.set("series", fSeries);
    if (fYear)   p.set("year", fYear);
    if (fRegion) p.set("region", fRegion);
    if (q.trim()) p.set("q", q.trim());
    try {
      const r = await authed(`/api/admin/records?${p}`);
      const j = await r.json();
      setRows(j.records ?? []);
      setTotal(j.total ?? 0);
    } catch {
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [offset, fSeries, fYear, fRegion, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setOffset(0); }, [fSeries, fYear, fRegion, q]);

  const seriesName = useCallback((id: string) => series.find((s) => s.id === id)?.name ?? id, [series]);

  const frozenFor = useCallback((r: Rec) =>
    frozen.some((f) => f.series_type_id === r.series_type_id && (f.period === r.period || f.period === "*")),
  [frozen]);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 8 }, (_, i) => String(now - i));
  }, []);

  async function saveEdit() {
    if (!editing) return;
    setEditErr("");
    const pd = periodToDate(editing.period);
    if (!pd) { setEditErr("Period must be YYYY, YYYY-MM, YYYY-QN or YYYY-MM-DD."); return; }
    if (!Number.isFinite(Number(editing.value))) { setEditErr("Value must be a number."); return; }
    if (!editing.unit?.trim()) { setEditErr("Unit is required."); return; }

    setBusy(true);
    const r = await authed(`/api/admin/records/${editing.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        period: editing.period.trim(),
        // Recomputed from the period so the two can never diverge.
        period_date: pd,
        value: Number(editing.value),
        unit: editing.unit.trim(),
        region: editing.region?.trim() || "NGA",
        source: editing.source?.trim() || null,
        notes: editing.notes?.trim() || null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setEditErr(j.error ?? "Could not save the record."); return; }
    setEditing(null);
    setMsg("Record updated and written to the revision log.");
    setTimeout(() => setMsg(""), 3000);
    load();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const r = await authed(`/api/admin/records/${deleting.id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error ?? "Delete failed."); setDeleting(null); return; }
    setDeleting(null);
    setMsg("Record deleted and logged.");
    setTimeout(() => setMsg(""), 3000);
    load();
  }

  const page = Math.floor(offset / PAGE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div style={{ background: "var(--surface)", minHeight: "100%", padding: "2rem" }}>
      <div style={{ maxWidth: 1150, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.25rem" }}>Data & Records</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>Committed Records</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--ink-4)", marginTop: "0.35rem", maxWidth: 700, lineHeight: 1.6 }}>
            Every figure published by the platform. Edits and deletions are audited and appear in the public{" "}
            <Link href="/revisions" style={{ color: "var(--green)", fontWeight: 600 }}>Data Revision Log</Link>. Frozen
            periods are locked against change.
          </p>
        </div>

        {msg && <div style={{ fontSize: "0.8rem", color: "var(--green-deep)", background: "var(--green-tint)", border: "1px solid var(--green-line)", padding: "0.55rem 0.9rem", marginBottom: "1rem" }}>{msg}</div>}

        {/* Filters */}
        <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "0.9rem 1.1rem", marginBottom: "1rem", display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ flex: "1 1 220px" }}>
            <span className="form-label">Series</span>
            <select className="form-input form-select" value={fSeries} onChange={(e) => setFSeries(e.target.value)}>
              <option value="">All series ({series.length})</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.record_count != null ? ` — ${s.record_count.toLocaleString()}` : ""}</option>
              ))}
            </select>
          </label>
          <label style={{ flex: "0 1 130px" }}>
            <span className="form-label">Year</span>
            <select className="form-input form-select" value={fYear} onChange={(e) => setFYear(e.target.value)}>
              <option value="">All years</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label style={{ flex: "0 1 130px" }}>
            <span className="form-label">Region</span>
            <input className="form-input" value={fRegion} onChange={(e) => setFRegion(e.target.value)} placeholder="NGA" />
          </label>
          <label style={{ flex: "1 1 180px" }}>
            <span className="form-label">Search period or source</span>
            <input className="form-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="2026-07, NUPRC…" />
          </label>
          {(fSeries || fYear || fRegion || q) && (
            <button onClick={() => { setFSeries(""); setFYear(""); setFRegion(""); setQ(""); }} className="btn btn-secondary btn-sm">Clear</button>
          )}
        </div>

        {deleting && (
          <ConfirmPanel
            title={`Delete record #${deleting.id}?`}
            body={`${seriesName(deleting.series_type_id)} · ${deleting.period} · ${deleting.value} ${deleting.unit}. This removes a published figure. The deletion is written to the audit log and appears in the public revision log, but the figure itself cannot be recovered.`}
            confirmLabel="Delete record"
            danger
            busy={busy}
            onConfirm={confirmDelete}
            onCancel={() => setDeleting(null)}
          />
        )}

        {/* Records */}
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Records</span>
            <span style={{ fontSize: "0.74rem", color: "var(--ink-4)", fontVariantNumeric: "tabular-nums" }}>
              {loading ? "Loading…" : total === 0 ? "No records match" : `${(offset + 1).toLocaleString()}–${Math.min(offset + rows.length, total).toLocaleString()} of ${total.toLocaleString()}`}
            </span>
          </div>

          <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
            <table className="data-table" style={{ fontSize: "0.76rem" }}>
              <thead>
                <tr>
                  <th>Series</th><th>Period</th><th>Region</th>
                  <th style={{ textAlign: "right" }}>Value</th><th>Unit</th><th>Source</th><th>Added</th><th />
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "1.75rem", color: "var(--ink-5)" }}>No records match these filters.</td></tr>
                )}
                {rows.map((r) => {
                  const locked = frozenFor(r);
                  const isEditing = editing?.id === r.id;
                  if (isEditing) {
                    return (
                      <tr key={r.id} style={{ background: "var(--surface-muted)" }}>
                        <td colSpan={8} style={{ padding: "0.9rem 1rem" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.6rem", marginBottom: "0.7rem" }}>
                            <label><span className="form-label">Period</span>
                              <input className="form-input" value={editing.period} onChange={(e) => setEditing({ ...editing, period: e.target.value })} /></label>
                            <label><span className="form-label">Value</span>
                              <input className="form-input" type="number" step="any" value={editing.value} onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) })} /></label>
                            <label><span className="form-label">Unit</span>
                              <input className="form-input" value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} /></label>
                            <label><span className="form-label">Region</span>
                              <input className="form-input" value={editing.region ?? ""} onChange={(e) => setEditing({ ...editing, region: e.target.value })} /></label>
                            <label><span className="form-label">Source</span>
                              <input className="form-input" value={editing.source ?? ""} onChange={(e) => setEditing({ ...editing, source: e.target.value })} /></label>
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "var(--ink-5)", marginBottom: "0.6rem" }}>
                            Sort date recalculated from the period: <strong>{periodToDate(editing.period) ?? "invalid period"}</strong>
                          </div>
                          {editErr && <div style={{ fontSize: "0.76rem", color: "var(--red)", marginBottom: "0.6rem" }}>{editErr}</div>}
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button onClick={saveEdit} disabled={busy} className="btn btn-primary btn-sm">{busy ? "Saving…" : "Save"}</button>
                            <button onClick={() => { setEditing(null); setEditErr(""); }} className="btn btn-secondary btn-sm">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={r.id}>
                      <td className="td-primary">{seriesName(r.series_type_id)}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>
                        {r.period}
                        {locked && <span className="tag tag-muted" style={{ marginLeft: 6, fontSize: "0.58rem" }}>FROZEN</span>}
                      </td>
                      <td>{r.region ?? "NGA"}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{Number(r.value).toLocaleString()}</td>
                      <td style={{ color: "var(--ink-4)" }}>{r.unit}</td>
                      <td style={{ color: "var(--ink-4)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.source ?? "—"}</td>
                      <td style={{ fontSize: "0.7rem", color: "var(--ink-5)" }}>{new Date(r.created_at).toLocaleDateString("en-NG")}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {locked ? (
                          <span style={{ fontSize: "0.7rem", color: "var(--ink-5)" }}>Locked</span>
                        ) : (
                          <>
                            <button onClick={() => { setEditing(r); setEditErr(""); }} style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--green)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>Edit</button>
                            <button onClick={() => setDeleting(r)} style={{ marginLeft: 10, fontSize: "0.72rem", fontWeight: 700, color: "var(--red)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.9rem", padding: "0.8rem" }}>
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} className="btn btn-secondary btn-sm">← Previous</button>
              <span style={{ fontSize: "0.75rem", color: "var(--ink-4)", fontVariantNumeric: "tabular-nums" }}>Page {page} of {pages}</span>
              <button disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)} className="btn btn-secondary btn-sm">Next →</button>
            </div>
          )}

          <div className="chart-source">
            Editing recalculates the sort date from the period so the two can never disagree. Frozen periods are read-only
            until unlocked under Administration.
          </div>
        </div>
      </div>
    </div>
  );
}
