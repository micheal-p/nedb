"use client";

// Magic-link landing page — /v/<verify_token>
// Confirms a pending PENA response. POST (not GET-side-effect) so email
// scanners that prefetch links don't accidentally burn the token — the
// respondent taps one button.

import { useState } from "react";
import { useParams } from "next/navigation";

type Result = { status: "verified" | "already" | "expired" } | { error: string };

export default function VerifyResponsePage() {
  const { vtoken } = useParams<{ vtoken: string }>();
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch(`/api/pena/verify/${vtoken}`, { method: "POST" });
      const j = await res.json();
      setResult(res.ok ? j : { error: j.error ?? "Verification failed." });
    } catch {
      setResult({ error: "Network error — please tap the button again." });
    } finally {
      setBusy(false);
    }
  }

  const done = result && !("error" in result);

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "3rem 1rem", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
      <div style={{ maxWidth: 480, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "1.25rem", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--green)" }}>
          Nigeria Energy Data Bank · PENA
        </div>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "2.5rem 2rem", textAlign: "center" }}>
          {!result ? (
            <>
              <h1 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--ink)", margin: "0 0 0.5rem" }}>Confirm your response</h1>
              <p style={{ fontSize: "0.82rem", color: "var(--ink-4)", lineHeight: 1.6, margin: "0 0 1.5rem" }}>
                Tap the button below to confirm the assessment response submitted with your email address.
              </p>
              <button onClick={confirm} disabled={busy}
                style={{ padding: "0.8rem 2rem", background: busy ? "var(--ink-5)" : "var(--green)", color: "#fff", border: "none", borderRadius: 8, fontSize: "0.9rem", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}>
                {busy ? "Confirming…" : "Confirm my response"}
              </button>
            </>
          ) : "error" in result ? (
            <>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Link problem</div>
              <div style={{ fontSize: "0.82rem", color: "var(--ink-4)", lineHeight: 1.6 }}>{result.error}</div>
            </>
          ) : result.status === "expired" ? (
            <>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Link expired</div>
              <div style={{ fontSize: "0.82rem", color: "var(--ink-4)", lineHeight: 1.6 }}>
                This confirmation link has expired, so the response was not counted. If you still want to
                take part, please fill the assessment again from the original link.
              </div>
            </>
          ) : (
            <>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--green-tint)", border: "2px solid var(--green)", color: "var(--green)", fontSize: "1.4rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>✓</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
                {result.status === "already" ? "Already confirmed" : "Response confirmed"}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--ink-4)", lineHeight: 1.6 }}>
                {done && result.status === "already"
                  ? "This response was confirmed earlier — nothing more to do."
                  : "Thank you for contributing to Nigeria's energy planning. You can close this page."}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
