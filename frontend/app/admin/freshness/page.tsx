"use client";

// ── Admin › Data Freshness — "is our data current?" at a glance ─────────────
// One row per series: latest period, age vs its cadence, how it arrived
// (staff / IoT / auto-ingested). The DG-accountability view.

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken, getRole } from "@/lib/auth";

interface Row {
  id: string; name: string; sector: string; frequency: string; unit: string;
  latest_period: string | null; entered_at: string | null;
  age_days: number | null; max_age_days: number; via: string | null; status: string;
}
interface Data { board: Row[]; summary: { fresh: number; overdue: number; stale: number; empty: number } }

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  fresh:   { label: "Fresh",   bg: "var(--green-tint)", fg: "var(--green)" },
  overdue: { label: "Overdue", bg: "#FEF3C7", fg: "#92400E" },
  stale:   { label: "Stale",   bg: "#FEE2E2", fg: "#991B1B" },
  empty:   { label: "No data", bg: "var(--surface-muted)", fg: "var(--ink-5)" },
};
const VIA: Record<string, string> = { staff: "Staff", iot: "IoT device", auto: "Auto-ingested" };

export default function FreshnessAdmin() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/freshness", { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!getToken()) { router.replace("/data-point/login?redirect=/admin/freshness"); return; }
    if (getRole() !== "admin") { router.replace("/data-point/dashboard"); return; }
    load();
  }, [router, load]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.25rem" }}>Admin</div>
            <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Data Freshness</h1>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginTop: "0.25rem" }}>Latest period per series vs its expected cadence. Overdue = one cycle late; stale = two or more.</p>
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
            {/* Summary strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              {(["fresh", "overdue", "stale", "empty"] as const).map((k) => (
                <div key={k} className="panel" style={{ padding: "1rem 1.25rem", borderTop: `3px solid ${STATUS[k].fg}` }}>
                  <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: STATUS[k].fg }}>{data.summary[k]}</div>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-5)" }}>{STATUS[k].label}</div>
                </div>
              ))}
            </div>

            {/* Board */}
            <div className="panel">
              <div className="panel-header"><span className="panel-title">Series board</span><span style={{ fontSize: "0.7rem", color: "var(--ink-5)" }}>sorted oldest first</span></div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ fontSize: "0.75rem" }}>
                  <thead><tr><th>Series</th><th>Cadence</th><th>Latest period</th><th>Age</th><th>Arrived via</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.board.map((r) => {
                      const st = STATUS[r.status];
                      return (
                        <tr key={r.id}>
                          <td className="td-primary"><Link href={`/series/${r.id}`} style={{ color: "var(--ink)" }}>{r.name}</Link></td>
                          <td style={{ textTransform: "capitalize" }}>{r.frequency}</td>
                          <td style={{ fontFamily: "var(--font-mono)" }}>{r.latest_period ?? "—"}</td>
                          <td style={{ fontFamily: "var(--font-mono)", color: r.age_days !== null && r.age_days > r.max_age_days ? "#991B1B" : undefined }}>
                            {r.age_days !== null ? `${r.age_days}d` : "—"}
                            <span style={{ color: "var(--ink-5)" }}> / {r.max_age_days}d</span>
                          </td>
                          <td>{r.via ? VIA[r.via] ?? r.via : "—"}</td>
                          <td><span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: st.bg, color: st.fg }}>{st.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p style={{ fontSize: "0.68rem", color: "var(--ink-5)", marginTop: "0.75rem" }}>
              &ldquo;Arrived via&rdquo; distinguishes staff entry, IoT device telemetry (X-API-Key ingest), and auto-ingested pipeline records — ready for the EOM devices when they arrive.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
