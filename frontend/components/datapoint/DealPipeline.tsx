"use client";

// ── DealPipeline — the "data to deal" view ──────────────────────────────────
// An investor dashboard that only draws charts leaves the investor to do the
// hardest step alone: turning a trend into something actionable. This view
// derives candidate opportunities directly from the committed series and states
// the evidence behind each one, so the reader can judge it rather than trust it.
//
// Every card is generated from data in scope. Nothing here is a curated list of
// deals — it is a screen, and it says so.

import { useMemo } from "react";

type SeriesRow = { period: string; value: number; unit?: string };
type DashData = Record<string, SeriesRow[]>;

export type Lead = {
  title: string;
  thesis: string;
  evidence: string[];
  signal: "expanding" | "gap" | "declining";
  horizon: string;
  series: string[];
};

const trend = (rows: SeriesRow[]) => {
  if (rows.length < 2) return null;
  const first = rows[0].value, last = rows[rows.length - 1].value;
  if (!first) return null;
  return ((last - first) / Math.abs(first)) * 100;
};

const latest = (rows: SeriesRow[]) => (rows.length ? rows[rows.length - 1] : null);

const SIGNAL_STYLE = {
  expanding: { label: "Expanding", color: "var(--green)", bg: "var(--green-tint)", border: "var(--green-line)" },
  gap:       { label: "Supply gap", color: "var(--amber)", bg: "var(--amber-tint)", border: "var(--amber)" },
  declining: { label: "Declining", color: "var(--red)", bg: "var(--red-tint)", border: "var(--red)" },
} as const;

/** Derive candidate opportunities from whatever series are in scope. */
export function deriveLeads(data: DashData, stateMap: Record<string, Record<string, number>>): Lead[] {
  const leads: Lead[] = [];
  const s = (id: string) => data[id] ?? [];

  // 1. Renewable capacity trajectory
  const ren = s("renewable_energy");
  const renTrend = trend(ren);
  const renLatest = latest(ren);
  if (renLatest && renTrend !== null) {
    leads.push({
      title: "Grid-connected renewable capacity",
      thesis: renTrend > 0
        ? "Installed renewable capacity is rising against a grid that is not keeping pace with demand, which is the conventional entry point for independent generation."
        : "Installed renewable capacity is flat or falling while demand indicators hold up, which usually points to a financing or offtake constraint rather than an absence of resource.",
      evidence: [
        `Latest capacity ${renLatest.value.toLocaleString()} ${renLatest.unit ?? "MW"} (${renLatest.period}).`,
        `${renTrend >= 0 ? "Up" : "Down"} ${Math.abs(renTrend).toFixed(1)}% across the period on record.`,
      ],
      signal: renTrend > 0 ? "expanding" : "gap",
      horizon: "Medium term",
      series: ["renewable_energy"],
    });
  }

  // 2. Transmission loss between generation and delivery
  const gen = latest(s("electricity_generation"));
  const sent = latest(s("electricity_sent_out"));
  if (gen && sent && gen.value > 0) {
    const lossPct = ((gen.value - sent.value) / gen.value) * 100;
    if (lossPct > 0) {
      leads.push({
        title: "Generation-to-delivery gap",
        thesis: "Energy generated but not delivered is revenue nobody collects. A persistent gap is the case for transmission and distribution investment, and it sizes the prize directly.",
        evidence: [
          `${gen.value.toLocaleString()} ${gen.unit ?? "GWh"} generated against ${sent.value.toLocaleString()} sent out (${gen.period}).`,
          `${lossPct.toFixed(1)}% of generated energy did not reach the delivery point.`,
        ],
        signal: lossPct > 8 ? "gap" : "expanding",
        horizon: "Near term",
        series: ["electricity_generation", "electricity_sent_out"],
      });
    }
  }

  // 3. Biomass dependence as an LPG / clean cooking opportunity
  const wood = latest(s("fuelwood_consumption"));
  const lpg = s("lpg_sales");
  const lpgTrend = trend(lpg);
  if (wood) {
    leads.push({
      title: "Clean cooking substitution",
      thesis: "Sustained household biomass consumption alongside a small LPG base is the classic substitution opportunity: distribution and cylinder financing, not upstream supply, are usually the binding constraint.",
      evidence: [
        `Fuelwood consumption ${wood.value.toLocaleString()} ${wood.unit ?? "M m³"} (${wood.period}).`,
        lpgTrend !== null
          ? `LPG sales ${lpgTrend >= 0 ? "up" : "down"} ${Math.abs(lpgTrend).toFixed(1)}% over the period on record.`
          : "No LPG sales series in scope to size the substitution against.",
      ],
      signal: "gap",
      horizon: "Medium term",
      series: ["fuelwood_consumption", "lpg_sales"],
    });
  }

  // 4. Gas monetisation
  const gas = s("natural_gas_production");
  const gasTrend = trend(gas);
  const gasLatest = latest(gas);
  if (gasLatest && gasTrend !== null) {
    leads.push({
      title: "Gas monetisation",
      thesis: gasTrend >= 0
        ? "Rising gas production with domestic power demand unmet is the transition-fuel case: processing, pipeline and gas-to-power capacity are where the value is captured."
        : "Falling gas production while power demand holds is a supply-security question before it is an investment one, and it raises counterparty risk on any gas-fired offtake.",
      evidence: [
        `Latest production ${gasLatest.value.toLocaleString()} ${gasLatest.unit ?? "Bcf"} (${gasLatest.period}).`,
        `${gasTrend >= 0 ? "Up" : "Down"} ${Math.abs(gasTrend).toFixed(1)}% across the period on record.`,
      ],
      signal: gasTrend >= 0 ? "expanding" : "declining",
      horizon: "Near term",
      series: ["natural_gas_production"],
    });
  }

  // 5. Geographic concentration — where the underserved states are
  const genByState = stateMap["electricity_generation"] ?? {};
  const states = Object.entries(genByState).filter(([, v]) => Number.isFinite(v));
  if (states.length >= 4) {
    const sorted = states.sort((a, b) => a[1] - b[1]);
    const lowest = sorted.slice(0, 3).map(([name]) => name);
    const total = states.reduce((a, [, v]) => a + v, 0);
    const topShare = total > 0 ? (sorted.slice(-3).reduce((a, [, v]) => a + v, 0) / total) * 100 : 0;
    leads.push({
      title: "Geographic concentration of supply",
      thesis: "Generation concentrated in a few states leaves the rest dependent on transmission that may not exist. Those states are where distributed generation and mini-grid economics work first.",
      evidence: [
        `Top three states account for ${topShare.toFixed(0)}% of recorded generation.`,
        `Lowest recorded: ${lowest.join(", ")}.`,
      ],
      signal: "gap",
      horizon: "Medium term",
      series: ["electricity_generation"],
    });
  }

  return leads;
}

