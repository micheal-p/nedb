"use client";

// ── /admin/access — Access provisioning pipeline ────────────────────────────
// A request is always at exactly one stage, every move is recorded with who
// made it, and the applicant can be told truthfully where theirs has reached.
// Approving does not create an account: provisioning does, as a separate and
// deliberate act.

import { useState, useEffect, useCallback } from "react";
import { getTokenFresh } from "@/lib/auth";
import { ConfirmPanel } from "@/components/ui/gov";
import { STAGES, MAIN_PATH, NEXT, stageMeta, stageIndex, type Stage } from "@/lib/access-pipeline";
import { PROFILE_MAP, mandateLabel } from "@/lib/dashboard-profiles";

type Req = {
  id: number; full_name: string; email: string; organisation: string; position: string | null;
  profile_key: string; justification: string | null; created_at: string;
  stage: Stage; assigned_to: string | null; decision_note: string | null;
  granted_profile: string | null; can_export: boolean; expires_at: string | null;
  provisioned_username: string | null;
};

type Event = { from_stage: string | null; to_stage: string; note: string | null; actor: string | null; created_at: string };

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

export default function AccessPipelinePage() {
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Req | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [note, setNote] = useState("");
  const [profile, setProfile] = useState("");
  const [canExport, setCanExport] = useState(false);
  const [expires, setExpires] = useState("");
  const [pending, setPending] = useState<Stage | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null);

  const load = useCallback(() => {
    authed("/api/access-requests?status=all")
      .then((r) => (r.ok ? r.json() : []))
      .then((j) => setRows(Array.isArray(j) ? j : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function openReq(r: Req) {
    setOpen(r); setNote(""); setPending(null); setIssued(null); setMsg("");
    setProfile(r.granted_profile ?? r.profile_key);
    setCanExport(!!r.can_export);
    setExpires(r.expires_at ? String(r.expires_at).slice(0, 10) : "");
    const res = await authed(`/api/access-requests/${r.id}/stage`);
    if (res.ok) { const j = await res.json(); setEvents(j.events ?? []); setOpen(j.request); }
  }

  async function move(to: Stage) {
    if (!open) return;
    setBusy(true); setMsg("");
    const res = await authed(`/api/access-requests/${open.id}/stage`, {
      method: "PUT",
      body: JSON.stringify({
        stage: to, note: note.trim() || undefined,
        granted_profile: profile || undefined,
        can_export: canExport,
        expires_at: expires || undefined,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false); setPending(null);
    if (!res.ok) { setMsg(j.error ?? "Could not move the request."); return; }
    if (j.issued) setIssued(j.issued);
    setNote("");
    setMsg(`Moved to ${stageMeta(to).label}.`);
    load();
    openReq({ ...open, stage: to });
  }

  const counts = STAGES.map((s) => ({ ...s, n: rows.filter((r) => (r.stage ?? "submitted") === s.id).length }));
  const active = counts.filter((c) => MAIN_PATH.includes(c.id) && c.id !== "active");

  return (
    <div style={{ background: "var(--surface)", minHeight: "100%", padding: "2rem" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.25rem" }}>
          <div className="eyebrow">Access</div>
          <h1 style={{ fontSize: "var(--t-xl)", fontWeight: 700, color: "var(--ink)", margin: 0 }}>Access pipeline</h1>
          <p style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", marginTop: "0.35rem", maxWidth: "var(--measure)", lineHeight: 1.65 }}>
            Requests for a dashboard move through explicit stages. Approving records a decision; provisioning creates the
            account and issues the credentials. Both are logged with who did them.
          </p>
        </div>

        {msg && <div style={{ fontSize: "var(--t-base)", color: "var(--ink-2)", background: "var(--surface-muted)", border: "1px solid var(--border)", padding: "0.6rem 1rem", marginBottom: "1rem" }}>{msg}</div>}

        {/* Pipeline counts */}
        <div className="grid-auto grid-hair" style={{ marginBottom: "1.5rem" }}>
          {active.map((s) => (
            <div key={s.id} className="stat-cell">
              <div className="val" style={{ color: s.n ? "var(--ink)" : "var(--ink-5)" }}>{s.n}</div>
              <div className="lbl">{s.label}</div>
              <div className="sub">{s.blurb}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "2rem", color: "var(--ink-5)", fontSize: "var(--t-base)" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div className="panel"><div style={{ padding: "1.5rem", fontSize: "var(--t-base)", color: "var(--ink-4)" }}>No access requests yet.</div></div>
        ) : (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">All requests</span>
              <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>{rows.length} total</span>
            </div>
            <div className="scroll-x">
              <table className="data-table">
                <thead><tr><th>Applicant</th><th>Organisation</th><th>Dashboard</th><th>Stage</th><th style={{ textAlign: "right" }}>Submitted</th><th /></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const st = stageMeta(r.stage ?? "submitted");
                    const idx = stageIndex(r.stage ?? "submitted");
                    const tone = st.tone === "good" ? "var(--green)" : st.tone === "bad" ? "var(--red)" : "var(--amber)";
                    return (
                      <tr key={r.id}>
                        <td className="td-primary">
                          {r.full_name}
                          <div style={{ fontSize: "var(--t-2xs)", color: "var(--ink-5)" }}>{r.email}</div>
                        </td>
                        <td style={{ fontSize: "var(--t-sm)" }}>{r.organisation}</td>
                        <td style={{ fontSize: "var(--t-sm)" }}>{PROFILE_MAP[r.granted_profile ?? r.profile_key]?.label ?? r.profile_key}</td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: "var(--t-2xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: tone, border: `1px solid ${tone}`, padding: "1px 6px" }}>{st.label}</span>
                            {idx >= 0 && (
                              <span style={{ display: "inline-flex", gap: 2 }}>
                                {MAIN_PATH.map((_, i) => (
                                  <span key={i} style={{ width: 12, height: 3, background: i <= idx ? tone : "var(--border)" }} />
                                ))}
                              </span>
                            )}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontSize: "var(--t-xs)", color: "var(--ink-4)" }}>{new Date(r.created_at).toLocaleDateString("en-NG")}</td>
                        <td style={{ textAlign: "right" }}>
                          <button onClick={() => openReq(r)} style={{ background: "none", border: "none", color: "var(--green)", fontSize: "var(--t-xs)", fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>Open</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detail */}
        {open && (
          <div className="panel" style={{ marginTop: "1.5rem" }}>
            <div className="panel-header">
              <span className="panel-title">{open.full_name} — {open.organisation}</span>
              <button onClick={() => setOpen(null)} style={{ background: "none", border: "none", color: "var(--ink-4)", fontSize: "var(--t-sm)", cursor: "pointer" }}>Close</button>
            </div>
            <div style={{ padding: "1.15rem" }}>

              {issued && (
                <div style={{ background: "var(--green-tint)", border: "1px solid var(--green)", padding: "0.9rem 1.1rem", marginBottom: "1rem" }}>
                  <div style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--green-deep)", marginBottom: 4 }}>Account created and credentials emailed</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--t-base)", color: "var(--ink)" }}>
                    {issued.username} · {issued.password}
                  </div>
                  <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", marginTop: 4 }}>
                    Shown once. The applicant has been emailed the same details.
                  </div>
                </div>
              )}

              <div className="grid-2" style={{ gap: "1.25rem", marginBottom: "1.15rem" }}>
                <div>
                  <div className="eyebrow">Request</div>
                  <div style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.7 }}>
                    <div><strong style={{ color: "var(--ink)" }}>Position:</strong> {open.position ?? "not given"}</div>
                    <div><strong style={{ color: "var(--ink)" }}>Email:</strong> {open.email}{open.email.endsWith(".gov.ng") && <span className="tag tag-green" style={{ marginLeft: 6 }}>OFFICIAL</span>}</div>
                    <div style={{ marginTop: 6 }}><strong style={{ color: "var(--ink)" }}>Justification:</strong></div>
                    <div style={{ background: "var(--surface-muted)", borderLeft: "2px solid var(--border-strong)", padding: "0.6rem 0.8rem", marginTop: 4, fontSize: "var(--t-sm)" }}>
                      {open.justification || "None supplied."}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="eyebrow">Grant</div>
                  <label style={{ display: "block", marginBottom: "0.6rem" }}>
                    <span className="form-label">Dashboard profile</span>
                    <select className="form-input form-select" value={profile} onChange={(e) => setProfile(e.target.value)}>
                      {Object.entries(PROFILE_MAP).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                    </select>
                    {PROFILE_MAP[profile] && (
                      <span style={{ display: "block", fontSize: "var(--t-xs)", color: "var(--ink-4)", marginTop: 4 }}>
                        Scope: <strong style={{ color: "var(--green-deep)" }}>{mandateLabel(PROFILE_MAP[profile])}</strong>
                      </span>
                    )}
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: "var(--t-sm)", color: "var(--ink-2)", marginBottom: "0.6rem" }}>
                    <input type="checkbox" checked={canExport} onChange={(e) => setCanExport(e.target.checked)} style={{ accentColor: "var(--green)" }} />
                    Include data export
                  </label>
                  <label style={{ display: "block" }}>
                    <span className="form-label">Access expires (recommended)</span>
                    <input className="form-input" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
                    <span style={{ display: "block", fontSize: "var(--t-xs)", color: "var(--ink-4)", marginTop: 4 }}>
                      A grant with no expiry is a grant nobody revisits.
                    </span>
                  </label>
                </div>
              </div>

              {/* Move */}
              <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: "0.9rem" }}>
                <div className="eyebrow">Move this request</div>
                <label style={{ display: "block", marginBottom: "0.7rem" }}>
                  <span className="form-label">Note (recorded against the move)</span>
                  <input className="form-input" value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="Verified against the NERC staff directory." />
                </label>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {(NEXT[(open.stage ?? "submitted") as Stage] ?? []).map((to) => {
                    const meta = stageMeta(to);
                    const danger = meta.tone === "bad";
                    return (
                      <button key={to} onClick={() => setPending(to)} disabled={busy}
                        className={`btn btn-sm ${danger ? "btn-secondary" : "btn-primary"}`}
                        style={danger ? { color: "var(--red)", borderColor: "var(--red)" } : undefined}>
                        {to === "provisioned" ? "Provision account" : `Move to ${meta.label}`}
                      </button>
                    );
                  })}
                </div>

                {pending && (
                  <ConfirmPanel
                    title={pending === "provisioned"
                      ? `Create an account for ${open.full_name}?`
                      : `Move to ${stageMeta(pending).label}?`}
                    body={pending === "provisioned"
                      ? `This creates a live account on the ${PROFILE_MAP[profile]?.label ?? profile} dashboard${canExport ? " with export" : ""}, generates a password and emails the credentials to ${open.email}. The password is shown to you once and never stored in readable form.`
                      : pending === "rejected"
                        ? "The applicant will be told their request was not approved. Your note is kept on file as the reason."
                        : `${stageMeta(pending).blurb}. The move is recorded against your name.`}
                    confirmLabel={pending === "provisioned" ? "Create account and send credentials" : `Move to ${stageMeta(pending).label}`}
                    danger={stageMeta(pending).tone === "bad"}
                    busy={busy}
                    onConfirm={() => move(pending)}
                    onCancel={() => setPending(null)}
                  />
                )}
              </div>

              {/* History */}
              {events.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border-soft)", marginTop: "1rem", paddingTop: "0.9rem" }}>
                  <div className="eyebrow">History</div>
                  <table className="data-table" style={{ fontSize: "var(--t-sm)" }}>
                    <thead><tr><th>Move</th><th>Note</th><th>By</th><th style={{ textAlign: "right" }}>When</th></tr></thead>
                    <tbody>
                      {events.map((e, i) => (
                        <tr key={i}>
                          <td className="td-primary">{e.from_stage ? `${stageMeta(e.from_stage).label} → ` : ""}{stageMeta(e.to_stage).label}</td>
                          <td style={{ color: "var(--ink-4)" }}>{e.note ?? "—"}</td>
                          <td style={{ fontSize: "var(--t-xs)" }}>{e.actor ?? "—"}</td>
                          <td style={{ textAlign: "right", fontSize: "var(--t-xs)", color: "var(--ink-4)" }}>{new Date(e.created_at).toLocaleString("en-NG")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
