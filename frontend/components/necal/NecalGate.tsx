"use client";

// ── NecalGate ───────────────────────────────────────────────────────────────
// NECAL2050 is a national energy planning instrument. Its outputs — capacity to
// build, capital required, emissions committed to — are the kind of figures that
// get quoted in cabinet papers, so it is held by the bodies that actually plan,
// not by everyone with an account.
//
// A refusal here names what is missing and how to get it, rather than showing a
// blank page.

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboardProfile, getRole, getFullName, isAdminRole } from "@/lib/auth";
import { PROFILE_MAP, allowedViews } from "@/lib/dashboard-profiles";

export default function NecalGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "allowed" | "denied">("checking");
  const [profileLabel, setProfileLabel] = useState("");

  useEffect(() => {
    const key = getDashboardProfile() || "executive";
    const profile = PROFILE_MAP[key] ?? PROFILE_MAP.executive;
    setProfileLabel(profile.label);
    // Administrators can always reach it — somebody has to be able to check the
    // instrument itself.
    setState(allowedViews(profile).includes("necal") || isAdminRole(getRole()) ? "allowed" : "denied");
  }, []);

  if (state === "checking") {
    return <div style={{ padding: "2rem", color: "var(--ink-5)", fontSize: "var(--t-base)" }}>Checking access…</div>;
  }

  if (state === "denied") {
    const holders = Object.values(PROFILE_MAP)
      .filter((p) => p.extraViews?.includes("necal"))
      .map((p) => p.label);

    return (
      <div style={{ maxWidth: 620, margin: "3rem auto", padding: "0 1.25rem" }}>
        <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderTop: "3px solid var(--amber)", padding: "1.75rem" }}>
          <div className="eyebrow" style={{ color: "var(--amber)" }}>Restricted instrument</div>
          <h1 style={{ fontSize: "var(--t-xl)", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>
            NECAL2050 is not open to your dashboard
          </h1>
          <p style={{ fontSize: "var(--t-base)", color: "var(--ink-3)", lineHeight: 1.75, marginBottom: "1rem" }}>
            You are signed in as <strong style={{ color: "var(--ink)" }}>{getFullName() || "a staff user"}</strong> on the{" "}
            <strong style={{ color: "var(--ink)" }}>{profileLabel}</strong> dashboard. The National Energy Calculator produces
            the capacity, capital and emissions figures that go into national planning documents, so it is held by the bodies
            with a planning mandate rather than issued with every account.
          </p>
          <div style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", padding: "0.85rem 1rem", marginBottom: "1.25rem" }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Currently held by</div>
            <div style={{ fontSize: "var(--t-base)", color: "var(--ink-2)", lineHeight: 1.7 }}>
              {holders.join(" · ")}
            </div>
          </div>
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
