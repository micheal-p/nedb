"use client";

// ── NecalGate ───────────────────────────────────────────────────────────────
// NECAL2050 is a national energy planning instrument. Its outputs — capacity to
// build, capital required, emissions committed to — are the kind of figures that
// get quoted in cabinet papers, so it is held by the bodies that actually plan,
// not by everyone with an account.
//
// This gate does NOT decide anything. It asks the server, which reads the
// profile off the signed token, and then explains the answer. The profile the
// browser holds sits in localStorage where the visitor can edit it, so a client
// side test would be a suggestion rather than a boundary.
//
// It also denies by default: a request that fails, times out, or returns
// anything unexpected lands on the refusal page. The safe direction for a
// restricted instrument is closed.

import { useEffect, useState } from "react";
import Link from "next/link";
import { getFullName, getToken } from "@/lib/auth";

type Answer = { allowed: boolean; reason: string | null; profile_label: string | null; holders: string[] };

export default function NecalGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "allowed" | "denied">("checking");
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    let live = true;

    (async () => {
      try {
        const token = getToken();
        const res = await fetch("/api/necal/access", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });
        const body = (await res.json()) as Partial<Answer>;
        if (!live) return;

        if (res.ok && body?.allowed === true) {
          setAnswer(body as Answer);
          setState("allowed");
        } else {
          setAnswer({
            allowed: false,
            reason: body?.reason ?? "Planning access could not be confirmed.",
            profile_label: body?.profile_label ?? null,
            holders: body?.holders ?? [],
          });
          setState("denied");
        }
      } catch {
        if (!live) return;
        // Network failure is not a grant.
        setAnswer({
          allowed: false,
          reason: "Planning access could not be checked. Nothing is opened until it can be.",
          profile_label: null,
          holders: [],
        });
        setState("denied");
      }
    })();

    return () => { live = false; };
  }, []);

  if (state === "checking") {
    return <div style={{ padding: "2rem", color: "var(--ink-5)", fontSize: "var(--t-base)" }}>Checking access…</div>;
  }

  if (state === "denied") {
    const holders = answer?.holders ?? [];

    return (
      <div style={{ maxWidth: 620, margin: "3rem auto", padding: "0 1.25rem" }}>
        <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderTop: "3px solid var(--amber)", padding: "1.75rem" }}>
          <div className="eyebrow" style={{ color: "var(--amber)" }}>Restricted instrument</div>
          <h1 style={{ fontSize: "var(--t-xl)", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>
            NECAL2050 is not open to your dashboard
          </h1>
          <p style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.75, marginBottom: "1rem" }}>
            You are signed in as <strong style={{ color: "var(--ink)" }}>{getFullName() || "a staff user"}</strong>
            {answer?.profile_label ? <> on the <strong style={{ color: "var(--ink)" }}>{answer.profile_label}</strong> dashboard</> : null}.
            {" "}The National Energy Calculator produces the capacity, capital and emissions figures that go into national
            planning documents, so it is held by the bodies with a planning mandate rather than issued with every account.
          </p>
          {answer?.reason ? (
            <div style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", padding: "0.85rem 1rem", marginBottom: "1rem" }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Reason given</div>
              <div style={{ fontSize: "var(--t-base)", color: "var(--ink-2)", lineHeight: 1.7 }}>{answer.reason}</div>
            </div>
          ) : null}
          {holders.length ? (
            <div style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", padding: "0.85rem 1rem", marginBottom: "1.25rem" }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Currently held by</div>
              <div style={{ fontSize: "var(--t-base)", color: "var(--ink-2)", lineHeight: 1.7 }}>{holders.join(" · ")}</div>
            </div>
          ) : null}
          <p style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.75, marginBottom: "1.25rem" }}>
            If your work requires it, ask an administrator to move your account onto a planning profile, or request one
            through the access pipeline. The request is reviewed against your organisation&apos;s remit.
          </p>
          <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
            <Link href="/portal" className="btn btn-primary">Request planning access</Link>
            <Link href="/data-point/dashboard" className="btn btn-secondary">Back to your dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
