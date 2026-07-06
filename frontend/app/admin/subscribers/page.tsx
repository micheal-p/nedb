"use client";

// ── Admin › Monthly Report & Subscribers ────────────────────────────────────
// The 31-day report cycle at a glance ("Collecting — sends in N days"), the
// push-now control with the timeline-preserving confirmation, and the full
// subscriber list.

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, getRole } from "@/lib/auth";

interface Cycle {
  anchor_at: string; due_at: string; due: boolean; days_left: number;
  last_sent_at: string | null; last_sent_via: string | null; last_sent_count: number | null;
}
interface Status { cycle: Cycle; subscribers: number; staff: number }
interface Sub { id: number; email: string; is_active: boolean; subscribed_at: string; unsubscribed_at: string | null }

export default function SubscribersAdmin() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);   // warning text when not due
  const [notice, setNotice] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const h = { Authorization: `Bearer ${getToken()}` };
    Promise.all([
      fetch("/api/admin/report", { headers: h }).then((r) => r.json()),
      fetch("/api/admin/subscribers", { headers: h }).then((r) => r.json()),
    ])
      .then(([st, list]) => { setStatus(st.cycle ? st : null); if (Array.isArray(list)) setSubs(list); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!getToken()) { router.replace("/data-point/login?redirect=/admin/subscribers"); return; }
    if (getRole() !== "admin") { router.replace("/data-point/dashboard"); return; }
    load();
  }, [router, load]);

  async function push(force: boolean) {
    setPushing(true); setNotice("");
    try {
      const res = await fetch("/api/admin/report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ force }),
      });
      const j = await res.json();
      if (res.status === 409 && j.error === "not_due") { setConfirm(j.message); return; }
      if (!res.ok) { setNotice(j.error ?? "Push failed"); return; }
      setConfirm(null);
      setNotice(`Report sent to ${j.sent} recipient(s) (${j.via}).`);
      load();
    } finally {
      setPushing(false);
    }
  }

  async function toggleSub(s: Sub) {
    await fetch("/api/admin/subscribers", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ id: s.id, is_active: !s.is_active }),
    });
    load();
  }

  const c = status?.cycle;

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.25rem" }}>Admin</div>
            <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Monthly Report &amp; Subscribers</h1>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginTop: "0.25rem" }}>Fixed 31-day cycle. Early pushes send immediately but never move the automatic timeline.</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Link href="/admin" style={{ fontSize: "0.78rem", color: "var(--ink-4)", textDecoration: "none" }}>← Admin</Link>
            <button onClick={load} className="btn btn-secondary btn-sm">Refresh</button>
          </div>
        </div>

        {loading || !status || !c ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--ink-5)", fontSize: "0.82rem" }}>
            {loading ? "Loading…" : "Run migration 029 to initialise the report cycle."}
          </div>
        ) : (
          <>
            {/* Cycle card */}
            <div className="panel" style={{ marginBottom: "1.5rem", borderTop: `3px solid ${c.due ? "#DC2626" : "var(--green)"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", padding: "1.25rem 1.5rem" }}>
                <div>
                  <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-5)" }}>Report cycle</div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: c.due ? "#DC2626" : "var(--ink)", margin: "0.25rem 0" }}>
                    {c.due
                      ? "Due now — will send on the next daily run"
                      : <>Still collecting — sends in <span style={{ fontFamily: "var(--font-mono)" }}>{c.days_left}</span> day{c.days_left === 1 ? "" : "s"}</>}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>
                    Scheduled send: {new Date(c.due_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
                    {c.last_sent_at && <> · Last sent {new Date(c.last_sent_at).toLocaleDateString("en-NG")} ({c.last_sent_via}, {c.last_sent_count} recipients)</>}
                  </div>
                  {/* Progress through the 31 days */}
                  <div style={{ width: 260, height: 6, borderRadius: 3, background: "var(--surface-muted)", overflow: "hidden", marginTop: 10 }}>
                    <div style={{ width: `${Math.min(100, Math.round(((31 - c.days_left) / 31) * 100))}%`, height: "100%", background: c.due ? "#DC2626" : "var(--green)" }} />
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <button onClick={() => push(false)} disabled={pushing} className="btn btn-primary" style={{ minWidth: 150 }}>
                    {pushing ? "Sending…" : c.due ? "Send now" : "Push now"}
                  </button>
                  <div style={{ fontSize: "0.68rem", color: "var(--ink-5)", marginTop: 6 }}>
                    {status.staff} staff · {status.subscribers} subscribers
                  </div>
                </div>
              </div>
            </div>

            {/* Early-push confirmation — the exact timeline-preserving warning */}
            {confirm && (
              <div style={{ marginBottom: "1.5rem", padding: "1.1rem 1.25rem", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: "var(--r-md)" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#92400E", marginBottom: 6 }}>Push before the scheduled date?</div>
                <p style={{ fontSize: "0.78rem", color: "#78350F", lineHeight: 1.6, margin: "0 0 0.75rem" }}>{confirm}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => push(true)} disabled={pushing} className="btn btn-primary btn-sm" style={{ background: "#92400E", borderColor: "#92400E" }}>
                    {pushing ? "Sending…" : "Yes, push now — keep the timeline"}
                  </button>
                  <button onClick={() => setConfirm(null)} className="btn btn-secondary btn-sm">Cancel</button>
                </div>
              </div>
            )}

            {notice && (
              <div style={{ marginBottom: "1.5rem", padding: "0.75rem 1rem", background: "var(--green-tint)", border: "1px solid var(--green-line)", borderRadius: "var(--r-md)", fontSize: "0.8rem", color: "var(--green-deep)" }}>{notice}</div>
            )}

            {/* Subscribers */}
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Public subscribers</span>
                <span style={{ fontSize: "0.7rem", color: "var(--ink-5)" }}>{subs.filter((s) => s.is_active).length} active · {subs.length} total</span>
              </div>
              {subs.length === 0 ? (
                <div style={{ padding: "3rem", textAlign: "center", color: "var(--ink-5)", fontSize: "0.82rem" }}>
                  No subscribers yet — the signup form lives in the public footer.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ fontSize: "0.75rem" }}>
                    <thead><tr><th>Email</th><th>Subscribed</th><th>Status</th><th></th></tr></thead>
                    <tbody>
                      {subs.map((s) => (
                        <tr key={s.id} style={{ opacity: s.is_active ? 1 : 0.55 }}>
                          <td className="td-primary" style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{s.email}</td>
                          <td style={{ fontSize: "0.7rem", color: "var(--ink-5)" }}>{new Date(s.subscribed_at).toLocaleDateString("en-NG")}</td>
                          <td>
                            <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: s.is_active ? "var(--green-tint)" : "#FEE2E2", color: s.is_active ? "var(--green)" : "#991B1B" }}>
                              {s.is_active ? "active" : "unsubscribed"}
                            </span>
                          </td>
                          <td><button onClick={() => toggleSub(s)} className="btn btn-secondary btn-sm" style={{ fontSize: "0.65rem", padding: "2px 10px" }}>{s.is_active ? "Deactivate" : "Reactivate"}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
