"use client";

// Public catalogue of frozen data vintages — the citable, checksummed
// editions of the data bank. Free vintages download directly; priced ones go
// through the order flow and come back here with ?ref=… for verification.

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import { SkeletonCards, EmptyState } from "@/components/ui/Loading";
import Footer from "@/components/layout/Footer";

type Vintage = {
  label: string; title: string; notes: string | null;
  checksum: string; price_ngn: number | null; created_at: string;
  manifest: {
    frozen_at?: string; series_count?: number; record_count?: number;
    assessment_count?: number; series_withheld?: number;
  } | null;
};

const naira = (v: number) => `₦${Math.round(v).toLocaleString()}`;

function CatalogueBody() {
  const [vintages, setVintages] = useState<Vintage[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);   // label with the open order form
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [busy, setBusy] = useState(false);
  const [orderMsg, setOrderMsg] = useState<string | null>(null);

  // Payment return leg: ?ref=… → verify server-side → download token
  const sp = useSearchParams();
  const [verified, setVerified] = useState<{ label: string; token: string; reference: string } | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/vintages").then((r) => (r.ok ? r.json() : [])).then(setVintages).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const ref = sp.get("ref");
    if (!ref) return;
    setVerifyMsg("Confirming your payment…");
    fetch(`/api/vintages/verify?ref=${encodeURIComponent(ref)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.status === "paid" && j.download_token) {
          setVerified({ label: j.label, token: j.download_token, reference: j.reference });
          setVerifyMsg(null);
        } else {
          setVerifyMsg(j.error ?? `Payment not confirmed yet (${j.status ?? "unknown"}). If you completed checkout, reload this page in a moment.`);
        }
      })
      .catch(() => setVerifyMsg("Could not reach the verification service — reload to try again."));
  }, [sp]);

  const order = useCallback(async (label: string) => {
    setBusy(true); setOrderMsg(null);
    try {
      const r = await fetch(`/api/vintages/${encodeURIComponent(label)}/order`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, buyer_name: name, organisation: org }),
      });
      const j = await r.json();
      if (!r.ok) { setOrderMsg(j.error ?? "Order failed."); return; }
      if (j.authorization_url) { window.location.href = j.authorization_url; return; }
      setOrderMsg(j.message ?? `Order ${j.reference} recorded.`);
    } catch {
      setOrderMsg("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }, [email, name, org]);

  return (
    <>
    <Navbar active="vintages" />
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2.5rem 1.5rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.375rem" }}>Official Statistics · Editions of Record</div>
          <h1 style={{ fontSize: "1.7rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Data Vintages</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--ink-3)", marginTop: "0.5rem", maxWidth: 640, lineHeight: 1.6 }}>
            A vintage is the data bank frozen at a moment: every published series and every published
            assessment&apos;s anonymised aggregates, captured as one document that never changes afterwards. The
            live figures keep moving; a vintage is what you cite, audit against, and build on. Verify any
            download with <code style={{ fontSize: "0.78rem" }}>shasum -a 256 nedb-&lt;label&gt;.json</code> — it must
            reproduce the checksum printed here.
          </p>
        </div>

        {verifyMsg && <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderLeft: "3px solid var(--amber, #B45309)", padding: "0.9rem 1.15rem", marginBottom: "1rem", fontSize: "0.82rem", color: "var(--ink-2)" }}>{verifyMsg}</div>}
        {verified && (
          <div style={{ background: "var(--green-tint)", border: "1px solid var(--green-line)", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--green-deep, var(--green))" }}>Payment confirmed — order {verified.reference}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--ink-3)", margin: "0.35rem 0 0.75rem" }}>
              Your download link is tied to this purchase. Keep it; it keeps working.
            </div>
            <a href={`/api/vintages/${encodeURIComponent(verified.label)}/download?token=${verified.token}`}
              className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
              Download {verified.label}
            </a>
          </div>
        )}

        {loading ? (
          <SkeletonCards rows={2} />
        ) : vintages.length === 0 ? (
          <EmptyState
            title="No editions published yet"
            body="A vintage is frozen and published by the Data Point team. Once the first edition of record appears here, it never changes, and its checksum lets any download be verified." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            {vintages.map((v) => {
              const priced = v.price_ngn != null && Number(v.price_ngn) > 0;
              const m = v.manifest ?? {};
              return (
                <div key={v.label} style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1.25rem 1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div style={{ minWidth: 260, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", fontWeight: 700, color: "var(--green)" }}>{v.label}</span>
                        <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>{v.title}</span>
                      </div>
                      {v.notes && <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", margin: "0.4rem 0 0", lineHeight: 1.6, maxWidth: 560 }}>{v.notes}</p>}
                      <div style={{ fontSize: "0.72rem", color: "var(--ink-4)", marginTop: "0.5rem" }}>
                        Frozen {new Date(m.frozen_at ?? v.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
                        {" · "}{m.series_count ?? "—"} series · {m.record_count ?? "—"} records · {m.assessment_count ?? "—"} assessments
                        {m.series_withheld ? ` · ${m.series_withheld} series withheld from publication` : ""}
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.64rem", color: "var(--ink-5)", marginTop: "0.4rem", wordBreak: "break-all" }}>
                        sha256:{v.checksum}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>
                        {priced ? naira(Number(v.price_ngn)) : "Free"}
                      </div>
                      {priced ? (
                        <button className="btn btn-primary btn-sm" onClick={() => { setBuying(buying === v.label ? null : v.label); setOrderMsg(null); }}>
                          {buying === v.label ? "Close" : "Purchase"}
                        </button>
                      ) : (
                        <a href={`/api/vintages/${encodeURIComponent(v.label)}/download`} className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
                          Download
                        </a>
                      )}
                    </div>
                  </div>

                  {buying === v.label && (
                    <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border-soft, var(--border))", paddingTop: "1rem", display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end" }}>
                      <label style={{ flex: "1 1 220px" }}>
                        <span className="form-label">Email (receives the receipt)</span>
                        <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@organisation.gov.ng" />
                      </label>
                      <label style={{ flex: "1 1 180px" }}>
                        <span className="form-label">Name</span>
                        <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
                      </label>
                      <label style={{ flex: "1 1 180px" }}>
                        <span className="form-label">Organisation (optional)</span>
                        <input className="form-input" value={org} onChange={(e) => setOrg(e.target.value)} />
                      </label>
                      <button className="btn btn-primary btn-sm" disabled={busy || !email} onClick={() => order(v.label)}>
                        {busy ? "Starting…" : "Continue to payment"}
                      </button>
                      {orderMsg && <div style={{ flexBasis: "100%", fontSize: "0.78rem", color: "var(--ink-2)" }}>{orderMsg}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: "2rem", fontSize: "0.72rem", color: "var(--ink-5)", lineHeight: 1.7, maxWidth: 640 }}>
          Cite a vintage as: Nigeria Energy Data Bank, vintage {vintages[0]?.label ?? "v2026-09"} (sha256 prefix),
          Energy Commission of Nigeria. Assessment statistics inside a vintage are k-anonymised aggregates under the
          Nigeria Data Protection Act 2023; no personal data is ever included.
        </div>
      </div>
    </div>
    <Footer />
    </>
  );
}

export default function VintagesPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--surface)" }} />}>
      <CatalogueBody />
    </Suspense>
  );
}
