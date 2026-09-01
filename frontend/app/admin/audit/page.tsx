"use client";

// ── Audit log ───────────────────────────────────────────────────────────────
// The evidence that the governance exists.
//
// This was a tab inside the administration screen showing the newest 200 rows,
// which is something to glance at rather than something to answer a question
// with. An auditor asks "everything this person did in March", "every time a
// period was unfrozen", "every change to this series last year", and then asks
// for it as a file. None of that was possible from a tab.
//
// It is its own page because that is what it is for: a thing you send someone
// to, not a thing buried three clicks inside the console.

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getTokenFresh, getRole, isAdminRole } from "@/lib/auth";

type Entry = {
  id: number;
  action: string;
  table_name: string | null;
  record_id: number | null;
  series_type_id: string | null;
  period: string | null;
  region: string | null;
  old_value: number | null;
  new_value: number | null;
  performed_by: string;
  performed_at: string;
  notes: string | null;
};

type Filters = { person: string; action: string; series: string; from: string; to: string };

const EMPTY: Filters = { person: "", action: "", series: "", from: "", to: "" };

// Actions worth naming, grouped so the consequential ones are findable rather
// than lost in a list of every string ever written to the column.
const ACTION_GROUPS: { group: string; actions: { value: string; label: string }[] }[] = [
  {
    group: "Data",
    actions: [
      { value: "INSERT", label: "Records committed" },
      { value: "UPDATE", label: "Record edited" },
      { value: "DELETE", label: "Record removed" },
      { value: "edit", label: "Value revised" },
      { value: "auto_ingest", label: "Auto-ingested" },
      { value: "dedupe", label: "Duplicates removed" },
    ],
  },
  {
    group: "The record itself",
    actions: [
      { value: "freeze", label: "Period frozen" },
      { value: "unfreeze", label: "Period unfrozen" },
      { value: "UNFREEZE_REQUEST", label: "Unfreeze requested" },
      { value: "UNFREEZE_APPROVE", label: "Unfreeze approved" },
      { value: "UNFREEZE_REJECT", label: "Unfreeze refused" },
    ],
  },
  {
    group: "Access and accounts",
    actions: [
      { value: "USER_CREATE", label: "Account created" },
      { value: "ROLE_CHANGE", label: "Role changed" },
      { value: "USER_EDIT", label: "Account edited" },
      { value: "USER_TOGGLE", label: "Account activated or deactivated" },
      { value: "API_KEY_ISSUE", label: "API key issued" },
      { value: "API_KEY_REVOKE", label: "API key revoked" },
      { value: "API_KEY_ENABLE", label: "API key re-enabled" },
    ],
  },
  {
    group: "Publication",
    actions: [
      { value: "BULLETIN_DRAFT", label: "Bulletin drafted" },
      { value: "BULLETIN_PUBLISH", label: "Bulletin published" },
      { value: "API_PUBLISH", label: "Series published on the API" },
      { value: "API_WITHDRAW", label: "Series withdrawn from the API" },
      { value: "BROADCAST", label: "Broadcast sent" },
      { value: "CHALLENGE_DECIDED", label: "Figure challenge decided" },
    ],
  },
];

