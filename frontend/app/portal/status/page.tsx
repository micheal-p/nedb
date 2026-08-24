"use client";

// Public status check for a dashboard access request. Requires the reference
// AND the email it was filed under, so no one can probe other applications.

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

type StatusResult = { reference: string; status: string; submitted_at: string; reviewed_at: string | null };

const STATUS_TEXT: Record<string, { label: string; tone: "green" | "amber" | "red"; note: string }> = {
  pending:  { label: "Under review",  tone: "amber", note: "Your request is in the review queue. Requests are reviewed within 5 working days of submission." },
  approved: { label: "Approved",      tone: "green", note: "Your request was approved. Login credentials were sent to the email you applied with." },
  rejected: { label: "Not approved",  tone: "red",   note: "Your request was not approved. You may submit a new request with additional justification." },
};

export default function AccessRequestStatusPage() {
  const [ref, setRef]       = useState("");
  const [email, setEmail]   = useState("");
  const [result, setResult] = useState<StatusResult | null>(null);
  const [error, setError]   = useState("");
  const [busy, setBusy]     = useState(false);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(""); setResult(null);
    try {
      const r = await fetch(`/api/access-requests/status?ref=${encodeURIComponent(ref.trim())}&email=${encodeURIComponent(email.trim())}`);
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Check failed."); return; }
      setResult(j);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const st = result ? STATUS_TEXT[result.status] ?? { label: result.status, tone: "amber" as const, note: "" } : null;
  const toneColor = st?.tone === "green" ? "var(--green)" : st?.tone === "red" ? "var(--red)" : "var(--amber)";

  return (
    <>
      <Navbar />
      <main style={{ background: "var(--surface)", padding: "2.5rem 0 5rem", minHeight: "60vh" }}>
        <div className="page-wrap" style={{ maxWidth: 560 }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: "0.3rem" }}>
            <Link href="/portal" style={{ color: "var(--green)" }}>Dashboard Access</Link> / Status
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.4rem" }}>Check an Access Request</h1>
          <p style={{ fontSize: "0.82rem", color: "var(--ink-4)", marginBottom: "1.75rem", lineHeight: 1.6 }}>
            Enter the reference from your submission receipt (it looks like NEDB/AR/2026/00042) and the email you applied with.
          </p>

          <form onSubmit={check} style={{ background: "var(--surface-white)", border: "1px solid var(--border)", padding: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "1rem" }}>
              <span className="form-label">Reference *</span>
              <input className="form-input" required value={ref} onChange={(e) => setRef(e.target.value)} placeholder="NEDB/AR/2026/00042" style={{ fontFamily: "var(--font-mono)" }} />
            </label>
            <label style={{ display: "block", marginBottom: "1.25rem" }}>
              <span className="form-label">Email used on the request *</span>
              <input className="form-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="a.bello@ecn.gov.ng" />
            </label>
            {error && <div style={{ padding: "0.7rem 1rem", background: "var(--red-tint)", border: "1px solid var(--red)", fontSize: "0.8rem", color: "var(--red)", marginBottom: "1rem" }}>{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: "100%" }}>{busy ? "Checking…" : "Check Status"}</button>
          </form>

          {result && st && (
            <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderLeft: `3px solid ${toneColor}`, padding: "1.25rem 1.5rem", marginTop: "1.25rem" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--ink-4)", marginBottom: 4 }}>{result.reference}</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: toneColor, marginBottom: 6 }}>{st.label}</div>
              <p style={{ fontSize: "0.8rem", color: "var(--ink-3)", lineHeight: 1.6, margin: 0 }}>{st.note}</p>
              <div style={{ fontSize: "0.7rem", color: "var(--ink-5)", marginTop: 8 }}>
                Submitted {new Date(result.submitted_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
                {result.reviewed_at ? ` · Reviewed ${new Date(result.reviewed_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}` : ""}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
