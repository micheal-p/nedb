"use client";

// ── /terminal/review — Decision station ─────────────────────────────────────
// Batches waiting on a checker. The reviewer sees the rows themselves and how
// they compare with what is already on file, because approving a batch you have
// not looked at is just a slower way of committing without review.

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getTokenFresh, getRole, isAdminRole } from "@/lib/auth";
import { ConfirmPanel } from "@/components/ui/gov";

type Session = {
  id: number; series_type_id: string; filename: string; status: string;
  row_count: number | null; error_count: number | null; uploaded_by: string | null; created_at: string;
};
type Row = { period: string; value: number; unit: string; region: string | null; source: string | null };

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

export default function ReviewPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Session | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [existing, setExisting] = useState<Record<string, number>>({});
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const admin = isAdminRole(getRole());

  const load = useCallback(() => {
    authed("/api/terminal/pipeline")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        setSessions((j.sessions ?? []).filter((s: Session) => s.status === "pending_review"));
        setNames(Object.fromEntries((j.series ?? []).map((s: { id: string; name: string }) => [s.id, s.name])));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function openSession(s: Session) {
    setOpen(s); setRows([]); setExisting({}); setPending(null); setMsg("");
    // The staged rows live on the session; what they would replace lives in the
    // records table. The reviewer needs both side by side.
    const [batchRes, recRes] = await Promise.all([
      authed(`/api/upload/review/${s.id}/rows`).catch(() => null),
      authed(`/api/admin/records?series=${s.series_type_id}&limit=500`).catch(() => null),
    ]);
    if (batchRes?.ok) {
      const j = await batchRes.json();
      setRows(j.rows ?? []);
    }
    if (recRes?.ok) {
      const j = await recRes.json();
      const m: Record<string, number> = {};
      for (const r of j.records ?? []) m[r.period] = Number(r.value);
      setExisting(m);
    }
  }

  async function decide(action: "approve" | "reject") {
    if (!open) return;
    setBusy(true);
    const r = await authed(`/api/upload/review/${open.id}`, { method: "POST", body: JSON.stringify({ action }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false); setPending(null);
    if (!r.ok) { setMsg(j.error ?? "The decision could not be recorded."); return; }
    setMsg(action === "approve"
      ? `Approved — ${j.committed_rows ?? 0} figures committed${j.replaced_rows ? `, ${j.replaced_rows} replaced` : ""}.`
      : "Batch rejected and the uploader notified.");
    setOpen(null);
    load();
  }

  if (!admin) {
    return (
      <div className="term-card" style={{ padding: "1.5rem" }}>
        <div style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.7, maxWidth: "var(--measure)" }}>
          Decisions on staged batches are made by administrators. Your own submissions appear on the{" "}
          <Link href="/terminal" style={{ color: "var(--green)", fontWeight: 600 }}>pipeline board</Link> so you can see where they have reached.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
      {msg && <div style={{ fontSize: "var(--t-base)", color: "var(--ink-2)", background: "var(--surface-muted)", border: "1px solid var(--border)", padding: "0.65rem 0.9rem" }}>{msg}</div>}

      <div className="term-card">
        <div className="term-card-head">
          <span className="term-card-title">Awaiting a decision</span>
          <span className="term-card-meta">{sessions.length}</span>
        </div>
        {loading ? (
          <div style={{ padding: "1rem", fontSize: "var(--t-sm)", color: "var(--ink-5)" }}>Loading…</div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: "1.1rem", fontSize: "var(--t-base)", color: "var(--green-deep)" }}>
            Nothing is waiting. Every staged batch has been decided.
          </div>
        ) : (
          <table className="data-table" style={{ fontSize: "var(--t-sm)" }}>
            <thead><tr><th>Series</th><th>Source file</th><th style={{ textAlign: "right" }}>Rows</th><th>Submitted by</th><th style={{ textAlign: "right" }}>When</th><th /></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="td-primary">{names[s.series_type_id] ?? s.series_type_id}</td>
                  <td style={{ color: "var(--ink-4)" }}>{s.filename}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{s.row_count ?? 0}</td>
                  <td>{s.uploaded_by ?? "—"}</td>
                  <td style={{ textAlign: "right", fontSize: "var(--t-xs)", color: "var(--ink-4)" }}>{new Date(s.created_at).toLocaleDateString("en-NG")}</td>
                  <td style={{ textAlign: "right" }}>
                    <button onClick={() => openSession(s)}
                      style={{ background: "none", border: "none", color: "var(--green)", fontSize: "var(--t-xs)", fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
                      Examine
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <div className="term-card">
          <div className="term-card-head">
            <span className="term-card-title">{names[open.series_type_id] ?? open.series_type_id} · {open.filename}</span>
            <button onClick={() => setOpen(null)} style={{ background: "none", border: "none", color: "var(--ink-4)", fontSize: "var(--t-sm)", cursor: "pointer" }}>Close</button>
          </div>

          <div className="scroll-x">
            {rows.length === 0 ? (
              <div style={{ padding: "1.1rem", fontSize: "var(--t-sm)", color: "var(--ink-4)", lineHeight: 1.7 }}>
                The staged rows for this batch could not be read back for preview. You can still decide on it, but consider
                asking the uploader to resubmit if you cannot see what it contains.
              </div>
            ) : (
              <table className="data-table" style={{ fontSize: "var(--t-sm)" }}>
                <thead>
                  <tr>
                    <th>Period</th><th>Region</th>
                    <th style={{ textAlign: "right" }}>On file</th>
                    <th style={{ textAlign: "right" }}>Incoming</th>
                    <th style={{ textAlign: "right" }}>Change</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const prior = existing[r.period];
                    const diff = prior !== undefined ? ((r.value - prior) / Math.abs(prior || 1)) * 100 : null;
                    const big = diff !== null && Math.abs(diff) > 25;
                    return (
                      <tr key={i} style={{ background: big ? "var(--amber-tint)" : undefined }}>
                        <td className="td-primary" style={{ fontVariantNumeric: "tabular-nums" }}>{r.period}</td>
                        <td>{r.region ?? "NGA"}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: prior !== undefined ? "var(--ink-3)" : "var(--ink-5)" }}>
                          {prior !== undefined ? prior.toLocaleString() : "—"}
                        </td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{r.value.toLocaleString()}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700, color: diff === null ? "var(--ink-5)" : big ? "var(--amber)" : "var(--ink-4)" }}>
                          {diff === null ? "new" : `${diff >= 0 ? "▲ +" : "▼ −"}${Math.abs(diff).toFixed(1)}%`}
                        </td>
                        <td style={{ color: "var(--ink-4)", fontSize: "var(--t-xs)" }}>{r.source ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="chart-source">
            Rows changing an existing figure by more than 25% are shaded. Approving commits the batch and writes every
            replacement to the public revision log.
          </div>

          <div style={{ padding: "0.9rem" }}>
            {pending ? (
              <ConfirmPanel
                title={pending === "approve" ? "Approve and commit this batch?" : "Reject this batch?"}
                body={pending === "approve"
                  ? `${rows.length || open.row_count || 0} figures are written to the data bank, replacements are logged old to new, and the uploader is notified.`
                  : "The batch is sent back and the uploader is emailed. Nothing is written."}
                confirmLabel={pending === "approve" ? "Approve and commit" : "Reject"}
                danger={pending === "reject"}
                busy={busy}
                onConfirm={() => decide(pending)}
                onCancel={() => setPending(null)}
              />
            ) : (
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <button className="btn btn-primary" onClick={() => setPending("approve")} disabled={busy}>Approve and commit</button>
                <button className="btn btn-secondary" onClick={() => setPending("reject")} disabled={busy} style={{ color: "var(--red)", borderColor: "var(--red)" }}>Reject</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
