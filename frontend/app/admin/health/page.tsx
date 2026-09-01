"use client";

// ── Platform Health console ─────────────────────────────────────────────────
// Live status, uptime and latency from the snapshot record, the incident
// list, and what the home-built rate limiter is holding back. The sampling
// caveat is printed on the page because an uptime number that hides its
// method is marketing, not monitoring.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, getRole, isAdminRole, getTokenFresh } from "@/lib/auth";

type Live = { status: string; checks: { database: { status: string; ms?: number }; cache: { status: string; detail?: string } } };
type History = {
  hours: number; samples: number; uptime_pct: number | null; avg_db_ms: number | null;
  incidents: { at: string; status: string }[];
  snapshots: { checked_at: string; status: string; db_ms: number | null }[];
  limiter: { key: string; hits: number }[];
  sampling_note: string;
};

const STATUS_COLOR: Record<string, string> = { ok: "var(--green)", degraded: "var(--amber)", down: "var(--red)", unhealthy: "var(--red)" };

export default function HealthPage() {
  const router = useRouter();
  const [live, setLive] = useState<Live | null>(null);
  const [hist, setHist] = useState<History | null>(null);
  const [hours, setHours] = useState(168);

  const load = useCallback(async (h: number) => {
    const token = await getTokenFresh();
    const [l, hh] = await Promise.all([
      fetch("/api/health").then((r) => r.json()).catch(() => null),
      fetch(`/api/admin/health-history?hours=${h}`, { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    setLive(l); setHist(hh);
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/admin/health"); return; }
    if (!isAdminRole(getRole())) { router.replace("/data-point/dashboard"); return; }
    load(hours);
  }, [router, load, hours]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <div className="eyebrow">Admin · Operations</div>
            <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Platform health</h1>
          </div>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            {[24, 168, 720].map((h) => (
              <button key={h} className={`btn btn-sm ${hours === h ? "btn-primary" : "btn-secondary"}`} onClick={() => setHours(h)}>
                {h === 24 ? "24h" : h === 168 ? "7 days" : "30 days"}
              </button>
            ))}
          </div>
        </div>

        {/* Live now */}
        <div className="grid-auto grid-hair" style={{ marginBottom: "1.25rem" }}>
          <div style={{ padding: "1rem 1.2rem" }}>
            <div style={{ fontSize: "var(--t-2xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-4)" }}>Right now</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: STATUS_COLOR[live?.status ?? ""] ?? "var(--ink)", marginTop: 4, textTransform: "capitalize" }}>{live?.status ?? "…"}</div>
            <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", marginTop: 3 }}>
              DB {live?.checks?.database?.status} {live?.checks?.database?.ms != null ? `· ${live.checks.database.ms}ms` : ""} · cache {live?.checks?.cache?.status}
            </div>
          </div>
          <div style={{ padding: "1rem 1.2rem" }}>
            <div style={{ fontSize: "var(--t-2xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-4)" }}>Sampled uptime</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--ink)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{hist?.uptime_pct != null ? `${hist.uptime_pct}%` : "—"}</div>
            <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", marginTop: 3 }}>{hist?.samples ?? 0} snapshots in the window</div>
          </div>
          <div style={{ padding: "1rem 1.2rem" }}>
            <div style={{ fontSize: "var(--t-2xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-4)" }}>Avg DB latency</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--ink)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{hist?.avg_db_ms != null ? `${hist.avg_db_ms}ms` : "—"}</div>
            <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", marginTop: 3 }}>across sampled checks</div>
          </div>
          <div style={{ padding: "1rem 1.2rem" }}>
            <div style={{ fontSize: "var(--t-2xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-4)" }}>Incidents</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: (hist?.incidents?.length ?? 0) > 0 ? "var(--amber)" : "var(--green)", marginTop: 4 }}>{hist?.incidents?.length ?? 0}</div>
            <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", marginTop: 3 }}>entries into a non-ok state</div>
          </div>
        </div>

        {/* Latency strip */}
        {hist && hist.snapshots.length > 1 && (
          <div className="chart-panel" style={{ marginBottom: "1.25rem" }}>
            <div className="chart-panel-title" style={{ marginBottom: "0.5rem" }}>Snapshot record · newest {hist.snapshots.length}</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 64 }} aria-label="Latency per snapshot">
              {hist.snapshots.map((sn, i) => {
                const h = Math.min(64, Math.max(3, (sn.db_ms ?? 0) / 20));
                return <div key={i} title={`${new Date(sn.checked_at).toLocaleString("en-NG")} · ${sn.status} · ${sn.db_ms ?? "—"}ms`}
                  style={{ flex: 1, height: h, background: STATUS_COLOR[sn.status] ?? "var(--border)", opacity: 0.85 }} />;
              })}
            </div>
            <div style={{ fontSize: "var(--t-2xs)", color: "var(--ink-5)", marginTop: 6 }}>Bar height = DB latency; colour = status.</div>
          </div>
        )}

        <div className="grid-2" style={{ gap: "1.25rem", alignItems: "start" }}>
          {/* Incidents */}
          <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)" }}>
            <div style={{ padding: "0.8rem 1.1rem", borderBottom: "1px solid var(--border)", fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--ink)" }}>Incidents</div>
            {(hist?.incidents?.length ?? 0) === 0 ? (
              <div style={{ padding: "1.25rem", fontSize: "var(--t-sm)", color: "var(--ink-5)" }}>None in this window.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--t-sm)" }}>
                <tbody>
                  {hist!.incidents.map((inc, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                      <td style={{ padding: "7px 12px", color: "var(--ink-3)" }}>{new Date(inc.at).toLocaleString("en-NG")}</td>
                      <td style={{ padding: "7px 12px", fontWeight: 700, color: STATUS_COLOR[inc.status] ?? "var(--ink)" }}>{inc.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Limiter pressure */}
          <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)" }}>
            <div style={{ padding: "0.8rem 1.1rem", borderBottom: "1px solid var(--border)", fontSize: "var(--t-sm)", fontWeight: 700, color: "var(--ink)" }}>Rate limiter · busiest keys</div>
            {(hist?.limiter?.length ?? 0) === 0 ? (
              <div style={{ padding: "1.25rem", fontSize: "var(--t-sm)", color: "var(--ink-5)" }}>No counters yet — the Postgres rail fills this as traffic arrives.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--t-sm)" }}>
                <tbody>
                  {hist!.limiter.map((l) => (
                    <tr key={l.key} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                      <td style={{ padding: "7px 12px", fontFamily: "var(--font-mono)", fontSize: "var(--t-xs)", wordBreak: "break-all" }}>{l.key}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{l.hits.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {hist && (
          <p style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)", lineHeight: 1.7, marginTop: "1.25rem", maxWidth: "var(--measure)" }}>
            {hist.sampling_note}
          </p>
        )}
      </div>
    </div>
  );
}
