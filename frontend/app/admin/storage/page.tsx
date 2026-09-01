"use client";

// ── Storage console (superadmin) ────────────────────────────────────────────
// Planning-folder allocations: pending requests decided one by one, and the
// current grants on record. Storage is a budget, and budgets have owners.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getRole, isLoggedIn, getTokenFresh } from "@/lib/auth";

type Req = { id: number; username: string; requested_mb: number; reason: string | null; status: string; created_at: string; decided_by: string | null };
type Alloc = { username: string; quota_mb: number; granted_by: string | null; updated_at: string };

export default function StorageAdminPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<Req[]>([]);
  const [allocations, setAllocations] = useState<Alloc[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [grantMb, setGrantMb] = useState<Record<number, string>>({});

  const authed = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getTokenFresh();
    return fetch(url, { ...init, credentials: "include", headers: { ...(init?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.body ? { "Content-Type": "application/json" } : {}) } });
  }, []);

  const load = useCallback(async () => {
    const r = await authed("/api/storage");
    if (r.ok) { const j = await r.json(); setRequests(j.requests ?? []); setAllocations(j.allocations ?? []); }
    else setMsg("Superadmin only — allocations are a budget decision.");
  }, [authed]);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/admin/storage"); return; }
    if (getRole() !== "superadmin") { setMsg("Superadmin only — allocations are a budget decision."); return; }
    load();
  }, [router, load]);

  async function decide(r: Req, decision: "granted" | "declined") {
    setBusy(true);
    const quota = Number(grantMb[r.id] ?? r.requested_mb + 200);
    const res = await authed("/api/storage", { method: "PATCH", body: JSON.stringify({ id: r.id, decision, quota_mb: quota }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? (decision === "granted" ? `Granted ${quota}MB to ${r.username}.` : `Declined ${r.username}'s request.`) : (j.error ?? "Failed."));
    load();
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="eyebrow">Admin · Planning Storage</div>
        <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", marginBottom: "0.25rem" }}>Storage allocations</h1>
        <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginBottom: "1.5rem", maxWidth: 640 }}>
          Every account gets 200MB of planning-folder space free. Requests for more land here; the grant sets the
          account&apos;s total quota and is written to the audit log.
        </p>

        {msg && <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "0.6rem 1rem", fontSize: "0.8rem", color: "var(--ink-2)", marginBottom: "1rem" }}>{msg}</div>}

        <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", marginBottom: "1.5rem", overflowX: "auto" }}>
          <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)", fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)" }}>Requests</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead><tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>Who</th><th style={{ padding: "8px 12px" }}>Asked for</th>
              <th style={{ padding: "8px 12px" }}>Why</th><th style={{ padding: "8px 12px" }}>Status</th><th style={{ padding: "8px 12px" }} />
            </tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>{r.username}</td>
                  <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)" }}>+{r.requested_mb}MB</td>
                  <td style={{ padding: "8px 12px", color: "var(--ink-3)", maxWidth: 320 }}>{r.reason ?? "—"}</td>
                  <td style={{ padding: "8px 12px", fontWeight: 700, color: r.status === "granted" ? "var(--green)" : r.status === "declined" ? "var(--red)" : "var(--amber)" }}>{r.status}</td>
                  <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                    {r.status === "pending" && (
                      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <input className="form-input" style={{ width: 90, padding: "4px 8px", fontSize: "0.76rem" }} inputMode="numeric"
                          placeholder={`${r.requested_mb + 200}`} value={grantMb[r.id] ?? ""}
                          onChange={(e) => setGrantMb({ ...grantMb, [r.id]: e.target.value.replace(/[^0-9]/g, "") })}
                          aria-label={`New total quota for ${r.username} in MB`} />
                        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => decide(r, "granted")}>Grant total</button>
                        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => decide(r, "declined")}>Decline</button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {requests.length === 0 && <tr><td colSpan={5} style={{ padding: "1.25rem", textAlign: "center", color: "var(--ink-5)" }}>No requests.</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", overflowX: "auto" }}>
          <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)", fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)" }}>Current allocations above the default</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead><tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>Account</th><th style={{ padding: "8px 12px", textAlign: "right" }}>Quota</th>
              <th style={{ padding: "8px 12px" }}>Granted by</th><th style={{ padding: "8px 12px" }}>When</th>
            </tr></thead>
            <tbody>
              {allocations.map((a) => (
                <tr key={a.username} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>{a.username}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{a.quota_mb}MB</td>
                  <td style={{ padding: "8px 12px", color: "var(--ink-4)" }}>{a.granted_by ?? "—"}</td>
                  <td style={{ padding: "8px 12px", color: "var(--ink-4)" }}>{new Date(a.updated_at).toLocaleDateString("en-NG")}</td>
                </tr>
              ))}
              {allocations.length === 0 && <tr><td colSpan={4} style={{ padding: "1.25rem", textAlign: "center", color: "var(--ink-5)" }}>Everyone is on the 200MB default.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
