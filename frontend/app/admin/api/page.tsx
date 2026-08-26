"use client";

// ── /admin/api — Public API control plane ───────────────────────────────────
// What the public API serves is an administrative decision made here, not a
// property of the database. Publishing a series exposes it; withdrawing it
// removes it from the catalogue immediately. The field list is the exact
// projection the API returns, so internal columns can never leak by default.
//
// API keys live here too: a key raises a caller's rate limit and is metered,
// it never widens what that caller can see.

import { useState, useEffect, useCallback } from "react";
import { getTokenFresh } from "@/lib/auth";
import { ConfirmPanel } from "@/components/ui/gov";
import { SECTOR_LABEL } from "@/lib/bulletin-shared";

type SeriesRow = {
  id: string; name: string; sector: string; unit_default: string; frequency: string;
  is_public: boolean; public_fields: string[] | null; public_note: string | null; record_count: number;
};

type ApiKey = {
  id: number; label: string; owner: string | null;
  // The secret is never returned after issue. The prefix and last four are not
  // secret and are what let an administrator recognise a key in this list.
  key_prefix?: string | null; last_four?: string | null;
  is_active: boolean; created_at: string; last_used: string | null;
  rate_limit?: number; call_count?: number;
};

async function authed(url: string, init?: RequestInit) {
  const token = await getTokenFresh();
  return fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

export default function AdminApiPage() {
  const [series, setSeries]   = useState<SeriesRow[]>([]);
  const [fields, setFields]   = useState<string[]>([]);
  const [keys, setKeys]       = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState<string | null>(null);
  const [msg, setMsg]         = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<SeriesRow | null>(null);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyOwner, setNewKeyOwner] = useState("");
  const [issuedKey, setIssuedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      authed("/api/admin/api-exposure").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      authed("/api/admin/apikeys").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    if (a) { setSeries(a.series ?? []); setFields(a.exposable_fields ?? []); }
    if (b) setKeys(Array.isArray(b) ? b : (b.keys ?? []));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function update(id: string, patch: Record<string, unknown>, note: string) {
    setBusy(id); setMsg("");
    const r = await authed("/api/admin/api-exposure", { method: "PUT", body: JSON.stringify({ id, ...patch }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setMsg(j.error ?? "Update failed."); return; }
    setMsg(note);
    setTimeout(() => setMsg(""), 2500);
    load();
  }

  async function issueKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyLabel.trim()) return;
    const r = await authed("/api/admin/apikeys", { method: "POST", body: JSON.stringify({ label: newKeyLabel.trim(), owner: newKeyOwner.trim() || null }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error ?? "Could not issue key."); return; }
    setIssuedKey(j.key ?? j.data?.key ?? null);
    setNewKeyLabel(""); setNewKeyOwner("");
    load();
  }

  async function toggleKey(k: ApiKey) {
    await authed("/api/admin/apikeys", { method: "PUT", body: JSON.stringify({ id: k.id, is_active: !k.is_active }) });
    load();
  }

  const published = series.filter((s) => s.is_public);
  const withheld  = series.filter((s) => !s.is_public);

  const Row = ({ s }: { s: SeriesRow }) => {
    const active = publicFieldsOf(s);
    const open = expanded === s.id;
    return (
      <div style={{ borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 1rem", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--ink)" }}>{s.name}</div>
            <div style={{ fontSize: "0.68rem", color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>
              {s.id} · {SECTOR_LABEL[s.sector] ?? s.sector} · {s.record_count.toLocaleString()} records
            </div>
          </div>
          <button onClick={() => setExpanded(open ? null : s.id)}
            style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--ink-3)", background: "none", border: "1px solid var(--border)", borderRadius: 2, padding: "3px 9px", cursor: "pointer" }}>
            {active.length} field{active.length === 1 ? "" : "s"} {open ? "▲" : "▼"}
          </button>
          {s.is_public ? (
            <button onClick={() => setWithdrawing(s)} disabled={busy === s.id}
              style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--red)", background: "var(--surface-white)", border: "1px solid var(--red)", borderRadius: 2, padding: "4px 12px", cursor: "pointer" }}>
              Withdraw
            </button>
          ) : (
            <button onClick={() => update(s.id, { is_public: true }, `${s.name} published to the public API.`)} disabled={busy === s.id}
              style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff", background: "var(--green)", border: "none", borderRadius: 2, padding: "5px 13px", cursor: "pointer" }}>
              {busy === s.id ? "Working…" : "Publish"}
            </button>
          )}
        </div>
        {open && (
          <div style={{ padding: "0 1rem 0.9rem", background: "var(--surface-muted)" }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-4)", padding: "0.6rem 0 0.4rem" }}>
              Fields returned by the API
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {fields.map((f) => {
                const on = active.includes(f);
                const locked = f === "period" || f === "value";
                return (
                  <label key={f} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "0.74rem", color: locked ? "var(--ink-4)" : "var(--ink-2)", cursor: locked ? "default" : "pointer" }}>
                    <input type="checkbox" checked={on} disabled={locked}
                      onChange={() => update(s.id, { public_fields: on ? active.filter((x) => x !== f) : [...active, f] }, "Field list updated.")}
                      style={{ accentColor: "var(--green)" }} />
                    <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{f}</code>
                    {locked && <span style={{ fontSize: "0.62rem", color: "var(--ink-5)" }}>(required)</span>}
                  </label>
                );
              })}
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <label style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-4)", display: "block", marginBottom: 4 }}>
                Caveat shown with this series (optional)
              </label>
              <input className="form-input" defaultValue={s.public_note ?? ""}
                placeholder="e.g. Provisional — revised quarterly as agency returns are confirmed"
                onBlur={(e) => { if (e.target.value !== (s.public_note ?? "")) update(s.id, { public_note: e.target.value }, "Caveat saved."); }} />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ background: "var(--surface)", minHeight: "100%", padding: "2rem" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.25rem" }}>Distribution</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>Public API</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--ink-4)", marginTop: "0.35rem", maxWidth: 680, lineHeight: 1.6 }}>
            Nothing reaches the public API until it is published here. Publishing exposes a series in the catalogue and serves
            its records; the field list is the exact projection callers receive, so internal columns never travel.
            Withdrawing takes effect immediately.
          </p>
        </div>

        {msg && <div style={{ fontSize: "0.78rem", color: "var(--green-deep)", background: "var(--green-tint)", border: "1px solid var(--green-line)", padding: "0.5rem 0.9rem", marginBottom: "1rem" }}>{msg}</div>}

        {withdrawing && (
          <ConfirmPanel
            title={`Withdraw ${withdrawing.name} from the public API?`}
            body="The series disappears from the public catalogue and its endpoints start returning 404 immediately. Anyone consuming it programmatically will break. Published bulletins already citing it are unaffected."
            confirmLabel="Withdraw from public API"
            danger
            busy={busy === withdrawing.id}
            onConfirm={() => { const s = withdrawing; setWithdrawing(null); update(s.id, { is_public: false }, `${s.name} withdrawn from the public API.`); }}
            onCancel={() => setWithdrawing(null)}
          />
        )}

        {loading ? (
          <div style={{ padding: "2rem", fontSize: "0.82rem", color: "var(--ink-5)" }}>Loading…</div>
        ) : (
          <>
            <div className="panel" style={{ marginBottom: "1.5rem" }}>
              <div className="panel-header">
                <span className="panel-title">Published — served publicly</span>
                <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>{published.length} series</span>
              </div>
              {published.length === 0
                ? <div style={{ padding: "1.25rem", fontSize: "0.8rem", color: "var(--ink-4)" }}>Nothing is published. The public API currently serves an empty catalogue.</div>
                : published.map((s) => <Row key={s.id} s={s} />)}
            </div>

            <div className="panel" style={{ marginBottom: "1.5rem" }}>
              <div className="panel-header">
                <span className="panel-title">Withheld — internal only</span>
                <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>{withheld.length} series</span>
              </div>
              {withheld.length === 0
                ? <div style={{ padding: "1.25rem", fontSize: "0.8rem", color: "var(--ink-4)" }}>Every registered series is published.</div>
                : withheld.map((s) => <Row key={s.id} s={s} />)}
            </div>

            {/* ── API keys ── */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">API Keys</span>
                <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>A key raises the caller&apos;s rate limit; it never widens what they can see</span>
              </div>
              <div style={{ padding: "1rem 1.25rem" }}>
                <form onSubmit={issueKey} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "1rem" }}>
                  <label style={{ flex: "1 1 200px" }}>
                    <span className="form-label">Label</span>
                    <input className="form-input" value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)} placeholder="University of Lagos — research" required />
                  </label>
                  <label style={{ flex: "1 1 180px" }}>
                    <span className="form-label">Owner (optional)</span>
                    <input className="form-input" value={newKeyOwner} onChange={(e) => setNewKeyOwner(e.target.value)} placeholder="a.bello@unilag.edu.ng" />
                  </label>
                  <button type="submit" className="btn btn-primary">Issue Key</button>
                </form>

                {issuedKey && (
                  <div style={{ background: "var(--green-tint)", border: "1px solid var(--green-line)", padding: "0.75rem 1rem", marginBottom: "1rem" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--green-deep)", marginBottom: 4 }}>Key issued — copy it now</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--ink-3)", lineHeight: 1.55, marginBottom: 6 }}>
                      This is the only time it will be shown. Only a hash is stored, so nobody, including an administrator,
                      can retrieve it later. If it is lost, revoke it and issue another.
                    </div>
                    <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", wordBreak: "break-all" }}>{issuedKey}</code>
                    <div style={{ marginTop: 6 }}>
                      <button onClick={() => { navigator.clipboard.writeText(issuedKey); setIssuedKey(null); }}
                        style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--green)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
                        Copy and dismiss
                      </button>
                    </div>
                  </div>
                )}

                {keys.length === 0 ? (
                  <div style={{ fontSize: "0.8rem", color: "var(--ink-4)" }}>No keys issued.</div>
                ) : (
                  <table className="data-table">
                    <thead><tr><th>Label</th><th>Owner</th><th style={{ textAlign: "right" }}>Calls</th><th>Last used</th><th>Status</th><th /></tr></thead>
                    <tbody>
                      {keys.map((k) => (
                        <tr key={k.id}>
                          <td className="td-primary">
                            {k.label}
                            {k.key_prefix && (
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--ink-5)", marginTop: 2 }}>
                                {k.key_prefix}…{k.last_four ?? ""}
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: "0.75rem", color: "var(--ink-4)" }}>{k.owner ?? "—"}</td>
                          <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "0.75rem" }}>{(k.call_count ?? 0).toLocaleString()}</td>
                          <td style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>{k.last_used ? new Date(k.last_used).toLocaleDateString("en-NG") : "never"}</td>
                          <td>{k.is_active ? <span className="tag tag-green">Active</span> : <span className="tag tag-muted">Revoked</span>}</td>
                          <td style={{ textAlign: "right" }}>
                            <button onClick={() => toggleKey(k)}
                              style={{ fontSize: "0.72rem", fontWeight: 700, color: k.is_active ? "var(--red)" : "var(--green)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
                              {k.is_active ? "Revoke" : "Restore"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function publicFieldsOf(s: SeriesRow): string[] {
  return s.public_fields?.length ? s.public_fields : ["period", "period_date", "value", "unit", "region", "source"];
}
