"use client";

// Public index of the NEDB Working Paper series — reproducible findings
// generated from the open-data aggregates against a frozen vintage.

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

type Paper = {
  paper_no: string; title: string; authors: string | null;
  published_at: string | null; vintage: { label: string; checksum: string } | null;
};

const slugOf = (paperNo: string) => {
  const m = paperNo.match(/NEDB\/WP\/(\d{4})\/(\d+)/);
  return m ? `${m[1]}-${m[2]}` : "";
};

export default function PapersIndexPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/papers").then((r) => (r.ok ? r.json() : [])).then(setPapers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
    <Navbar active="papers" />
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2.5rem 1.5rem" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.375rem" }}>Research · NEDB Working Paper Series</div>
          <h1 style={{ fontSize: "1.7rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Working Papers</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--ink-3)", marginTop: "0.5rem", maxWidth: 620, lineHeight: 1.6 }}>
            Findings from the data bank&apos;s field assessments, written as papers rather than dashboards. Every
            figure is generated from the published aggregates against a named, checksummed data vintage, so any
            reader can recompute the paper from the exact data it cites.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "var(--ink-5)", fontSize: "0.82rem" }}>Loading…</div>
        ) : papers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem", background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", color: "var(--ink-4)", fontSize: "0.82rem" }}>
            No papers published yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {papers.map((p) => (
              <Link key={p.paper_no} href={`/papers/${slugOf(p.paper_no)}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1.1rem 1.25rem", cursor: "pointer", transition: "border-color 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--green)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--green)", fontWeight: 700, marginBottom: 4 }}>{p.paper_no}</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)", lineHeight: 1.4 }}>{p.title}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--ink-4)", marginTop: 6 }}>
                    {p.authors ?? "Nigeria Energy Data Bank"}
                    {p.published_at ? ` · ${new Date(p.published_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}` : ""}
                    {p.vintage ? ` · vintage ${p.vintage.label}` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
    <Footer />
    </>
  );
}
