"use client";

// ── Finance console ─────────────────────────────────────────────────────────
// The accounting administration's dashboard: everything the platform is owed
// and everything it has verifiably collected — vintage orders and priced
// data requests, totals first, honesty printed under them.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, getRole, isAdminRole, getTokenFresh } from "@/lib/auth";

type Order = { reference: string; email: string; buyer_name: string | null; organisation: string | null; amount_ngn: number; status: string; created_at: string; paid_at: string | null; vintage: string | null };
type Req = { id: number; full_name: string; organization: string | null; email: string; price_ngn: number; quote_note: string | null; status: string; created_at: string; paid_at: string | null };
type Fin = { totals: { collected_ngn: number; outstanding_ngn: number; waived_ngn: number }; vintage_orders: Order[]; data_requests: Req[]; note: string };

const naira = (v: number) => `₦${Math.round(v).toLocaleString()}`;

export default function FinancePage() {
  const router = useRouter();
  const [fin, setFin] = useState<Fin | null>(null);
  const [denied, setDenied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getTokenFresh();
    const r = await fetch("/api/admin/finance", { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const j = await r.json().catch(() => null);
    if (!r.ok) { setDenied(j?.error ?? "Not available to your administration."); return; }
    setFin(j);
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/admin/finance"); return; }
    if (!isAdminRole(getRole())) { router.replace("/data-point/dashboard"); return; }
    load();
  }, [router, load]);

  if (denied) return <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: "2rem", color: "var(--ink-4)", fontSize: "0.85rem", textAlign: "center" }}>{denied}</div>;

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div className="eyebrow">Admin · Accounting</div>
        <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", marginBottom: "1.25rem" }}>Finance</h1>

        <div className="grid-auto grid-hair" style={{ marginBottom: "1.25rem" }}>
          {[
            { l: "Collected (verified)", v: fin ? naira(fin.totals.collected_ngn) : "…", c: "var(--green)" },
            { l: "Outstanding (quoted / pending)", v: fin ? naira(fin.totals.outstanding_ngn) : "…", c: "var(--amber)" },
            { l: "Fees waived", v: fin ? String(fin.totals.waived_ngn) : "…", c: "var(--ink-4)" },
          ].map((t) => (
            <div key={t.l} style={{ padding: "1rem 1.2rem" }}>
              <div style={{ fontSize: "var(--t-2xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-4)" }}>{t.l}</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 700, color: t.c, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{t.v}</div>
            </div>
          ))}
        </div>

        {fin?.note && <p style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)", marginBottom: "1.25rem", maxWidth: "var(--measure)" }}>{fin.note}</p>}

        <div className="grid-2" style={{ gap: "1.25rem", alignItems: "start" }}>
          <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", overflowX: "auto" }}>
            <div style={{ padding: "0.8rem 1.1rem", borderBottom: "1px solid var(--border)", fontSize: "var(--t-sm)", fontWeight: 700 }}>Vintage orders</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--t-xs)" }}>
              <tbody>
                {(fin?.vintage_orders ?? []).map((o) => (
                  <tr key={o.reference} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                    <td style={{ padding: "7px 10px", fontFamily: "var(--font-mono)" }}>{o.reference}</td>
                    <td style={{ padding: "7px 10px" }}>{o.buyer_name ?? o.email}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{naira(Number(o.amount_ngn))}</td>
                    <td style={{ padding: "7px 10px", fontWeight: 700, color: o.status === "paid" ? "var(--green)" : "var(--ink-4)" }}>{o.status}</td>
                  </tr>
                ))}
                {(fin?.vintage_orders?.length ?? 0) === 0 && <tr><td style={{ padding: "1rem", color: "var(--ink-5)" }}>No orders yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", overflowX: "auto" }}>
            <div style={{ padding: "0.8rem 1.1rem", borderBottom: "1px solid var(--border)", fontSize: "var(--t-sm)", fontWeight: 700 }}>Priced data requests</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--t-xs)" }}>
              <tbody>
                {(fin?.data_requests ?? []).map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                    <td style={{ padding: "7px 10px" }}>{r.full_name}{r.organization ? ` · ${r.organization}` : ""}</td>
                    <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{Number(r.price_ngn) === 0 ? "waived" : naira(Number(r.price_ngn))}</td>
                    <td style={{ padding: "7px 10px", fontWeight: 700, color: r.status === "paid" || r.status === "fulfilled" ? "var(--green)" : "var(--ink-4)" }}>{r.status}</td>
                  </tr>
                ))}
                {(fin?.data_requests?.length ?? 0) === 0 && <tr><td style={{ padding: "1rem", color: "var(--ink-5)" }}>No priced requests yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
