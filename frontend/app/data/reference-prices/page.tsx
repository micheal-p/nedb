"use client";

// ── /data/reference-prices — the Household Energy Cost Reference ────────────
// The number nobody in Nigeria publishes: what a household actually pays per
// hour of electricity it receives, measured from assessment responses, with
// the supply-side series named and their emptiness stated rather than hidden.

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { SkeletonCards, EmptyState } from "@/components/ui/Loading";

type Ref = {
  computed_at: string; method: string;
  national: { n: number; median_spend_per_lit_hour: number | null; avg_burden_pct: number | null } | null;
  by_state: { state: string; n: number; median_spend_per_lit_hour: number | null; avg_burden_pct: number | null }[];
  supply_side: { series: string; name: string; records: number }[];
};

const naira = (v: number | null) => (v == null ? "—" : `₦${v.toFixed(0)}`);

export default function ReferencePricesPage() {
  const [ref, setRef] = useState<Ref | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reference-prices").then((r) => (r.ok ? r.json() : null)).then(setRef).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
    <Navbar active="databank" />
    <main style={{ minHeight: "100vh", background: "var(--surface)", padding: "2.5rem 1.5rem" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.375rem" }}>Reference Series</div>
          <h1 style={{ fontSize: "1.7rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>Household Energy Cost Reference</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--ink-3)", marginTop: "0.5rem", maxWidth: 660, lineHeight: 1.65 }}>
            What Nigerian households actually pay for the electricity they actually receive, measured from verified
            field assessment responses. This is deliberately not called a tariff: households buy fuel, candles and
            generator hours, not metered units. NEDB states the reference; it is never the counterparty.
          </p>
        </div>

        {loading ? <SkeletonCards rows={2} /> : !ref ? (
          <EmptyState title="Reference unavailable" body="The computation could not be read. Try again shortly." />
        ) : (
          <>
            <div className="grid-auto grid-hair" style={{ marginBottom: "1.25rem" }}>
              <div style={{ padding: "1rem 1.2rem" }}>
                <div style={{ fontSize: "var(--t-2xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-4)" }}>Median spend per lit hour</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                  {ref.national ? naira(ref.national.median_spend_per_lit_hour) : "collecting"}
                </div>
                <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", marginTop: 3 }}>
                  {ref.national ? `across ${ref.national.n} verified household responses` : "publishes at the privacy floor"}
                </div>
              </div>
              <div style={{ padding: "1rem 1.2rem" }}>
                <div style={{ fontSize: "var(--t-2xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-4)" }}>Average energy burden</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                  {ref.national?.avg_burden_pct != null ? `${ref.national.avg_burden_pct.toFixed(1)}%` : "—"}
                </div>
                <div style={{ fontSize: "var(--t-xs)", color: "var(--ink-4)", marginTop: 3 }}>of household income spent on energy</div>
              </div>
            </div>

            {ref.by_state.length > 0 && (
              <div className="chart-panel" style={{ marginBottom: "1.25rem" }}>
                <div className="chart-panel-title" style={{ marginBottom: "0.6rem" }}>By state · above the privacy floor</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--t-sm)" }}>
                    <thead><tr style={{ borderBottom: "1.5px solid var(--ink)", textAlign: "left" }}>
                      <th style={{ padding: "6px 10px" }}>State</th>
                      <th style={{ padding: "6px 10px", textAlign: "right" }}>n</th>
                      <th style={{ padding: "6px 10px", textAlign: "right" }}>Median ₦ / lit hour</th>
                      <th style={{ padding: "6px 10px", textAlign: "right" }}>Avg burden</th>
                    </tr></thead>
                    <tbody>
                      {ref.by_state.map((s) => (
                        <tr key={s.state} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                          <td style={{ padding: "7px 10px" }}>{s.state}</td>
                          <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{s.n}</td>
                          <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{naira(s.median_spend_per_lit_hour)}</td>
                          <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{s.avg_burden_pct != null ? `${s.avg_burden_pct.toFixed(1)}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="chart-panel" style={{ marginBottom: "1.25rem" }}>
              <div className="chart-panel-title" style={{ marginBottom: "0.6rem" }}>The supply side · receiving series</div>
              <p style={{ fontSize: "var(--t-sm)", color: "var(--ink-3)", lineHeight: 1.7, margin: "0 0 0.75rem", maxWidth: "var(--measure)" }}>
                Measured Nigerian outcomes — signed PPA tariffs and awarded tender capex — are collected as ordinary
                data-bank series. Their coverage is stated, not assumed; until they fill, NECAL2050 says plainly that
                its capital figures are international planning numbers.
              </p>
              {ref.supply_side.map((s) => (
                <div key={s.series} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderTop: "1px solid var(--border-soft)", fontSize: "var(--t-sm)" }}>
                  <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>{s.name}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: s.records > 0 ? "var(--green)" : "var(--amber)" }}>
                    {s.records > 0 ? `${s.records} records` : "no records yet — awaiting first submission"}
                  </span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: "var(--t-xs)", color: "var(--ink-5)", lineHeight: 1.7, maxWidth: "var(--measure)" }}>
              Method: {ref.method} Computed {new Date(ref.computed_at).toLocaleString("en-NG")}. The responses behind
              this reference are the same anonymised aggregates published on the{" "}
              <Link href="/assessments" style={{ color: "var(--green)" }}>assessments open data</Link> pages.
            </p>
          </>
        )}
      </div>
    </main>
    <Footer />
    </>
  );
}
