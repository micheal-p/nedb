"use client";

// One working paper, rendered as a manuscript: abstract, findings with the
// figures each rests on, method, tables, caveats, and a data availability
// statement naming the frozen vintage and its checksum. Printable as-is.

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { TIERS, type PenaTier } from "@/lib/pena";

type Finding = { heading: string; body: string; basis: string; weight: "headline" | "supporting" };
type Paper = {
  paper_no: string; title: string; authors: string | null; status: string;
  published_at: string | null;
  vintage: { label: string; checksum: string } | null;
  body: {
    generated_at: string;
    assessment: { slug: string; title: string };
    summary: string;
    findings: Finding[];
    caveats: string[];
    methods: Record<string, string>;
    aggregates: {
      total_responses: number;
      stats: { avg_income: number | null; median_income: number | null; avg_light_hours: number | null; avg_energy_expense: number | null; avg_burden_pct: number | null } | null;
      tier_distribution: { tier: string; count: number }[] | null;
      energy_sources: { name: string; count: number }[];
      by_state: { name: string; count: number; avg_income: number | null; avg_light_hours: number | null; avg_energy_expense: number | null; tiers: number[] }[];
    };
  };
};

const naira = (v: number | null | undefined) => (v == null ? "—" : `₦${Math.round(v).toLocaleString()}`);

