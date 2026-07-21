"use client";

// Public open-data page for one published PENA assessment.
// Everything here is k-anonymised aggregate data — the API suppresses any
// state/LGA group under the anonymity floor and never exposes personal fields.

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import LgaMap from "@/components/datapoint/LgaMap";
import { TIERS, TIER_ORDER, type PenaTier } from "@/lib/pena";

type Group = { name: string; count: number; avg_income: number | null; avg_light_hours: number | null; avg_energy_expense: number | null; tiers: number[] };

type PubData = {
  assessment: { slug: string; title: string; description: string | null; status: string; created_at: string };
  license: string;
  total_responses: number;
  stats: { avg_income: number | null; avg_light_hours: number | null; avg_energy_expense: number | null };
  tier_distribution: { tier: PenaTier; count: number }[];
  by_state: Group[];
  by_lga: Group[];
  lga_income_map: Record<string, number>;
};

const naira = (v: number | null) => (v == null ? "—" : `₦${Math.round(v).toLocaleString()}`);

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

  const maxTier = Math.max(1, ...data.tier_distribution.map((t) => t.count));

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface)", padding: "2.5rem 1.5rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--green)", marginBottom: "0.375rem" }}>
              <Link href="/assessments" style={{ color: "var(--green)", textDecoration: "none" }}>Open Data · PENA</Link>
            </div>
            <h1 style={{ fontSize: "1.6rem", fontFamily: "var(--font-serif)", fontWeight: 400, color: "var(--ink)", margin: 0 }}>{data.assessment.title}</h1>
            {data.assessment.description && <p style={{ fontSize: "0.85rem", color: "var(--ink-3)", marginTop: "0.5rem", maxWidth: 680, lineHeight: 1.6 }}>{data.assessment.description}</p>}
          </div>
          <button onClick={downloadJSON} style={{ padding: "0.6rem 1.25rem", background: "#fff", border: "1px solid var(--green-line)", color: "var(--green)", borderRadius: 6, fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
            Download Aggregates (JSON)
          </button>
        </div>

        {/* Headline tiles */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
          {[
            { label: "Responses", value: data.total_responses.toLocaleString() },
            { label: "Avg Monthly Income", value: naira(data.stats.avg_income) },
            { label: "Avg Light Hours / Day", value: data.stats.avg_light_hours == null ? "—" : data.stats.avg_light_hours.toFixed(1) },
            { label: "Avg Monthly Energy Spend", value: naira(data.stats.avg_energy_expense) },
          ].map((t) => (
            <div key={t.label} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "1rem 1.25rem", flex: "1 1 160px", minWidth: 160 }}>
              <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{t.label}</div>
              <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>{t.value}</div>
            </div>
          ))}
        </div>

        {/* Tier distribution */}
        <div className="chart-panel" style={{ marginBottom: "1.25rem" }}>
          <div className="chart-panel-head">
            <div>
              <div className="chart-panel-title">Environmental–Economic Tier Distribution</div>
              <div className="chart-panel-sub">A = energy secure · E = energy critical</div>
            </div>
          </div>
          <div style={{ padding: "0.75rem 0", display: "flex", flexDirection: "column", gap: 10 }}>
            {data.tier_distribution.map(({ tier, count }) => (
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
        <div style={{ marginBottom: "1.25rem" }}>
          <LgaMap lgaData={data.lga_income_map} title="Average Monthly Income by LGA" unit="₦/month" source="PENA field assessment / NEDB (anonymised aggregates)" />
        </div>

        {/* State table */}
        <div className="chart-panel">
          <div className="chart-panel-head">
            <div>
              <div className="chart-panel-title">State Summary</div>
              <div className="chart-panel-sub">Averages per state, with tier counts A→E · groups under the anonymity floor are suppressed</div>
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
                {data.by_state.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: "center", color: "var(--ink-5)", padding: "1.5rem" }}>Not enough responses per state to publish yet.</td></tr>
                )}
                {data.by_state.map((s) => (
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
      </div>
    </div>
  );
}