/** Acts that change what the public record says, or who can change it. */
const CONSEQUENTIAL = new Set([
  "freeze", "unfreeze", "UNFREEZE_APPROVE", "ROLE_CHANGE",
  "API_KEY_ISSUE", "DELETE", "dedupe", "USER_CREATE",
]);

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function AuditPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  // Time-boxed access (superadmin): who may read this console, until when.
  const [grants, setGrants] = useState<{ username: string; expires_at: string; granted_by: string }[]>([]);
  const [grantUser, setGrantUser] = useState("");
  const [grantHours, setGrantHours] = useState("336");
  const [grantMsg, setGrantMsg] = useState("");
  const isSuper = getRole() === "superadmin";
  const loadGrants = useCallback(async () => {
    if (getRole() !== "superadmin") return;
    const token = await getTokenFresh();
    const r = await fetch("/api/admin/audit-grants", { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (r.ok) setGrants(await r.json());
  }, []);
  useEffect(() => { loadGrants(); }, [loadGrants]);
  const grantAccess = useCallback(async () => {
    const token = await getTokenFresh();
    const r = await fetch("/api/admin/audit-grants", { method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ username: grantUser, hours: Number(grantHours) }) });
    const j = await r.json().catch(() => ({}));
    setGrantMsg(r.ok ? `${grantUser} holds the audit console until ${new Date(j.expires_at).toLocaleString("en-NG")}.` : (j.error ?? "Grant failed."));
    if (r.ok) { setGrantUser(""); loadGrants(); }
  }, [grantUser, grantHours, loadGrants]);
  const revokeAccess = useCallback(async (username: string) => {
    const token = await getTokenFresh();
    await fetch(`/api/admin/audit-grants?username=${encodeURIComponent(username)}`, { method: "DELETE", credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    loadGrants();
  }, [loadGrants]);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => { setAllowed(isAdminRole(getRole())); }, []);

  const qs = useCallback((f: Filters, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p.toString();
  }, []);

  const load = useCallback(async (f: Filters, p: number) => {
    setLoading(true); setError(null);
    try {
      const token = await getTokenFresh();
      const r = await fetch(`/api/admin/audit?${qs(f, { page: String(p), limit: "100" })}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      });
      if (!r.ok) {
        const b = await r.json().catch(() => null);
        setError(b?.error ?? `The audit log could not be read (${r.status}).`);
        return;
      }
      const j = await r.json();
      setEntries(j.entries ?? []);
      setTotal(j.total ?? 0);
      setPages(j.pages ?? 1);
    } catch {
      setError("The audit log could not be read. This is a connection problem, not an empty log.");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => { if (allowed) load(applied, page); }, [allowed, applied, page, load]);

  async function exportCsv() {
    const token = await getTokenFresh();
    const r = await fetch(`/api/admin/audit?${qs(applied, { format: "csv" })}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!r.ok) { setError("The export failed."); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nedb-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  if (allowed === false) {
    return (
      <div style={{ maxWidth: 560, margin: "3rem auto", padding: "0 1.25rem" }}>
        <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderTop: "3px solid var(--amber)", padding: "1.75rem" }}>
          <div className="eyebrow" style={{ color: "var(--amber)" }}>Not available</div>
          <h1 style={{ fontSize: "var(--t-xl)", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>The audit log is administrator only</h1>
          <p style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.75 }}>
            It records who changed what and when, including account and access changes, so it is held at administrator
            level. Published changes to figures are on the{" "}
            <Link href="/revisions" style={{ color: "var(--green)", fontWeight: 600 }}>public revision log</Link>.
          </p>
        </div>
      </div>
    );
  }

  const dirty = JSON.stringify(filters) !== JSON.stringify(applied);

  return (
    <div style={{ padding: "1.5rem 0 4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
        <div>
          <div className="eyebrow">Governance</div>
          <h1 style={{ fontSize: "var(--t-2xl)", fontWeight: 700, color: "var(--ink)", margin: 0, letterSpacing: "-0.015em" }}>Audit log</h1>
          <p style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", marginTop: "0.4rem", maxWidth: "var(--measure)", lineHeight: 1.7 }}>
            Every consequential act on the data bank, appended and never edited. Filter it, then export exactly what you
            filtered rather than what happens to be on screen.
          </p>
          {isSuper && (
            <div style={{ marginTop: "0.9rem", background: "var(--surface-white)", border: "1px solid var(--border)", padding: "0.9rem 1.1rem" }}>
              <div style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--ink)", marginBottom: "0.4rem" }}>Time-boxed access</div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ flex: "1 1 180px" }}>
                  <span className="form-label">Account</span>
                  <input className="form-input" value={grantUser} onChange={(e) => setGrantUser(e.target.value)} placeholder="username" />
                </label>
                <label style={{ flex: "0 1 120px" }}>
                  <span className="form-label">Hours</span>
                  <input className="form-input" inputMode="numeric" value={grantHours} onChange={(e) => setGrantHours(e.target.value.replace(/[^0-9]/g, ""))} />
                </label>
                <button className="btn btn-primary btn-sm" disabled={!grantUser || !grantHours} onClick={grantAccess}>Grant</button>
              </div>
              {grantMsg && <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-3)", marginTop: 6 }}>{grantMsg}</div>}
              {grants.length > 0 && (
                <div style={{ marginTop: "0.6rem", fontSize: "var(--t-xs)", color: "var(--ink-3)" }}>
                  {grants.map((g) => (
                    <div key={g.username} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0", borderTop: "1px solid var(--border-soft)" }}>
                      <span><strong>{g.username}</strong> until {new Date(g.expires_at).toLocaleString("en-NG")} · by {g.granted_by}</span>
                      <button onClick={() => revokeAccess(g.username)} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: "var(--t-xs)", fontWeight: 700 }}>Revoke</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={exportCsv} className="btn btn-secondary btn-sm" disabled={!total}>Export CSV</button>
          <Link href="/admin/roles" style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)" }}>Who may do what →</Link>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1rem 1.15rem", marginBottom: "1.15rem" }}>
        <div className="grid-auto" style={{ gap: "0.8rem", alignItems: "end" }}>
          <label>
            <span className="form-label">Person</span>
            <input className="form-input" value={filters.person} placeholder="username or part of it"
              onChange={(e) => setFilters({ ...filters, person: e.target.value })} />
          </label>
          <label>
            <span className="form-label">Action</span>
            <select className="form-input form-select" value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
              <option value="">Any action</option>
              {ACTION_GROUPS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.actions.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label>
            <span className="form-label">Series</span>
            <input className="form-input" value={filters.series} placeholder="e.g. crude_oil_production"
              onChange={(e) => setFilters({ ...filters, series: e.target.value })} />
          </label>
          <label>
            <span className="form-label">From</span>
            <input className="form-input" type="date" value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </label>
          <label>
            <span className="form-label">To</span>
            <input className="form-input" type="date" value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </label>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.85rem", flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-primary btn-sm" onClick={() => { setPage(1); setApplied(filters); }} disabled={!dirty}>
            Apply filters
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setFilters(EMPTY); setApplied(EMPTY); setPage(1); }}>
            Clear
          </button>
          <span style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)" }}>
            {loading ? "Reading…" : `${total.toLocaleString()} entr${total === 1 ? "y" : "ies"} match`}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ background: "var(--amber-tint)", border: "1px solid var(--amber)", padding: "0.75rem 1.05rem", marginBottom: "1.15rem", fontSize: "var(--t-sm)", color: "var(--ink-2)", lineHeight: 1.65 }}>
          {error}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Entries</span>
          <span style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)" }}>Newest first · appended, never edited</span>
        </div>

        {!loading && entries.length === 0 ? (
          <div style={{ padding: "1.25rem 1.35rem", fontSize: "var(--t-base)", color: "var(--ink-4)", lineHeight: 1.75 }}>
            Nothing matches those filters. That is not the same as nothing having happened; widen the range or clear the
            filters.
          </div>
        ) : (
          <div className="scroll-x">
            <table className="data-table" style={{ fontSize: "var(--t-sm)" }}>
              <thead>
                <tr>
                  <th>When</th><th>Who</th><th>Action</th><th>Series / period</th>
                  <th style={{ textAlign: "right" }}>Old → New</th><th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: "var(--ink-3)" }}>{fmtWhen(e.performed_at)}</td>
                    <td className="td-primary" style={{ whiteSpace: "nowrap" }}>{e.performed_by}</td>
                    <td>
                      <span className={`tag ${CONSEQUENTIAL.has(e.action) ? "tag-amber" : "tag-muted"}`} style={{ whiteSpace: "nowrap" }}>
                        {e.action}
                      </span>
                    </td>
                    <td style={{ color: "var(--ink-3)", whiteSpace: "nowrap" }}>
                      {e.series_type_id ?? "—"}{e.period ? ` · ${e.period}` : ""}{e.region ? ` · ${e.region}` : ""}
                    </td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", color: "var(--ink-3)" }}>
                      {e.old_value === null && e.new_value === null
                        ? "—"
                        : `${e.old_value ?? "—"} → ${e.new_value ?? "—"}`}
                    </td>
                    <td style={{ fontSize: "var(--t-xs)", color: "var(--ink-3)", lineHeight: 1.55, minWidth: 260 }}>{e.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1.15rem", borderTop: "1px solid var(--border-soft)", flexWrap: "wrap", gap: "0.6rem" }}>
            <span style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)" }}>Page {page} of {pages}</span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage((n) => Math.max(1, n - 1))} disabled={page <= 1 || loading}>Previous</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setPage((n) => Math.min(pages, n + 1))} disabled={page >= pages || loading}>Next</button>
            </div>
          </div>
        )}

        <div className="chart-source">
          The export contains every entry matching the current filters, not the page shown. Values beginning with a
          symbol are prefixed with an apostrophe so a spreadsheet treats them as text rather than a formula.
        </div>
      </div>
    </div>
  );
}
