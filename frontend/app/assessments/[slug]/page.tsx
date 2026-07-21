"use client";

// Public open-data page for one published PENA assessment.
// Everything here is k-anonymised aggregate data. Below the privacy floor the
// API returns only a progress count — the page shows a clear "collecting"
// state instead of empty panels. "Download PDF" prints the page (browser
// save-as-PDF) with nav/buttons hidden via the global .no-print rule.

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import LgaMap from "@/components/datapoint/LgaMap";
import { TIERS, TIER_ORDER, type PenaTier } from "@/lib/pena";

type Group = { name: string; count: number; avg_income: number | null; avg_light_hours: number | null; avg_energy_expense: number | null; tiers: number[] };

type PubData = {
  assessment: { slug: string; title: string; description: string | null; status: string; created_at: string };
  share_token?: string | null;
  license: string;
  total_responses: number;
  collecting?: boolean;
  needed?: number;
  stats?: { avg_income: number | null; avg_light_hours: number | null; avg_energy_expense: number | null };
  tier_distribution?: { tier: PenaTier; count: number }[];
  by_state?: Group[];
  by_lga?: Group[];
  lga_income_map?: Record<string, number>;
};

const naira = (v: number | null | undefined) => (v == null ? "—" : `₦${Math.round(v).toLocaleString()}`);

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "var(--green)", margin: "0 0 0.625rem", display: "flex", alignItems: "center", gap: 8 }}>
      {children}
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: "1.1rem 1.3rem", flex: "1 1 175px", minWidth: 175, boxShadow: "0 1px 3px rgba(16,24,16,0.05)" }}>
      <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono)", lineHeight: 1, letterSpacing: "-0.01em" }}>{value}</div>
      <div style={{ fontSize: "0.68rem", color: "var(--ink-5)", marginTop: 6, lineHeight: 1.45 }}>{sub}</div>
    </div>
  );
}

