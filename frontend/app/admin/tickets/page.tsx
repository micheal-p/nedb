"use client";

// ── /admin/tickets — Support queue ──────────────────────────────────────────
// Problems reported from inside the platform, carrying the page, series and
// period they were seen on. A data-quality ticket is a lead on a wrong
// published figure, so the queue treats those as the priority they are.

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getTokenFresh } from "@/lib/auth";

type Ticket = {
  id: number; reference: string | null; subject: string; category: string; priority: string;
  status: string; context_path: string | null; series_id: string | null; period: string | null;
  body: string; raised_by: string; raised_name: string | null; assigned_to: string | null;
  resolution: string | null; created_at: string; resolved_at: string | null;
};

const CAT_LABEL: Record<string, string> = {
  data_quality: "Figure looks wrong",
  upload: "Upload or validation",
  access: "Access or permissions",
  feature: "Change request",
  other: "Other",
};

const STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

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

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filter, setFilter] = useState<string>("open");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Ticket | null>(null);
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    authed(`/api/tickets?status=${filter}`)
      .then((r) => (r.ok ? r.json() : { tickets: [] }))
      .then((j) => setTickets(j.tickets ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  async function update(id: number, patch: Record<string, unknown>, note: string) {
    setBusy(true);
    const r = await authed("/api/tickets", { method: "PUT", body: JSON.stringify({ id, ...patch }) });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setMsg(j.error ?? "Update failed."); return; }
    setMsg(note); setTimeout(() => setMsg(""), 2500);
    setOpen(null);
    load();
  }

  const counts = {
    open: tickets.filter((t) => t.status === "open").length,
    high: tickets.filter((t) => t.priority === "high" && t.status !== "resolved" && t.status !== "closed").length,
    quality: tickets.filter((t) => t.category === "data_quality" && t.status !== "resolved" && t.status !== "closed").length,
  };

  return (
    <div style={{ background: "var(--surface)", minHeight: "100%", padding: "2rem" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.25rem" }}>
          <div className="eyebrow">Support</div>
          <h1 style={{ fontSize: "var(--t-xl)", fontWeight: 700, color: "var(--ink)", margin: 0 }}>Support tickets</h1>
          <p style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", marginTop: "0.35rem", maxWidth: "var(--measure)", lineHeight: 1.65 }}>
            Problems reported from inside the platform, with the page, series and period they were seen on.
            A report that a published figure looks wrong is a lead worth chasing, not a complaint to file.
          </p>
        </div>

        {msg && <div style={{ fontSize: "var(--t-base)", color: "var(--ink-2)", background: "var(--surface-muted)", border: "1px solid var(--border)", padding: "0.6rem 1rem", marginBottom: "1rem" }}>{msg}</div>}

        <div className="grid-3 grid-hair" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-cell"><div className="val" style={{ color: counts.open ? "var(--ink)" : "var(--ink-5)" }}>{counts.open}</div><div className="lbl">Open</div></div>
          <div className="stat-cell"><div className="val" style={{ color: counts.high ? "var(--red)" : "var(--ink-5)" }}>{counts.high}</div><div className="lbl">High priority</div></div>
          <div className="stat-cell"><div className="val" style={{ color: counts.quality ? "var(--amber)" : "var(--ink-5)" }}>{counts.quality}</div><div className="lbl">Data quality</div><div className="sub">May indicate a wrong published figure</div></div>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: "1rem", flexWrap: "wrap" }}>
          {["open", "in_progress", "resolved", "all"].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              style={{
                fontSize: "var(--t-sm)", fontWeight: 600, padding: "5px 12px", cursor: "pointer",
                border: `1px solid ${filter === s ? "var(--ink)" : "var(--border)"}`,
                background: filter === s ? "var(--ink)" : "var(--surface-white)",
                color: filter === s ? "#fff" : "var(--ink-3)",
                textTransform: "capitalize",
              }}>
              {s.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Queue</span>
            <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>{tickets.length} shown</span>
          </div>
          {loading ? (
            <div style={{ padding: "1.5rem", fontSize: "var(--t-base)", color: "var(--ink-5)" }}>Loading…</div>
          ) : tickets.length === 0 ? (
            <div style={{ padding: "1.5rem", fontSize: "var(--t-base)", color: "var(--ink-4)" }}>Nothing in this queue.</div>
          ) : (
            <div className="scroll-x">
              <table className="data-table">
                <thead><tr><th>Reference</th><th>Subject</th><th>Kind</th><th>Raised by</th><th>Priority</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "var(--t-xs)" }}>{t.reference ?? t.id}</td>
                      <td className="td-primary" style={{ maxWidth: 280 }}>
                        {t.subject}
                        {t.series_id && <div style={{ fontSize: "var(--t-2xs)", color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>{t.series_id}{t.period ? ` · ${t.period}` : ""}</div>}
                      </td>
                      <td style={{ fontSize: "var(--t-sm)" }}>{CAT_LABEL[t.category] ?? t.category}</td>
                      <td style={{ fontSize: "var(--t-sm)" }}>{t.raised_name || t.raised_by}</td>
                      <td>
                        {t.priority === "high"
                          ? <span className="tag tag-red">High</span>
                          : t.priority === "low" ? <span className="tag tag-muted">Low</span> : <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)" }}>Normal</span>}
                      </td>
                      <td>
                        {t.status === "open" ? <span className="tag tag-amber">Open</span>
                          : t.status === "in_progress" ? <span className="tag tag-green">In progress</span>
                          : <span className="tag tag-muted">{t.status === "resolved" ? "Resolved" : "Closed"}</span>}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button onClick={() => { setOpen(t); setResolution(t.resolution ?? ""); }}
                          style={{ background: "none", border: "none", color: "var(--green)", fontSize: "var(--t-xs)", fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {open && (
          <div className="panel" style={{ marginTop: "1.5rem" }}>
            <div className="panel-header">
              <span className="panel-title">{open.reference ?? `Ticket ${open.id}`}</span>
              <button onClick={() => setOpen(null)} style={{ background: "none", border: "none", color: "var(--ink-4)", fontSize: "var(--t-sm)", cursor: "pointer" }}>Close</button>
            </div>
            <div style={{ padding: "1.15rem" }}>
              <h2 style={{ fontSize: "var(--t-lg)", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>{open.subject}</h2>
              <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", marginBottom: "0.9rem" }}>
                {CAT_LABEL[open.category] ?? open.category} · raised by {open.raised_name || open.raised_by} on{" "}
                {new Date(open.created_at).toLocaleString("en-NG")}
                {open.context_path && <> · seen on <code style={{ fontFamily: "var(--font-mono)" }}>{open.context_path}</code></>}
              </div>

              {open.context_path && (
                <Link href={open.context_path} className="btn btn-secondary btn-sm" style={{ marginBottom: "0.9rem" }}>
                  Go to where it was seen
                </Link>
              )}

              <div style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", padding: "0.9rem 1.1rem", fontSize: "var(--t-base)", color: "var(--ink-2)", lineHeight: 1.75, whiteSpace: "pre-wrap", marginBottom: "1.1rem" }}>
                {open.body ?? ""}
              </div>

              <label style={{ display: "block", marginBottom: "0.9rem" }}>
                <span className="form-label">Resolution — what was done, or why nothing was</span>
                <textarea className="form-input" rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)}
                  placeholder="Confirmed a decimal shift on the June ingest. Corrected via a superseding commit; the revision log shows old and new."
                  style={{ resize: "vertical" }} />
              </label>

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {STATUSES.filter((s) => s !== open.status).map((s) => (
                  <button key={s} onClick={() => update(open.id, { status: s, resolution }, `Ticket marked ${s.replace("_", " ")}.`)}
                    disabled={busy} className={`btn btn-sm ${s === "resolved" ? "btn-primary" : "btn-secondary"}`}>
                    Mark {s.replace("_", " ")}
                  </button>
                ))}
                <button onClick={() => update(open.id, { priority: open.priority === "high" ? "normal" : "high", resolution }, "Priority updated.")}
                  disabled={busy} className="btn btn-secondary btn-sm">
                  {open.priority === "high" ? "Lower priority" : "Raise to high"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
