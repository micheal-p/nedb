"use client";

// ── /data/energy-poverty-index ──────────────────────────────────────────────
// One national number with a method anyone can check: the share of
// classifiable respondents in tiers D and E, per wave. Until a second wave
// exists the page says collecting — the index refuses to invent a trend.

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { SkeletonCards } from "@/components/ui/Loading";

type Fam = {
  root_id: number; title: string; target_population: string | null;
  waves: { wave: number; n_classified: number; epi_pct: number | null }[];
  movement_pp: number | null;
};

export default function EpiPage() {
  const [data, setData] = useState<{ families: Fam[]; publishable: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/epi").then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
    <Navbar active="databank" />
    <main style={{ minHeight: "100vh", background: "var(--surface)", padding: "2.5rem 1.5rem" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.375rem" }}>National Indicator · In Development</div>
          <h1 style={{ fontSize: "1.7rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Energy Poverty Index</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--ink-3)", marginTop: "0.5rem", maxWidth: 640, lineHeight: 1.65 }}>
            The share of assessed households in tiers D and E — short supply combined with a heavy cost burden.
            One wave is a snapshot; the index measures <strong>movement</strong>, so it publishes a trend only when a
            second wave of the same population clears the privacy floor. Until then this page says collecting,
            because inventing a trend is worse than waiting for one.
          </p>
        </div>

        {loading ? <SkeletonCards rows={2} /> : (
          <>
            {!data?.publishable && (
              <div style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderLeft: "3px solid var(--amber)", padding: "1.1rem 1.35rem", marginBottom: "1.25rem", fontSize: "var(--t-sm)", color: "var(--ink-2)", lineHeight: 1.7 }}>
                <strong>Collecting.</strong> No assessment family has two waves above the privacy floor yet. Wave one
                is being collected now; households that ticked the follow-up box on their response form become the
                panel wave two returns to.
              </div>
            )}

            {(data?.families ?? []).map((f) => (
              <div key={f.root_id} className="chart-panel" style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <div className="chart-panel-title">{f.title}</div>
                    {f.target_population && <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", marginTop: 2 }}>{f.target_population}</div>}
                  </div>
                  {f.movement_pp != null && (
                    <div style={{ fontSize: "1.1rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: f.movement_pp <= 0 ? "var(--green)" : "var(--red)" }}>
                      {f.movement_pp > 0 ? "+" : ""}{f.movement_pp}pp
                    </div>
                  )}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--t-sm)", marginTop: "0.6rem" }}>
                  <tbody>
                    {f.waves.map((w) => (
                      <tr key={w.wave} style={{ borderTop: "1px solid var(--border-soft)" }}>
                        <td style={{ padding: "6px 8px", fontWeight: 600, color: "var(--ink-3)" }}>Wave {w.wave}</td>
                        <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", textAlign: "right" }}>{w.n_classified} classified</td>
                        <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono)", textAlign: "right", fontWeight: 700, color: w.epi_pct != null ? "var(--ink)" : "var(--ink-5)" }}>
                          {w.epi_pct != null ? `${w.epi_pct}% in energy poverty` : "below the privacy floor"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            <p style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)", lineHeight: 1.7, maxWidth: "var(--measure)", marginTop: "1rem" }}>
              Method: tiers are computed deterministically from daily supply hours and energy burden at submission;
              the index is the D and E share of classifiable, verified responses. The underlying aggregates are on the{" "}
              <Link href="/assessments" style={{ color: "var(--green)" }}>open data pages</Link>. Anything below the
              privacy floor is withheld, never estimated.
            </p>
          </>
        )}
      </div>
    </main>
    <Footer />
    </>
  );
}
