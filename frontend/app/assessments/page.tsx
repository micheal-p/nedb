"use client";

// Public open-data listing of published PENA assessments.

import { useState, useEffect } from "react";
import Link from "next/link";

type PubForm = {
  slug: string; title: string; description: string | null;
  status: string; created_at: string; response_count: number;
};

export default function AssessmentsIndexPage() {
  const [forms, setForms] = useState<PubForm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pena/public")
      .then((r) => (r.ok ? r.json() : []))
      .then(setForms)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2.5rem 1.5rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.375rem" }}>Open Data · PENA</div>
          <h1 style={{ fontSize: "1.7rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Energy Needs Assessments</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--ink-3)", marginTop: "0.5rem", maxWidth: 640, lineHeight: 1.6 }}>
            Anonymised results from field energy assessments across Nigeria — household income, electricity supply hours,
            energy spending and environmental–economic tiers, aggregated by state and Local Government Area.
            Personal data is withheld under the Nigeria Data Protection Act 2023.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--ink-5)", fontSize: "0.82rem" }}>Loading…</div>
        ) : forms.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem", background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", color: "var(--ink-4)", fontSize: "0.82rem" }}>
            No published assessments yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {forms.map((f) => (
              <Link key={f.slug} href={`/assessments/${f.slug}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1.1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", cursor: "pointer", transition: "border-color 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--green)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.2rem" }}>
                      <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--ink)" }}>{f.title}</span>
                      {f.status === "open" && <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "var(--green-tint)", color: "var(--green)", border: "1px solid var(--green-line)", padding: "1px 6px", borderRadius: 3 }}>COLLECTING</span>}
                    </div>
                    {f.description && <div style={{ fontSize: "0.75rem", color: "var(--ink-4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.description}</div>}
                  </div>
                  <div style={{ textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)" }}>{f.response_count.toLocaleString()}</div>
                    <div style={{ fontSize: "0.62rem", color: "var(--ink-5)", textTransform: "uppercase" }}>Responses</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
