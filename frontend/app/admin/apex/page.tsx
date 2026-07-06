"use client";

// ── Admin › Apex AI — usage & question observability ────────────────────────
// Today's self-metered Gemini allowance, a 7-day call history, and the live
// log of questions asked through /api/ask (with status and latency).

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, getRole } from "@/lib/auth";

interface ApexData {
  today: { used: number; limit: number; pct: number; resetsAt: string };
  limits: { gen: number; embed: number };
  history: { date: string; gen: number; embed: number }[];
  recent: { asked_at: string; ip: string | null; question: string; status: string; sources: number; duration_ms: number | null }[];
  totalQuestions: number;
}

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  ok:              { bg: "var(--green-tint)", fg: "var(--green)" },
  ai_quota:        { bg: "#FEE2E2", fg: "#991B1B" },
  chat_rate_limit: { bg: "#FEF3C7", fg: "#92400E" },
  error:           { bg: "#FEE2E2", fg: "#991B1B" },
};

export default function ApexAdmin() {
  const router = useRouter();
  const [data, setData] = useState<ApexData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/apex", { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!getToken()) { router.replace("/data-point/login?redirect=/admin/apex"); return; }
    if (getRole() !== "admin") { router.replace("/data-point/dashboard"); return; }
    load();
  }, [router, load]);

  const maxGen = Math.max(1, ...(data?.history ?? []).map((h) => h.gen));

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.25rem" }}>Admin</div>
            <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Apex AI — Usage &amp; Questions</h1>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginTop: "0.25rem" }}>Self-metered Gemini allowance and the live question log. Quotas reset daily at midnight Pacific (~08:00 WAT).</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Link href="/admin" style={{ fontSize: "0.78rem", color: "var(--ink-4)", textDecoration: "none" }}>← Admin</Link>
            <button onClick={load} className="btn btn-secondary btn-sm">Refresh</button>
          </div>
        </div>

        {loading || !data ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--ink-5)", fontSize: "0.82rem" }}>Loading…</div>
        ) : (
          <>
            {/* Today's allowance */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              <div className="panel" style={{ padding: "1.1rem 1.25rem" }}>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-5)" }}>Answers today</div>
                <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)", margin: "0.25rem 0" }}>
                  {data.today.used}<span style={{ fontSize: "0.85rem", color: "var(--ink-4)" }}> / {data.today.limit}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "var(--surface-muted)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, data.today.pct)}%`, height: "100%", background: data.today.pct >= 90 ? "#DC2626" : data.today.pct >= 70 ? "#D97706" : "var(--green)" }} />
                </div>
                <div style={{ fontSize: "0.68rem", color: "var(--ink-5)", marginTop: 6 }}>
                  {data.today.pct}% of the free daily allowance · resets {new Date(data.today.resetsAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <div className="panel" style={{ padding: "1.1rem 1.25rem" }}>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-5)" }}>Questions all-time</div>
                <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)", margin: "0.25rem 0" }}>{data.totalQuestions.toLocaleString()}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--ink-5)" }}>logged via /api/ask</div>
              </div>
              <div className="panel" style={{ padding: "1.1rem 1.25rem" }}>
                <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--ink-5)" }}>Per-visitor limit</div>
                <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)", margin: "0.25rem 0" }}>10<span style={{ fontSize: "0.85rem", color: "var(--ink-4)" }}> / min</span></div>
                <div style={{ fontSize: "0.68rem", color: "var(--ink-5)" }}>per IP · Redis-backed, survives deploys</div>
              </div>
            </div>

            {/* 7-day history */}
            <div className="panel" style={{ marginBottom: "1.5rem" }}>
              <div className="panel-header"><span className="panel-title">Last 7 days — AI calls</span><span style={{ fontSize: "0.7rem", color: "var(--ink-5)" }}>answers · embeddings</span></div>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", padding: "1.25rem", height: 150 }}>
                {[...data.history].reverse().map((h) => (
                  <div key={h.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                    <div style={{ fontSize: "0.62rem", fontFamily: "var(--font-mono)", color: "var(--ink-4)" }}>{h.gen}</div>
                    <div style={{ width: "60%", maxWidth: 46, borderRadius: "3px 3px 0 0", background: "var(--green)", height: `${Math.max(3, (h.gen / maxGen) * 80)}%` }} title={`${h.gen} answers · ${h.embed} embeddings`} />
                    <div style={{ fontSize: "0.6rem", color: "var(--ink-5)" }}>{h.date.slice(5)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Question log */}
            <div className="panel">
              <div className="panel-header"><span className="panel-title">Recent questions</span><span style={{ fontSize: "0.7rem", color: "var(--ink-5)" }}>latest 50</span></div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ fontSize: "0.75rem" }}>
                  <thead><tr><th>Time</th><th>Question</th><th>Status</th><th>Sources</th><th>Latency</th><th>IP</th></tr></thead>
                  <tbody>
                    {data.recent.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--ink-5)" }}>No questions logged yet — run migration 027 and ask Apex AI something.</td></tr>
                    )}
                    {data.recent.map((r, i) => {
                      const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.error;
                      return (
                        <tr key={i}>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", whiteSpace: "nowrap" }}>{new Date(r.asked_at).toLocaleString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                          <td style={{ maxWidth: 380 }}>{r.question}</td>
                          <td><span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: st.bg, color: st.fg }}>{r.status}</span></td>
                          <td style={{ fontFamily: "var(--font-mono)" }}>{r.sources}</td>
                          <td style={{ fontFamily: "var(--font-mono)" }}>{r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}</td>
                          <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--ink-5)" }}>{r.ip ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
