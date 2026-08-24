"use client";

// ── /admin/newsroom — Stories and editorial broadcast ───────────────────────
// The statistics publish themselves; the analysis does not. This is where an
// editor writes a short signed piece explaining what moved and why, an
// administrator publishes it, and the result is broadcast to subscribers.
//
// Maker-checker throughout: editors draft and edit, admins publish and send.

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getTokenFresh, getRole, isAdminRole } from "@/lib/auth";
import { ConfirmPanel } from "@/components/ui/gov";
import { SECTOR_LABEL } from "@/lib/bulletin-shared";

type Story = {
  id: number; slug: string; title: string; standfirst: string | null; body?: string;
  sector: string | null; status: "draft" | "published"; author: string | null;
  published_at: string | null; created_at: string; created_by: string | null;
};

type Broadcast = {
  id: number; subject: string; topics: string[]; recipients: number;
  delivered: number; failed: number; sent_by: string | null; sent_at: string;
};

const SECTORS = Object.keys(SECTOR_LABEL);

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

export default function NewsroomPage() {
  const [tab, setTab] = useState<"stories" | "broadcast">("stories");
  const [stories, setStories] = useState<Story[]>([]);
  const [open, setOpen] = useState<Story | null>(null);
  const [draft, setDraft] = useState({ title: "", standfirst: "", body: "", sector: "", author: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const canPublish = isAdminRole(getRole());

  // Broadcast state
  const [bSubject, setBSubject] = useState("");
  const [bBody, setBBody] = useState("");
  const [bTopics, setBTopics] = useState<string[]>([]);
  const [audience, setAudience] = useState<{ audience_size: number; total_active: number } | null>(null);
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);

  const loadStories = useCallback(() => {
    authed("/api/bulletin/stories?all=1").then((r) => (r.ok ? r.json() : [])).then(setStories).catch(() => {});
  }, []);

  const loadAudience = useCallback((topics: string[]) => {
    authed(`/api/admin/broadcast?topics=${encodeURIComponent(topics.join(","))}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) { setAudience(j); setHistory(j.history ?? []); } })
      .catch(() => {});
  }, []);

  useEffect(() => { loadStories(); }, [loadStories]);
  useEffect(() => { if (tab === "broadcast") loadAudience(bTopics); }, [tab, bTopics, loadAudience]);

  async function createDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    setBusy(true);
    const r = await authed("/api/bulletin/stories", { method: "POST", body: JSON.stringify(draft) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error ?? "Could not create the draft."); return; }
    setDraft({ title: "", standfirst: "", body: "", sector: "", author: "" });
    setMsg(`Draft "${j.title}" created.`);
    loadStories();
  }

  async function openStory(s: Story) {
    const r = await authed(`/api/bulletin/stories/${s.id}`);
    if (r.ok) { setOpen(await r.json()); setConfirmPublish(false); setMsg(""); }
  }

  async function saveStory() {
    if (!open) return;
    setBusy(true);
    const r = await authed(`/api/bulletin/stories/${open.id}`, {
      method: "PUT",
      body: JSON.stringify({ title: open.title, standfirst: open.standfirst, body: open.body, sector: open.sector, author: open.author }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? "Saved." : (j.error ?? "Save failed."));
    if (r.ok) loadStories();
  }

  async function setPublished(action: "publish" | "withdraw") {
    if (!open) return;
    setBusy(true);
    const r = await authed(`/api/bulletin/stories/${open.id}`, { method: "PUT", body: JSON.stringify({ action }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false); setConfirmPublish(false);
    if (!r.ok) { setMsg(j.error ?? "Failed."); return; }
    setMsg(action === "publish" ? "Story published." : "Story withdrawn to draft.");
    loadStories(); openStory(open);
  }

  function prefillFromStory(s: Story) {
    setTab("broadcast");
    setBSubject(s.title);
    setBBody(`${s.standfirst ?? ""}\n\nRead the full piece: https://nedb.vercel.app/bulletin/stories/${s.slug}`.trim());
    if (s.sector) setBTopics([s.sector]);
  }

  async function send() {
    setSending(true);
    const r = await authed("/api/admin/broadcast", { method: "POST", body: JSON.stringify({ subject: bSubject, body: bBody, topics: bTopics }) });
    const j = await r.json().catch(() => ({}));
    setSending(false); setConfirmSend(false);
    setMsg(r.ok ? j.message : (j.error ?? "Send failed."));
    if (r.ok) { setBSubject(""); setBBody(""); loadAudience(bTopics); }
  }

  const drafts = stories.filter((s) => s.status === "draft");
  const live   = stories.filter((s) => s.status === "published");

  return (
    <div style={{ background: "var(--surface)", minHeight: "100%", padding: "2rem" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.25rem" }}>Publications</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>Newsroom</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--ink-4)", marginTop: "0.35rem", maxWidth: 660, lineHeight: 1.6 }}>
            Short signed analysis to sit alongside the statistics, and the editorial broadcast that puts it in
            subscribers&apos; inboxes. Editors draft; an administrator publishes and sends.
          </p>
        </div>

        <div className="admin-tab-bar" style={{ marginBottom: "1.25rem" }}>
          {(["stories", "broadcast"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "0.6rem 1.1rem", background: "none", border: "none", borderBottom: `2px solid ${tab === t ? "var(--green)" : "transparent"}`, color: tab === t ? "var(--ink)" : "var(--ink-4)", fontWeight: tab === t ? 700 : 500, fontSize: "0.84rem", cursor: "pointer", textTransform: "capitalize" }}>
              {t === "stories" ? `Stories (${stories.length})` : "Broadcast"}
            </button>
          ))}
        </div>

        {msg && <div style={{ fontSize: "0.8rem", color: "var(--ink-2)", background: "var(--surface-muted)", border: "1px solid var(--border)", padding: "0.55rem 0.9rem", marginBottom: "1rem" }}>{msg}</div>}

        {tab === "stories" && !open && (
          <>
            <div className="panel" style={{ marginBottom: "1.5rem" }}>
              <div className="panel-header"><span className="panel-title">New story</span></div>
              <form onSubmit={createDraft} style={{ padding: "1rem 1.25rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                  <label style={{ gridColumn: "1 / -1" }}>
                    <span className="form-label">Headline</span>
                    <input className="form-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Gas output steadies as flaring penalties bite" required />
                  </label>
                  <label>
                    <span className="form-label">Sector</span>
                    <select className="form-input form-select" value={draft.sector} onChange={(e) => setDraft({ ...draft, sector: e.target.value })}>
                      <option value="">Not sector-specific</option>
                      {SECTORS.map((s) => <option key={s} value={s}>{SECTOR_LABEL[s]}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="form-label">Byline</span>
                    <input className="form-input" value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} placeholder="NEDB Analysis Unit" />
                  </label>
                </div>
                <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: "0.875rem" }}>
                  {busy ? "Creating…" : "Create draft"}
                </button>
              </form>
            </div>

            {[{ label: "Drafts", rows: drafts }, { label: "Published", rows: live }].map((grp) => (
              <div key={grp.label} className="panel" style={{ marginBottom: "1.25rem" }}>
                <div className="panel-header">
                  <span className="panel-title">{grp.label}</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>{grp.rows.length}</span>
                </div>
                {grp.rows.length === 0 ? (
                  <div style={{ padding: "1.1rem 1.25rem", fontSize: "0.8rem", color: "var(--ink-4)" }}>
                    {grp.label === "Drafts" ? "No drafts in progress." : "Nothing published yet."}
                  </div>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>Headline</th><th>Sector</th><th>Byline</th><th>Date</th><th /></tr></thead>
                    <tbody>
                      {grp.rows.map((s) => (
                        <tr key={s.id}>
                          <td className="td-primary">{s.title}</td>
                          <td style={{ fontSize: "0.75rem", color: "var(--ink-4)" }}>{s.sector ? SECTOR_LABEL[s.sector] ?? s.sector : "—"}</td>
                          <td style={{ fontSize: "0.75rem", color: "var(--ink-4)" }}>{s.author ?? "—"}</td>
                          <td style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>{new Date(s.published_at ?? s.created_at).toLocaleDateString("en-NG")}</td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <button onClick={() => openStory(s)} style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--green)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
                              {s.status === "draft" ? "Edit" : "Open"}
                            </button>
                            {s.status === "published" && (
                              <>
                                <Link href={`/bulletin/stories/${s.slug}`} style={{ marginLeft: 10, fontSize: "0.72rem", fontWeight: 700, color: "var(--ink-4)", textDecoration: "underline", textUnderlineOffset: 2 }}>View</Link>
                                {canPublish && (
                                  <button onClick={() => prefillFromStory(s)} style={{ marginLeft: 10, fontSize: "0.72rem", fontWeight: 700, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
                                    Broadcast
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </>
        )}

        {/* ── Story editor ── */}
        {tab === "stories" && open && (
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">{open.status === "published" ? "Published story" : "Draft"}</span>
              <button onClick={() => { setOpen(null); setMsg(""); }} style={{ fontSize: "0.74rem", color: "var(--ink-4)", background: "none", border: "none", cursor: "pointer" }}>← Back to list</button>
            </div>
            <div style={{ padding: "1.25rem" }}>
              {open.status === "published" && (
                <div style={{ fontSize: "0.78rem", color: "var(--ink-3)", background: "var(--surface-muted)", border: "1px solid var(--border)", padding: "0.6rem 0.9rem", marginBottom: "1rem", lineHeight: 1.6 }}>
                  This story is live at <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.74rem" }}>/bulletin/stories/{open.slug}</code>. Withdraw it to a draft before editing — readers already hold that link.
                </div>
              )}
              <label style={{ display: "block", marginBottom: "0.75rem" }}>
                <span className="form-label">Headline</span>
                <input className="form-input" value={open.title} disabled={open.status === "published"}
                  onChange={(e) => setOpen({ ...open, title: e.target.value })} />
              </label>
              <label style={{ display: "block", marginBottom: "0.75rem" }}>
                <span className="form-label">Standfirst — one sentence, shown in listings and email</span>
                <input className="form-input" value={open.standfirst ?? ""} disabled={open.status === "published"}
                  onChange={(e) => setOpen({ ...open, standfirst: e.target.value })} />
              </label>
              <label style={{ display: "block", marginBottom: "0.75rem" }}>
                <span className="form-label">Body</span>
                <textarea className="form-input" rows={12} value={open.body ?? ""} disabled={open.status === "published"}
                  onChange={(e) => setOpen({ ...open, body: e.target.value })}
                  placeholder="Blank line between paragraphs."
                  style={{ resize: "vertical", lineHeight: 1.7 }} />
              </label>
              <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", alignItems: "center" }}>
                {open.status === "draft" && <button onClick={saveStory} className="btn btn-secondary" disabled={busy}>{busy ? "Saving…" : "Save draft"}</button>}
                {canPublish && open.status === "draft" && !confirmPublish && (
                  <button onClick={() => setConfirmPublish(true)} className="btn btn-primary">Publish story…</button>
                )}
                {canPublish && open.status === "published" && (
                  <button onClick={() => setPublished("withdraw")} className="btn btn-secondary" disabled={busy}>Withdraw to draft</button>
                )}
                {!canPublish && open.status === "draft" && (
                  <span style={{ fontSize: "0.75rem", color: "var(--ink-5)" }}>An administrator publishes this story after review.</span>
                )}
              </div>
              {confirmPublish && (
                <ConfirmPanel
                  title={`Publish "${open.title}"?`}
                  body="The story becomes publicly readable immediately at its permanent URL, and can be broadcast to subscribers. You can withdraw it to a draft afterwards, but anyone who already has the link will have read it."
                  confirmLabel="Publish"
                  busy={busy}
                  onConfirm={() => setPublished("publish")}
                  onCancel={() => setConfirmPublish(false)}
                />
              )}
            </div>
          </div>
        )}

        {/* ── Broadcast ── */}
        {tab === "broadcast" && (
          <>
            <div className="panel" style={{ marginBottom: "1.5rem" }}>
              <div className="panel-header">
                <span className="panel-title">Compose broadcast</span>
                {audience && (
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--green-deep)" }}>
                    {audience.audience_size} of {audience.total_active} active subscribers will receive this
                  </span>
                )}
              </div>
              <div style={{ padding: "1.1rem 1.25rem" }}>
                <label style={{ display: "block", marginBottom: "0.75rem" }}>
                  <span className="form-label">Subject</span>
                  <input className="form-input" value={bSubject} onChange={(e) => setBSubject(e.target.value)} placeholder="August 2026 Energy Bulletin is out" />
                </label>
                <div style={{ marginBottom: "0.75rem" }}>
                  <span className="form-label">Topics — leave empty to reach everyone</span>
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: 4 }}>
                    {SECTORS.map((s) => (
                      <label key={s} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.76rem", color: "var(--ink-2)", cursor: "pointer" }}>
                        <input type="checkbox" checked={bTopics.includes(s)} style={{ accentColor: "var(--green)" }}
                          onChange={() => setBTopics((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])} />
                        {SECTOR_LABEL[s]}
                      </label>
                    ))}
                  </div>
                </div>
                <label style={{ display: "block", marginBottom: "0.9rem" }}>
                  <span className="form-label">Message</span>
                  <textarea className="form-input" rows={9} value={bBody} onChange={(e) => setBBody(e.target.value)}
                    placeholder="Blank line between paragraphs. Subscribers get an unsubscribe link automatically."
                    style={{ resize: "vertical", lineHeight: 1.7 }} />
                </label>
                {!confirmSend ? (
                  <button onClick={() => setConfirmSend(true)} className="btn btn-primary"
                    disabled={!canPublish || !bSubject.trim() || !bBody.trim()}>
                    {canPublish ? "Send broadcast…" : "Administrators send broadcasts"}
                  </button>
                ) : (
                  <ConfirmPanel
                    title={`Send "${bSubject}" to ${audience?.audience_size ?? 0} subscribers?`}
                    body="This leaves the building immediately and cannot be recalled. Every recipient gets an unsubscribe link, and the send is recorded with delivery counts."
                    confirmLabel="Send now"
                    busy={sending}
                    onConfirm={send}
                    onCancel={() => setConfirmSend(false)}
                  />
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><span className="panel-title">Recent broadcasts</span></div>
              {history.length === 0 ? (
                <div style={{ padding: "1.1rem 1.25rem", fontSize: "0.8rem", color: "var(--ink-4)" }}>Nothing sent yet.</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Subject</th><th>Topics</th><th style={{ textAlign: "right" }}>Delivered</th><th style={{ textAlign: "right" }}>Failed</th><th>Sent</th></tr></thead>
                  <tbody>
                    {history.map((b) => (
                      <tr key={b.id}>
                        <td className="td-primary">{b.subject}</td>
                        <td style={{ fontSize: "0.74rem", color: "var(--ink-4)" }}>{b.topics?.length ? b.topics.map((t) => SECTOR_LABEL[t] ?? t).join(", ") : "All"}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.delivered}/{b.recipients}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: b.failed ? "var(--red)" : "var(--ink-5)" }}>{b.failed}</td>
                        <td style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>{new Date(b.sent_at).toLocaleDateString("en-NG")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
