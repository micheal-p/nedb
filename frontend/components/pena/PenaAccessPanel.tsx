"use client";

// ── PenaAccessPanel ─────────────────────────────────────────────────────────
// Answers "who can see this assessment, and who has looked at it". Personal
// data without an access list and an access log is personal data nobody is
// accountable for.

import { useState, useEffect, useCallback } from "react";
import { getTokenFresh } from "@/lib/auth";
import { ConfirmPanel } from "@/components/ui/gov";

type Grant = { username: string; can_export: boolean; granted_by: string | null; granted_at: string };
type View  = { username: string; action: string; identifiable: boolean; viewed_at: string };
type Staff = { username: string; full_name: string; role: string; agency: string | null };
type Form  = { id: number; title: string; slug: string; is_restricted: boolean; owner_agency: string | null; is_public_stats: boolean };

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

export default function PenaAccessPanel({ formId }: { formId: number }) {
  const [form, setForm] = useState<Form | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [views, setViews] = useState<View[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [pick, setPick] = useState("");
  const [canExport, setCanExport] = useState(false);
  const [agency, setAgency] = useState("");
  const [confirmRestrict, setConfirmRestrict] = useState(false);
  // Restricting controls which STAFF may open the assessment. It says nothing
  // about the k-anonymised aggregates published at /assessments/<slug>, which
  // is a separate switch an admin restricting an assessment would not expect
  // to be left on. Offered here, ticked by default, but never silent.
  const [withdrawPublic, setWithdrawPublic] = useState(true);
  const [tab, setTab] = useState<"who" | "log">("who");

  const load = useCallback(async () => {
    const r = await authed(`/api/pena/forms/${formId}/access`);
    if (r.ok) {
      const j = await r.json();
      setForm(j.form); setGrants(j.grants ?? []); setViews(j.views ?? []); setStaff(j.staff ?? []);
      setAgency(j.form?.owner_agency ?? "");
    }
    setLoading(false);
  }, [formId]);
  useEffect(() => { load(); }, [load]);

  async function put(body: Record<string, unknown>, note: string) {
    setBusy(true); setMsg("");
    const r = await authed(`/api/pena/forms/${formId}/access`, { method: "PUT", body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error ?? "Failed."); return; }
    setMsg(note); setTimeout(() => setMsg(""), 2500);
    load();
  }

  const nameOf = (u: string) => staff.find((s) => s.username === u)?.full_name ?? u;

  if (loading) return null;

  return (
    <div className="panel" style={{ marginBottom: "1.5rem" }}>
      <div className="panel-header">
        <span className="panel-title">Who can see this assessment</span>
        <div style={{ display: "flex", gap: 4 }}>
          {(["who", "log"] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)}
              style={{
                fontSize: "var(--t-xs)", fontWeight: 700, padding: "3px 9px", cursor: "pointer",
                border: `1px solid ${tab === k ? "var(--ink)" : "var(--border)"}`,
                background: tab === k ? "var(--ink)" : "var(--surface-white)",
                color: tab === k ? "#fff" : "var(--ink-3)",
              }}>
              {k === "who" ? "Access" : `Access log (${views.length})`}
            </button>
          ))}
        </div>
      </div>

      {msg && <div style={{ fontSize: "var(--t-sm)", color: "var(--ink-2)", background: "var(--surface-muted)", padding: "0.5rem 1.15rem", borderBottom: "1px solid var(--border-soft)" }}>{msg}</div>}

      {tab === "who" ? (
        <div style={{ padding: "1rem 1.15rem" }}>
          {/* Restriction */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap", justifyContent: "space-between", paddingBottom: "0.9rem", borderBottom: "1px solid var(--border-soft)", marginBottom: "0.9rem" }}>
            <div style={{ minWidth: 240, flex: 1 }}>
              <div style={{ fontSize: "var(--t-base)", fontWeight: 700, color: "var(--ink)", marginBottom: 2 }}>
                {form?.is_restricted ? "Restricted assessment" : "Open to all signed-in staff"}
              </div>
              <div style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)", lineHeight: 1.6 }}>
                {form?.is_restricted
                  ? <>Only administrators and the people listed below can open this assessment{form.owner_agency ? `, held on behalf of ${form.owner_agency}` : ""}.</>
                  : <>Any signed-in staff member can see aggregate findings and the response table with personal fields removed. Identifiable responses stay limited to administrators and granted users regardless.</>}
              </div>
            </div>
            {!confirmRestrict ? (
              <button onClick={() => setConfirmRestrict(true)} disabled={busy} className="btn btn-secondary btn-sm">
                {form?.is_restricted ? "Open to all staff…" : "Restrict this assessment…"}
              </button>
            ) : null}
          </div>

          {confirmRestrict && (
            <>
              {/* Restricting is a staff-side control. Open data is a second
                  switch, and leaving it on while believing the assessment is
                  locked down is the mistake worth preventing here. */}
              {!form?.is_restricted && form?.is_public_stats && (
                <div style={{ background: "var(--amber-tint, var(--surface-muted))", border: "1px solid var(--border)", padding: "0.85rem 1.15rem", margin: "0.75rem 0 0" }}>
                  <div style={{ fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
                    This assessment also publishes open data
                  </div>
                  <p style={{ fontSize: "var(--t-sm)", color: "var(--ink-2)", lineHeight: 1.6, margin: "0 0 0.6rem" }}>
                    Its k-anonymised aggregates are public at <code>/assessments/{form.slug}</code>. Restricting it
                    limits which staff can open it and does not take that page down.
                  </p>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "var(--t-sm)", color: "var(--ink-2)", cursor: "pointer" }}>
                    <input type="checkbox" checked={withdrawPublic} onChange={(e) => setWithdrawPublic(e.target.checked)} style={{ marginTop: 3 }} />
                    <span>Withdraw the open-data page too. Leave this unticked to keep publishing aggregates while the assessment itself is restricted.</span>
                  </label>
                </div>
              )}
              <ConfirmPanel
                title={form?.is_restricted ? "Open this assessment to all signed-in staff?" : "Restrict this assessment?"}
                body={form?.is_restricted
                  ? "Any signed-in staff member will be able to see its aggregate findings, and its responses in redacted form. Identifiable responses remain limited to administrators and granted users."
                  : `Only administrators and the users you grant will be able to open it, list it, or read its responses. Anyone else gets a clear refusal rather than a blank page.${form?.is_public_stats ? (withdrawPublic ? " The open-data page will be withdrawn as well." : " The open-data page will stay published.") : ""}`}
                confirmLabel={form?.is_restricted ? "Open to all staff" : "Restrict"}
                busy={busy}
                onConfirm={() => {
                  setConfirmRestrict(false);
                  const restricting = !form?.is_restricted;
                  put({
                    is_restricted: restricting,
                    owner_agency: agency || null,
                    ...(restricting && form?.is_public_stats && withdrawPublic ? { is_public_stats: false } : {}),
                  }, restricting
                    ? (form?.is_public_stats && withdrawPublic ? "Assessment restricted and withdrawn from open data." : "Assessment restricted.")
                    : "Assessment opened to all staff.");
                }}
                onCancel={() => setConfirmRestrict(false)}
              />
            </>
          )}

          {form?.is_restricted && (
            <label style={{ display: "block", marginBottom: "0.9rem" }}>
              <span className="form-label">Held on behalf of (optional)</span>
              <input className="form-input" value={agency} onChange={(e) => setAgency(e.target.value)}
                onBlur={() => { if (agency !== (form.owner_agency ?? "")) put({ is_restricted: true, owner_agency: agency || null }, "Owning agency saved."); }}
                placeholder="Rural Electrification Agency" style={{ maxWidth: 380 }} />
            </label>
          )}

          {/* Grant */}
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "1rem" }}>
            <label style={{ flex: "1 1 260px" }}>
              <span className="form-label">Grant access to</span>
              <select className="form-input form-select" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Choose a staff member…</option>
                {staff.filter((s) => !grants.some((g) => g.username === s.username)).map((s) => (
                  <option key={s.username} value={s.username}>
                    {s.full_name} — {s.agency ?? s.role}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--t-sm)", color: "var(--ink-2)", paddingBottom: "0.6rem" }}>
              <input type="checkbox" checked={canExport} onChange={(e) => setCanExport(e.target.checked)} style={{ accentColor: "var(--green)" }} />
              Include export
            </label>
            <button onClick={() => { if (pick) { put({ grant: pick, can_export: canExport }, `Access granted to ${nameOf(pick)}.`); setPick(""); setCanExport(false); } }}
              disabled={!pick || busy} className="btn btn-primary btn-sm">Grant</button>
          </div>

          {/* Current grants */}
          {grants.length === 0 ? (
            <div style={{ fontSize: "var(--t-sm)", color: "var(--ink-4)" }}>
              No individual grants. Administrators can always see identifiable responses.
            </div>
          ) : (
            <table className="data-table" style={{ fontSize: "var(--t-sm)" }}>
              <thead><tr><th>Person</th><th>Level</th><th>Granted by</th><th /></tr></thead>
              <tbody>
                {grants.map((g) => (
                  <tr key={g.username}>
                    <td className="td-primary">{nameOf(g.username)}<div style={{ fontSize: "var(--t-2xs)", color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>{g.username}</div></td>
                    <td>{g.can_export ? <span className="tag tag-amber">View and export</span> : <span className="tag tag-muted">View only</span>}</td>
                    <td style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)" }}>{g.granted_by ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <button onClick={() => put({ revoke: g.username }, `Access revoked for ${nameOf(g.username)}.`)}
                        style={{ background: "none", border: "none", color: "var(--red)", fontSize: "var(--t-xs)", fontWeight: 700, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div>
          {views.length === 0 ? (
            <div style={{ padding: "1.1rem 1.15rem", fontSize: "var(--t-sm)", color: "var(--ink-4)" }}>
              Nobody has opened this assessment yet.
            </div>
          ) : (
            <table className="data-table" style={{ fontSize: "var(--t-sm)" }}>
              <thead><tr><th>Person</th><th>Action</th><th>Included personal data</th><th style={{ textAlign: "right" }}>When</th></tr></thead>
              <tbody>
                {views.map((v, i) => (
                  <tr key={i}>
                    <td className="td-primary">{nameOf(v.username)}</td>
                    <td style={{ textTransform: "capitalize" }}>{v.action}</td>
                    <td>{v.identifiable ? <span className="tag tag-amber">Yes</span> : <span className="tag tag-muted">Aggregates only</span>}</td>
                    <td style={{ textAlign: "right", fontSize: "var(--t-xs)", color: "var(--ink-4)" }}>{new Date(v.viewed_at).toLocaleString("en-NG")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="chart-source">
            Every access to identifiable responses is recorded. Under the Nigeria Data Protection Act 2023 a respondent may ask who has seen their data.
          </div>
        </div>
      )}
    </div>
  );
}