export default function PaperClient() {
  const { no } = useParams<{ no: string }>();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/papers/${no}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPaper)
      .catch(() => setFailed(true));
  }, [no]);

  if (failed) return (<><Navbar active="papers" /><div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "var(--ink-4)", fontSize: "0.85rem" }}>Paper not found.</div><Footer /></>);
  if (!paper) return (<><Navbar active="papers" /><div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "var(--ink-5)", fontSize: "0.85rem" }}>Loading…</div><Footer /></>);

  const b = paper.body;
  const date = paper.published_at ?? b.generated_at;
  const cite = `${paper.authors ?? "Nigeria Energy Data Bank"} (${new Date(date).getFullYear()}). ${paper.title}. NEDB Working Paper ${paper.paper_no}, Energy Commission of Nigeria${paper.vintage ? `, data vintage ${paper.vintage.label}` : ""}.`;

  return (
    <>
    <Navbar active="papers" />
    <div className="wp-page" style={{ minHeight: "100vh", background: "var(--surface)", padding: "2.5rem 1.5rem" }}>
      <div className="wp-doc" style={{ maxWidth: 760, margin: "0 auto", background: "var(--surface-white)", border: "1px solid var(--border)", padding: "3rem 3.25rem" }}>

        {/* Print — screen only. window.print() with the print reset above
            yields the A4 document; no PDF library needed. */}
        <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: "1rem" }}>
          <button onClick={() => window.print()} className="btn btn-secondary btn-sm">Print / Save as PDF</button>
        </div>

        {/* Masthead */}
        <div style={{ borderBottom: "2px solid var(--ink)", paddingBottom: "1.25rem", marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)" }}>
            <span>NEDB Working Paper Series</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>{paper.paper_no}</span>
          </div>
          <h1 style={{ fontSize: "1.55rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", lineHeight: 1.3, margin: "0.75rem 0 0.5rem" }}>{paper.title}</h1>
          <div style={{ fontSize: "0.78rem", color: "var(--ink-3)" }}>
            {paper.authors ?? "Nigeria Energy Data Bank"} · {new Date(date).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
            {paper.status !== "published" && <span style={{ marginLeft: 10, color: "var(--red)", fontWeight: 700 }}>DRAFT — NOT PUBLISHED</span>}
          </div>
        </div>

        {/* Abstract */}
        <div style={{ marginBottom: "1.75rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: 6 }}>Abstract</div>
          <p style={{ fontSize: "0.86rem", color: "var(--ink-2)", lineHeight: 1.75, margin: 0 }}>{b.summary}</p>
        </div>

        {/* Findings */}
        <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: 6 }}>Findings</div>
        {b.findings.map((f, i) => (
          <div key={i} style={{ marginBottom: "1.4rem", paddingLeft: f.weight === "supporting" ? "1rem" : 0, borderLeft: f.weight === "supporting" ? "2px solid var(--border)" : "none" }}>
            <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{i + 1}. {f.heading}</div>
            <p style={{ fontSize: "0.84rem", color: "var(--ink-2)", lineHeight: 1.75, margin: "0 0 0.4rem" }}>{f.body}</p>
            <div style={{ fontSize: "0.7rem", color: "var(--ink-4)", fontFamily: "var(--font-mono)" }}>Basis: {f.basis}</div>
          </div>
        ))}

        {/* Tables */}
        {b.aggregates.tier_distribution && (
          <div style={{ margin: "1.75rem 0" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: 6 }}>Table 1 · Tier distribution</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead><tr style={{ borderBottom: "1.5px solid var(--ink)" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>Tier</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>Responses</th>
                </tr></thead>
                <tbody>
                  {b.aggregates.tier_distribution.map((t) => (
                    <tr key={t.tier} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 8px" }}>{t.tier} — {TIERS[t.tier as PenaTier]?.label ?? t.tier}</td>
                      <td style={{ textAlign: "right", padding: "6px 8px", fontFamily: "var(--font-mono)" }}>{t.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {b.aggregates.by_state.length > 0 && (
          <div style={{ margin: "1.75rem 0" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: 6 }}>Table 2 · States above the reporting floor</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead><tr style={{ borderBottom: "1.5px solid var(--ink)" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>State</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>n</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>Avg income</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>Avg supply (h/day)</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>Avg energy spend</th>
                </tr></thead>
                <tbody>
                  {b.aggregates.by_state.map((s) => (
                    <tr key={s.name} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 8px" }}>{s.name}</td>
                      <td style={{ textAlign: "right", padding: "6px 8px", fontFamily: "var(--font-mono)" }}>{s.count}</td>
                      <td style={{ textAlign: "right", padding: "6px 8px", fontFamily: "var(--font-mono)" }}>{naira(s.avg_income)}</td>
                      <td style={{ textAlign: "right", padding: "6px 8px", fontFamily: "var(--font-mono)" }}>{s.avg_light_hours?.toFixed(1) ?? "—"}</td>
                      <td style={{ textAlign: "right", padding: "6px 8px", fontFamily: "var(--font-mono)" }}>{naira(s.avg_energy_expense)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Method */}
        <div style={{ margin: "1.75rem 0" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: 6 }}>Method</div>
          {Object.entries(b.methods).map(([k, v]) => (
            <p key={k} style={{ fontSize: "0.8rem", color: "var(--ink-2)", lineHeight: 1.7, margin: "0 0 0.5rem" }}>
              <strong style={{ textTransform: "capitalize" }}>{k.replace(/_/g, " ")}.</strong> {v}
            </p>
          ))}
        </div>

        {/* Caveats */}
        <div style={{ margin: "1.75rem 0" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: 6 }}>Limitations</div>
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {b.caveats.map((c, i) => <li key={i} style={{ fontSize: "0.8rem", color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 4 }}>{c}</li>)}
          </ul>
        </div>

        {/* Data availability */}
        <div style={{ margin: "1.75rem 0", background: "var(--surface)", border: "1px solid var(--border)", padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--green)", marginBottom: 6 }}>Data availability</div>
          <p style={{ fontSize: "0.78rem", color: "var(--ink-2)", lineHeight: 1.7, margin: 0 }}>
            The aggregates behind every figure are open data: {" "}
            <Link href={`/assessments/${b.assessment.slug}`} style={{ color: "var(--green)" }}>{b.assessment.title}</Link>.
            {paper.vintage ? (
              <> This paper is computed against frozen data vintage {" "}
              <Link href="/data/vintages" style={{ color: "var(--green)" }}>{paper.vintage.label}</Link>{" "}
              (sha256:<span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem" }}>{paper.vintage.checksum.slice(0, 16)}…</span>),
              so its figures are reproducible from that exact edition of the data bank.</>
            ) : (
              <> Generated {new Date(b.generated_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })} from the live aggregates.</>
            )}
          </p>
        </div>

        {/* Citation */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", fontSize: "0.72rem", color: "var(--ink-4)", lineHeight: 1.7 }}>
          Cite as: {cite}
        </div>
      </div>
    </div>
    <Footer />
    </>
  );
}
