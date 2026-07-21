"use client";

// PENA assessment list — Data Point side. Staff pick an assessment to open
// its insights; form creation/editing lives in the admin dashboard.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isLoggedIn, getRole } from "@/lib/auth";

type PenaForm = {
  id: number; slug: string; title: string; description: string | null;
  status: "draft" | "open" | "closed"; response_count: number; created_at: string;
};

export default function PenaListPage() {
  const router = useRouter();
  const [forms, setForms] = useState<PenaForm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/data-point/login?redirect=/data-point/pena"); return; }
    fetch("/api/pena/forms", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setForms)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.25rem" }}>Data Point · PENA</div>
            <h1 style={{ fontSize: "1.5rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Energy Assessments</h1>
            <p style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginTop: "0.25rem" }}>Field survey responses, tier classification and geographic insight.</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <Link href="/data-point/dashboard" style={{ fontSize: "0.78rem", color: "var(--ink-4)", textDecoration: "none" }}>← Dashboard</Link>
            {getRole() === "admin" && (
              <Link href="/admin/pena" style={{ padding: "0.6rem 1.25rem", background: "var(--green)", color: "#fff", borderRadius: 6, fontSize: "0.82rem", fontWeight: 700, textDecoration: "none" }}>
                Manage Assessments
              </Link>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--ink-5)", fontSize: "0.82rem" }}>Loading…</div>
        ) : forms.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem", background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", color: "var(--ink-4)", fontSize: "0.82rem" }}>
            No assessments yet{getRole() === "admin" ? " — create one from the admin dashboard." : "."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {forms.map((f) => (
              <Link key={f.id} href={`/data-point/pena/${f.id}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "1.2rem 1.4rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s", boxShadow: "0 1px 3px rgba(16,24,16,0.05)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--green)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(16,24,16,0.09)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(16,24,16,0.05)"; }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.25rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--ink)" }}>{f.title}</span>
                      <span style={{ fontSize: "0.6rem", fontWeight: 700, padding: "1px 7px", borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.06em", background: f.status === "open" ? "var(--green-tint)" : "var(--surface)", color: f.status === "open" ? "var(--green)" : "var(--ink-4)", border: "1px solid var(--border)" }}>{f.status}</span>
                    </div>
                    {f.description && <div style={{ fontSize: "0.76rem", color: "var(--ink-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.5 }}>{f.description}</div>}
                  </div>
                  <div style={{ textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)" }}>{f.response_count.toLocaleString()}</div>
                    <div style={{ fontSize: "0.62rem", color: "var(--ink-5)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Responses</div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