export default function DealPipeline({ dashData, stateMap, year }: {
  dashData: DashData; stateMap: Record<string, Record<string, number>>; year: number;
}) {
  const leads = useMemo(() => deriveLeads(dashData, stateMap), [dashData, stateMap]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Opportunity Screen — {year}</span>
          <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>Derived from committed data in your scope</span>
        </div>
        <div style={{ padding: "1rem 1.25rem" }}>
          {leads.length === 0 ? (
            <div style={{ fontSize: "0.82rem", color: "var(--ink-4)", lineHeight: 1.7 }}>
              There is not enough committed data in your scope to screen for opportunities yet. This view derives every
              lead from the series on your dashboard rather than presenting a curated list, so it stays empty until the
              underlying data lands.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
              {leads.map((l) => {
                const st = SIGNAL_STYLE[l.signal];
                return (
                  <div key={l.title} style={{ background: "var(--surface-white)", border: "1px solid var(--border)", borderTop: `3px solid ${st.color}`, padding: "1.1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: st.color, background: st.bg, border: `1px solid ${st.border}`, padding: "1px 7px" }}>{st.label}</span>
                      <span style={{ fontSize: "0.66rem", color: "var(--ink-5)", marginLeft: "auto" }}>{l.horizon}</span>
                    </div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--ink)" }}>{l.title}</div>
                    <p style={{ fontSize: "0.8rem", color: "var(--ink-3)", lineHeight: 1.65, margin: 0 }}>{l.thesis}</p>
                    <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: "0.5rem", marginTop: "auto" }}>
                      <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-5)", marginBottom: 4 }}>Evidence</div>
                      <ul style={{ margin: 0, paddingLeft: "1rem", fontSize: "0.75rem", color: "var(--ink-3)", lineHeight: 1.7 }}>
                        {l.evidence.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="chart-source">
          A screen, not investment advice. Each lead is generated from the series named in its evidence and reflects only
          data committed to NEDB; it is a starting point for diligence, not a recommendation or an offer.
        </div>
      </div>
    </div>
  );
}