export default function PublicAssessmentPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<PubData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/pena/public/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, [slug]);

  function downloadJSON() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${data.assessment.slug}-aggregates.json`; a.click();
    URL.revokeObjectURL(url);
  }

  if (failed) return <div style={{ minHeight: "100vh", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-4)", fontSize: "0.85rem" }}>Assessment not found.</div>;
  if (!data) return <div style={{ minHeight: "100vh", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-5)", fontSize: "0.85rem" }}>Loading…</div>;

  const collecting = !!data.collecting;
  const needed = data.needed ?? 5;
  const maxTier = Math.max(1, ...(data.tier_distribution ?? []).map((t) => t.count));

  return (
    <>
    <div className="no-print"><Navbar active="assessments" /></div>
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2.5rem 1.5rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ maxWidth: 700 }}>
            <div className="no-print" style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.375rem" }}>
              <Link href="/assessments" style={{ color: "var(--green)", textDecoration: "none" }}>← Open Data · PENA</Link>
            </div>
            <h1 style={{ fontSize: "1.65rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0, lineHeight: 1.2 }}>{data.assessment.title}</h1>
            {data.assessment.description && <p style={{ fontSize: "0.85rem", color: "var(--ink-3)", marginTop: "0.55rem", lineHeight: 1.65 }}>{data.assessment.description}</p>}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "0.625rem", flexWrap: "wrap" }}>
              {data.assessment.status === "open" && (
                <span style={{ fontSize: "0.62rem", fontWeight: 700, padding: "2px 8px", borderRadius: 3, background: "var(--green-tint)", color: "var(--green)", border: "1px solid var(--green-line)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Collecting responses</span>
              )}
              <span style={{ fontSize: "0.7rem", color: "var(--ink-5)", fontFamily: "var(--font-mono)" }}>{data.assessment.slug}</span>
            </div>
          </div>
          <div className="no-print" style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
            {data.share_token && (
              <Link href={`/f/${data.share_token}`} style={{ padding: "0.6rem 1.25rem", background: "var(--green)", border: "none", color: "#fff", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, textDecoration: "none" }}>
                Fill This Assessment
              </Link>
            )}
            <button onClick={() => window.print()} style={{ padding: "0.6rem 1.25rem", background: "#fff", border: "1px solid var(--green-line)", color: "var(--green)", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
              Download PDF
            </button>
            <button onClick={downloadJSON} style={{ padding: "0.6rem 1.25rem", background: "#fff", border: "1px solid var(--green-line)", color: "var(--green)", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
              Download JSON
            </button>
          </div>
        </div>

        {collecting ? (
          /* ── Below the privacy floor: progress, not empty panels ─────────── */
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderTop: "3px solid var(--green)", borderRadius: "var(--r-lg)", padding: "2.5rem 2rem", textAlign: "center", boxShadow: "0 1px 3px rgba(16,24,16,0.05)" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.11em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.75rem" }}>Data collection in progress</div>
            <div style={{ fontSize: "2.2rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--ink)", lineHeight: 1 }}>
              {data.total_responses}<span style={{ color: "var(--ink-5)", fontSize: "1.2rem" }}> / {needed}</span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--ink-4)", marginTop: "0.5rem" }}>verified responses collected</div>
            <div style={{ maxWidth: 320, margin: "1.25rem auto 0", height: 8, background: "var(--surface)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
              <div style={{ width: `${Math.min(100, (data.total_responses / needed) * 100)}%`, height: "100%", background: "var(--green)", borderRadius: 4 }} />
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--ink-4)", maxWidth: 460, margin: "1.25rem auto 0", lineHeight: 1.65 }}>
              Statistics publish automatically once <strong>{needed} verified responses</strong> are collected.
              This privacy floor (NDPA 2023) prevents any individual&apos;s income or living situation from being
              identifiable in the open data. Full detail is already live for NEDB analysts on the internal dashboard.
            </p>
            {data.share_token && (
              <Link href={`/f/${data.share_token}`} className="no-print"
                style={{ display: "inline-block", marginTop: "1.5rem", padding: "0.75rem 2rem", background: "var(--green)", color: "#fff", borderRadius: 8, fontSize: "0.88rem", fontWeight: 700, textDecoration: "none" }}>
                Fill This Assessment — be one of the first {needed}
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Headline tiles */}
            <Kicker>Headline Figures</Kicker>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              <Tile label="Responses" value={data.total_responses.toLocaleString()} sub="verified submissions counted" />
              <Tile label="Avg Monthly Income" value={naira(data.stats?.avg_income)} sub="mean of reported incomes" />
              <Tile label="Avg Light Hours / Day" value={data.stats?.avg_light_hours == null ? "—" : data.stats.avg_light_hours.toFixed(1)} sub="of electricity supply, out of 24" />
              <Tile label="Avg Monthly Energy Spend" value={naira(data.stats?.avg_energy_expense)} sub="bills + fuel + solar, combined" />
            </div>
            <p style={{ fontSize: "0.7rem", color: "var(--ink-5)", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
              Averages across all verified responses. Area breakdowns below hide any state or LGA with fewer than 5 responses (NDPA 2023 privacy floor).
            </p>

            {/* Tier distribution */}
            <Kicker>Tier Distribution</Kicker>
            <div className="chart-panel" style={{ marginBottom: "1.5rem" }}>
              <div className="chart-panel-head">
                <div>
                  <div className="chart-panel-title">Environmental–Economic Tiers</div>
                  <div className="chart-panel-sub">A = energy secure · E = energy critical — from daily supply hours and the share of income spent on energy</div>
                </div>
              </div>
              <div style={{ padding: "0.75rem 0", display: "flex", flexDirection: "column", gap: 10 }}>
                {(data.tier_distribution ?? []).map(({ tier, count }) => (
                  <div key={tier} style={{ display: "grid", gridTemplateColumns: "170px 1fr 44px", alignItems: "center", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 11, height: 11, borderRadius: 3, background: TIERS[tier].color, flexShrink: 0, border: "1px solid rgba(0,0,0,0.08)" }} />
                      <span style={{ fontSize: "0.72rem", color: "var(--ink-2)", whiteSpace: "nowrap" }}><strong>{tier}</strong> · {TIERS[tier].label}</span>
                    </div>
                    <div style={{ height: 14, background: "var(--surface)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${(count / maxTier) * 100}%`, height: "100%", background: TIERS[tier].color, borderRadius: 4, minWidth: count ? 3 : 0 }} />
                    </div>
                    <div style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--ink-3)", textAlign: "right" }}>{count}</div>
                  </div>
                ))}
              </div>
              <div className="chart-source">{data.license}</div>
            </div>

            {/* LGA choropleth */}
            <Kicker>Geography</Kicker>
            <div style={{ marginBottom: "1.5rem" }}>
              <LgaMap
                lgaData={data.lga_income_map ?? {}}
                stateAware
                title="Average Monthly Income by LGA"
                unit="₦/month"
                source="PENA field assessment / NEDB (anonymised aggregates)"
                emptyTitle="No area has reached the privacy floor yet"
                emptyHint="An LGA colours in once it has 5 or more verified responses — averages for smaller groups are withheld to protect respondents."
              />
            </div>

            {/* State table */}
            <Kicker>State Summary</Kicker>
            <div className="chart-panel">
              <div className="chart-panel-head">
                <div>
                  <div className="chart-panel-title">Averages by State</div>
                  <div className="chart-panel-sub">With tier counts A→E · states under 5 responses are withheld until they reach the floor</div>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ width: "100%", fontSize: "0.76rem" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>State</th>
                      <th style={{ textAlign: "right" }}>Responses</th>
                      <th style={{ textAlign: "right" }}>Avg Income</th>
                      <th style={{ textAlign: "right" }}>Avg Light Hrs</th>
                      <th style={{ textAlign: "right" }}>Avg Energy Spend</th>
                      {TIER_ORDER.map((t) => <th key={t} style={{ textAlign: "right" }}>{t}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(data.by_state ?? []).length === 0 && (
                      <tr><td colSpan={10} style={{ textAlign: "center", color: "var(--ink-5)", padding: "1.5rem", lineHeight: 1.6 }}>
                        No state has reached 5 responses yet — rows appear automatically as areas cross the privacy floor.
                      </td></tr>
                    )}
                    {(data.by_state ?? []).map((s) => (
                      <tr key={s.name}>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{s.count}</td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{naira(s.avg_income)}</td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{s.avg_light_hours == null ? "—" : s.avg_light_hours.toFixed(1)}</td>
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>{naira(s.avg_energy_expense)}</td>
                        {s.tiers.map((n, i) => <td key={i} style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: n ? "var(--ink-2)" : "var(--ink-5)" }}>{n}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="chart-source">Data source: PENA field assessment / NEDB · Personal data withheld under NDPA 2023</div>
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
