"use client";

// ── /necal — the public pathway explorer ────────────────────────────────────
// Authoring stays gated; PUBLISHED pathways are public and checkable by
// anyone. This is the resolution of the open-data tension the platform
// settled on: the tool is restricted, its published outputs are not.

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { SkeletonCards, EmptyState } from "@/components/ui/Loading";

type Row = { id: number; name: string; published_at: string; horizon: number | null; preset: string | null };

export default function NecalExplorerPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/necal/published").then((r) => (r.ok ? r.json() : [])).then(setRows).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
    <Navbar active="graph" />
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2.5rem 1.5rem" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.375rem" }}>NECAL2050 · Published Pathways</div>
          <h1 style={{ fontSize: "1.7rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Energy Pathway Explorer</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--ink-3)", marginTop: "0.5rem", maxWidth: 640, lineHeight: 1.6 }}>
            Pathways for Nigeria&apos;s power sector, published from the National Energy Calculator by the bodies that
            plan. Every pathway is read-only and checkable: it carries the anchor it was computed against, so its
            figures reproduce exactly for any reader. The authoring tool itself is held by planning institutions.
          </p>
        </div>

        {loading ? (
          <SkeletonCards rows={2} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No pathways published yet"
            body="Planners publish pathways from the National Energy Calculator. When the first one is published it appears here, frozen against the data it was computed from." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {rows.map((r) => (
              <Link key={r.id} href={`/necal/${r.id}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1.1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", cursor: "pointer", transition: "border-color 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--green)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>{r.name}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--ink-4)", marginTop: 4 }}>
                      To {r.horizon ?? "—"} · published {new Date(r.published_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
                    </div>
                  </div>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--green)" }}>Open →</span>
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
