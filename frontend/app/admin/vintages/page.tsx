"use client";

// Admin console for data vintages: freeze a new edition, publish or withdraw,
// set prices, and watch the orders. The snapshot itself can never be edited —
// the database trigger refuses — which is exactly the promise buyers rely on.

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getRole, isAdminRole, isLoggedIn, getTokenFresh } from "@/lib/auth";

type Vintage = {
  id: number; label: string; title: string; notes: string | null;
  checksum: string; price_ngn: number | null; is_published: boolean;
  created_by: string; created_at: string;
  manifest: { record_count?: number; series_count?: number; assessment_count?: number } | null;
};
type Order = {
  reference: string; email: string; buyer_name: string | null; organisation: string | null;
  amount_ngn: number; status: string; created_at: string; paid_at: string | null;
  vintage: { label: string; title: string } | null;
};

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

export default function AdminVintagesPage() {
  const router = useRouter();
  const [vintages, setVintages] = useState<Vintage[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [price, setPrice] = useState("");

  const load = useCallback(async () => {
    const [v, o] = await Promise.all([
      authed("/api/vintages").then((r) => (r.ok ? r.json() : [])),
      authed("/api/vintages/orders").then((r) => (r.ok ? r.json() : [])),
    ]);
    setVintages(v); setOrders(o); setLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/admin/vintages"); return; }
    if (!isAdminRole(getRole())) { router.replace("/data-point/dashboard"); return; }
    load();
  }, [router, load]);

  async function freeze() {
    setBusy(true); setMsg("");
    const r = await authed("/api/vintages", { method: "POST", body: JSON.stringify({ title, notes, price_ngn: price || null }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error ?? "Freezing failed."); return; }
    setTitle(""); setNotes(""); setPrice("");
    setMsg(`Frozen ${j.label} — sha256:${String(j.checksum).slice(0, 16)}… It is unpublished until you publish it.`);
    load();
  }

  async function patch(label: string, body: Record<string, unknown>, note: string) {
    setBusy(true); setMsg("");
    const r = await authed(`/api/vintages/${encodeURIComponent(label)}`, { method: "PATCH", body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error ?? "Update failed."); return; }
    setMsg(note); load();
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.25rem" }}>Admin · Editions of Record</div>
            <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Data Vintages</h1>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginTop: "0.25rem", maxWidth: 640 }}>
              Freeze the published data bank into a checksummed edition. Once frozen, the content cannot change; only the
              title, notes, price and publication state can. The public catalogue is at <Link href="/data/vintages" style={{ color: "var(--green)" }}>/data/vintages</Link>.
            </p>
          </div>
          <Link href="/admin" style={{ fontSize: "0.78rem", color: "var(--ink-4)", textDecoration: "none" }}>← Admin</Link>
        </div>

        {msg && <div style={{ fontSize: "0.8rem", color: "var(--ink-2)", background: "#fff", border: "1px solid var(--border)", padding: "0.6rem 1rem", marginBottom: "1rem" }}>{msg}</div>}

        {/* Freeze */}
        <div style={{ background: "#fff", border: "1px solid var(--border)", padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.75rem" }}>Freeze a new vintage</div>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ flex: "2 1 260px" }}>
              <span className="form-label">Title</span>
              <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="September 2026 edition" />
            </label>
            <label style={{ flex: "1 1 160px" }}>
              <span className="form-label">Price ₦ (empty = free)</span>
              <input className="form-input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0" />
            </label>
            <button className="btn btn-primary btn-sm" disabled={busy || !title.trim()} onClick={freeze}>{busy ? "Freezing…" : "Freeze now"}</button>
          </div>
          <label style={{ display: "block", marginTop: "0.6rem" }}>
            <span className="form-label">Notes (shown in the catalogue)</span>
            <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What is new in this edition" />
          </label>
        </div>

        {/* Vintages */}
        {loading ? <div style={{ textAlign: "center", padding: "2rem", color: "var(--ink-5)", fontSize: "0.82rem" }}>Loading…</div> : (
          <div style={{ background: "#fff", border: "1px solid var(--border)", marginBottom: "1.5rem", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead><tr style={{ borderBottom: "1.5px solid var(--ink)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>Label</th><th style={{ padding: "8px 12px" }}>Title</th>
                <th style={{ padding: "8px 12px" }}>Contents</th><th style={{ padding: "8px 12px" }}>Price</th>
                <th style={{ padding: "8px 12px" }}>State</th><th style={{ padding: "8px 12px" }} />
              </tr></thead>
              <tbody>
                {vintages.map((v) => (
                  <tr key={v.label} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--green)" }}>{v.label}</td>
                    <td style={{ padding: "8px 12px" }}>
                      {v.title}
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", color: "var(--ink-5)" }}>sha256:{v.checksum.slice(0, 24)}…</div>
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--ink-3)" }}>
                      {v.manifest?.series_count ?? "—"} series · {v.manifest?.record_count ?? "—"} records · {v.manifest?.assessment_count ?? "—"} assessments
                    </td>
                    <td style={{ padding: "8px 12px" }}>{v.price_ngn ? `₦${Number(v.price_ngn).toLocaleString()}` : "Free"}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px", borderRadius: 3, background: v.is_published ? "var(--green-tint)" : "var(--surface)", color: v.is_published ? "var(--green)" : "var(--ink-4)", border: "1px solid var(--border)" }}>
                        {v.is_published ? "PUBLISHED" : "UNPUBLISHED"}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                      <a href={`/api/vintages/${encodeURIComponent(v.label)}/download`} style={{ fontSize: "0.72rem", color: "var(--ink-3)", marginRight: 12 }}>Download</a>
                      <button className="btn btn-secondary btn-sm" disabled={busy}
                        onClick={() => patch(v.label, { is_published: !v.is_published }, v.is_published ? `${v.label} withdrawn from the catalogue.` : `${v.label} published.`)}>
                        {v.is_published ? "Withdraw" : "Publish"}
                      </button>
                    </td>
                  </tr>
                ))}
                {vintages.length === 0 && <tr><td colSpan={6} style={{ padding: "1.5rem", textAlign: "center", color: "var(--ink-5)" }}>No vintages frozen yet.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Orders */}
        <div style={{ background: "#fff", border: "1px solid var(--border)", overflowX: "auto" }}>
          <div style={{ padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)", fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)" }}>Orders</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
            <thead><tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>Reference</th><th style={{ padding: "8px 12px" }}>Vintage</th>
              <th style={{ padding: "8px 12px" }}>Buyer</th><th style={{ padding: "8px 12px" }}>Amount</th>
              <th style={{ padding: "8px 12px" }}>Status</th><th style={{ padding: "8px 12px" }}>When</th>
            </tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.reference} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "8px 12px", fontFamily: "var(--font-mono)" }}>{o.reference}</td>
                  <td style={{ padding: "8px 12px" }}>{o.vintage?.label ?? "—"}</td>
                  <td style={{ padding: "8px 12px" }}>{o.buyer_name ?? o.email}{o.organisation ? ` · ${o.organisation}` : ""}</td>
                  <td style={{ padding: "8px 12px" }}>₦{Number(o.amount_ngn).toLocaleString()}</td>
                  <td style={{ padding: "8px 12px", fontWeight: 700, color: o.status === "paid" ? "var(--green)" : "var(--ink-4)" }}>{o.status}</td>
                  <td style={{ padding: "8px 12px", color: "var(--ink-4)" }}>{new Date(o.created_at).toLocaleString("en-NG")}</td>
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={6} style={{ padding: "1.5rem", textAlign: "center", color: "var(--ink-5)" }}>No orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
