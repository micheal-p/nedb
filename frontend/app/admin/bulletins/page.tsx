"use client";

// ── /admin/bulletins — Bulletin Editions ────────────────────────────────────
// Maker checker for the Monthly Energy Bulletin: an editor creates a draft
// (freezing the statistics at that moment), writes per-sector commentary, and
// an admin publishes. Published editions are frozen; corrections go in the
// next edition. Auth is enforced by the admin console shell.

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getTokenFresh, getRole, isAdminRole } from "@/lib/auth";
import { ConfirmPanel } from "@/components/ui/gov";
import { SECTOR_LABEL } from "@/lib/bulletin-shared";

type Edition = {
  id: number; edition_no: number; title: string; period_label: string;
  status: "draft" | "published"; data_cutoff: string; published_at: string | null;
  created_by: string | null; published_by: string | null;
};

type FullEdition = Edition & { commentary: Record<string, string>; snapshot: { sectorStats?: Record<string, unknown> } };

async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getTokenFresh();
  return fetch(url, {
    ...init,
    credentials: "include",
    headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const THIS_YEAR = new Date().getFullYear();
const YEAR_CHOICES = Array.from({ length: 8 }, (_, i) => THIS_YEAR - i);

export default function AdminBulletinsPage() {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [loading, setLoading]   = useState(true);
  const [creating, setCreating] = useState(false);
  // An edition is built FOR a period, so the period is chosen rather than typed
  // and the label is derived from it. A typed label could disagree with what was
  // actually filtered, which is how "August 2026" ended up on 2024 figures.
  const nowD = new Date();
  const prevMonth = nowD.getMonth() === 0 ? 12 : nowD.getMonth();
  const prevMonthYear = nowD.getMonth() === 0 ? nowD.getFullYear() - 1 : nowD.getFullYear();
  const [periodKind, setPeriodKind] = useState<"month" | "year">("month");
  const [periodYear, setPeriodYear] = useState(prevMonthYear);
  const [periodMonth, setPeriodMonth] = useState(prevMonth);
  const [openNo, setOpenNo]     = useState<number | null>(null);
  const [detail, setDetail]     = useState<FullEdition | null>(null);
  const [commentary, setCommentary] = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg]           = useState("");

  const load = useCallback(() => {
    authedFetch("/api/bulletin/editions?all=1")
      .then((r) => (r.ok ? r.json() : []))
      .then(setEditions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function openEdition(no: number) {
    setOpenNo(no); setDetail(null); setConfirmPublish(false); setMsg("");
    const r = await authedFetch(`/api/bulletin/editions/${no}`);
    if (r.ok) {
      const j: FullEdition = await r.json();
      setDetail(j);
      setCommentary(j.commentary ?? {});
    }
  }

  async function createDraft() {
    setCreating(true); setMsg("");
    const r = await authedFetch("/api/bulletin/editions", {
      method: "POST",
      body: JSON.stringify({ period_kind: periodKind, period_year: periodYear, period_month: periodMonth }),
    });
    const j = await r.json();
    setCreating(false);
    if (!r.ok) { setMsg(j.error ?? "Could not create draft."); return; }
    load();
    openEdition(j.edition_no);
  }

  async function saveCommentary() {
    if (openNo == null) return;
    setSaving(true); setMsg("");
    const r = await authedFetch(`/api/bulletin/editions/${openNo}`, { method: "PUT", body: JSON.stringify({ commentary }) });
    setSaving(false);
    setMsg(r.ok ? "Commentary saved." : "Save failed.");
  }

  async function publish() {
    if (openNo == null) return;
    setPublishing(true); setMsg("");
    const r = await authedFetch(`/api/bulletin/editions/${openNo}`, { method: "PUT", body: JSON.stringify({ action: "publish" }) });
    const j = await r.json();
    setPublishing(false); setConfirmPublish(false);
    if (!r.ok) { setMsg(j.error ?? "Publish failed."); return; }
    setMsg("Edition published.");
    load();
    openEdition(openNo);
  }

  const sectors = detail?.snapshot?.sectorStats ? Object.keys(detail.snapshot.sectorStats) : Object.keys(SECTOR_LABEL);
  const canPublish = isAdminRole(getRole());

  return (
    <div style={{ background: "var(--surface)", minHeight: "100%", padding: "2rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.25rem" }}>Publications</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>Bulletin Editions</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--ink-4)", marginTop: "0.35rem", maxWidth: 640, lineHeight: 1.6 }}>
            Creating a draft freezes the current committed statistics as that edition&apos;s data cutoff. Editors write commentary; an administrator publishes. Published editions never change.
          </p>
        </div>

        {/* Create draft */}
        <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ flex: "0 1 160px" }}>
            <span className="form-label">Edition covers</span>
            <select className="form-input form-select" value={periodKind}
              onChange={(e) => setPeriodKind(e.target.value as "month" | "year")}>
              <option value="month">A month</option>
              <option value="year">A full year</option>
            </select>
          </label>
          {periodKind === "month" && (
            <label style={{ flex: "0 1 160px" }}>
              <span className="form-label">Month</span>
              <select className="form-input form-select" value={periodMonth}
                onChange={(e) => setPeriodMonth(Number(e.target.value))}>
                {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </label>
          )}
          <label style={{ flex: "0 1 120px" }}>
            <span className="form-label">Year</span>
            <select className="form-input form-select" value={periodYear}
              onChange={(e) => setPeriodYear(Number(e.target.value))}>
              {YEAR_CHOICES.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button className="btn btn-primary" onClick={createDraft} disabled={creating}>{creating ? "Creating…" : "Create Draft Edition"}</button>
          <div style={{ flexBasis: "100%", fontSize: "var(--t-xs)", color: "var(--ink-4)", lineHeight: 1.6 }}>
            The snapshot is filtered to this period. Series with no record in it are shown with their latest figure and
            marked out of period, rather than printed as though they were this period&apos;s news.
          </div>
        </div>

        {msg && <div style={{ fontSize: "0.78rem", color: "var(--ink-3)", padding: "0.4rem 0 0.8rem" }}>{msg}</div>}

        {/* Editions list */}
        <div className="panel" style={{ marginBottom: "1.5rem" }}>
          <div className="panel-header"><span className="panel-title">All Editions</span></div>
          {loading ? (
            <div style={{ padding: "1.25rem", fontSize: "0.8rem", color: "var(--ink-5)" }}>Loading…</div>
          ) : editions.length === 0 ? (
            <div style={{ padding: "1.25rem", fontSize: "0.8rem", color: "var(--ink-4)" }}>No editions yet. Create the first draft above.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Edition</th><th>Period</th><th>Status</th><th style={{ textAlign: "right" }}>Data cutoff</th><th style={{ textAlign: "right" }}>Published</th><th /></tr></thead>
              <tbody>
                {editions.map((e) => (
                  <tr key={e.id}>
                    <td className="td-primary">No. {e.edition_no}</td>
                    <td>{e.period_label}</td>
                    <td>{e.status === "published" ? <span className="tag tag-green">Published</span> : <span className="tag tag-amber">Draft</span>}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "0.75rem" }}>{new Date(e.data_cutoff).toLocaleDateString("en-NG")}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "0.75rem" }}>{e.published_at ? new Date(e.published_at).toLocaleDateString("en-NG") : "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <button onClick={() => openEdition(e.edition_no)} style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--green)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
                        {e.status === "draft" ? "Edit" : "View"}
                      </button>
                      {e.status === "published" && (
                        <Link href={`/bulletin/${e.edition_no}`} style={{ marginLeft: 10, fontSize: "0.72rem", fontWeight: 700, color: "var(--ink-4)", textDecoration: "underline", textUnderlineOffset: 2 }}>Open page</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Edition detail */}
        {openNo != null && detail && (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Edition No. {detail.edition_no} — {detail.period_label}</span>
              <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>Data cutoff {new Date(detail.data_cutoff).toLocaleString("en-NG")}</span>
            </div>
            <div style={{ padding: "1.25rem" }}>
              {detail.status === "published" ? (
                <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", lineHeight: 1.6 }}>
                  This edition is published and frozen. Corrections are issued in the next edition.
                </p>
              ) : (
                <>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-4)", marginBottom: "0.6rem" }}>Sector commentary</div>
                  {sectors.map((sec) => (
                    <label key={sec} style={{ display: "block", marginBottom: "0.875rem" }}>
                      <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-3)", marginBottom: 4 }}>{SECTOR_LABEL[sec] ?? sec}</span>
                      <textarea className="form-input" rows={2} value={commentary[sec] ?? ""} onChange={(e) => setCommentary((c) => ({ ...c, [sec]: e.target.value }))}
                        placeholder="One short paragraph on what moved this period and why." style={{ resize: "vertical" }} />
                    </label>
                  ))}
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                    <button className="btn btn-secondary" onClick={saveCommentary} disabled={saving}>{saving ? "Saving…" : "Save Commentary"}</button>
                    {canPublish && !confirmPublish && (
                      <button className="btn btn-primary" onClick={() => setConfirmPublish(true)}>Publish Edition…</button>
                    )}
                    {!canPublish && <span style={{ fontSize: "0.75rem", color: "var(--ink-5)" }}>An administrator publishes this edition after review.</span>}
                  </div>
                  {confirmPublish && (
                    <ConfirmPanel
                      title={`Publish Bulletin No. ${detail.edition_no}?`}
                      body={`Publishing freezes this edition permanently with data cutoff ${new Date(detail.data_cutoff).toLocaleDateString("en-NG")}. It becomes the public citable record; later corrections must go in a new edition.`}
                      confirmLabel="Publish"
                      onConfirm={publish}
                      onCancel={() => setConfirmPublish(false)}
                      busy={publishing}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
