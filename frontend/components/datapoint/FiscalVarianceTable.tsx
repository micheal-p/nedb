"use client";

// ── FiscalVarianceTable ─────────────────────────────────────────────────────
// The fiscal way to show gains and losses: a variance table, not a chart.
// Naira billions in tabular figures, this period vs the same period last
// year, signed change with ▲▼ markers beside the colour (never colour alone).
// Series without committed data show honestly as awaiting data.

type SeriesRow = { period: string; value: number; unit?: string };
type DashData  = Record<string, SeriesRow[]>;

const FISCAL_SERIES: { id: string; label: string; source: string }[] = [
  { id: "faac_oil_revenue",    label: "FAAC Oil Revenue",         source: "RMAFC / CBN" },
  { id: "upstream_royalties",  label: "Upstream Royalties",       source: "NUPRC" },
  { id: "hydrocarbon_tax",     label: "Hydrocarbon Tax Receipts", source: "NRS (formerly FIRS)" },
  { id: "cit_energy",          label: "CIT from Energy Companies",source: "NRS (formerly FIRS)" },
  { id: "gas_flare_penalties", label: "Gas Flaring Penalties",    source: "NUPRC" },
];

const nb = (v: number) => v.toLocaleString("en-NG", { maximumFractionDigits: 1 });

export default function FiscalVarianceTable({ dashData, prevDashData, year }: {
  dashData: DashData; prevDashData: DashData; year: number;
}) {
  const rows = FISCAL_SERIES.map((s) => {
    const cur  = dashData[s.id] ?? [];
    const prev = prevDashData[s.id] ?? [];
    if (!cur.length) return { ...s, empty: true as const };
    const latest  = cur[cur.length - 1];
    const lastYr  = prev[cur.length - 1] ?? null;
    const diff    = lastYr ? latest.value - lastYr.value : null;
    const pct     = lastYr && lastYr.value !== 0 ? ((latest.value - lastYr.value) / Math.abs(lastYr.value)) * 100 : null;
    return { ...s, empty: false as const, latest, lastYr, diff, pct };
  });

  const anyData = rows.some((r) => !r.empty);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Fiscal Variance — This Period vs Same Period {year - 1}</span>
        <span style={{ fontSize: "0.72rem", color: "var(--ink-5)" }}>₦ Billion · cash receipts, provisional</span>
      </div>
      <div className="data-table-wrap" style={{ border: "none", borderRadius: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Revenue Line</th>
              <th>Period</th>
              <th style={{ textAlign: "right" }}>{year} (₦B)</th>
              <th style={{ textAlign: "right" }}>{year - 1} (₦B)</th>
              <th style={{ textAlign: "right" }}>Change (₦B)</th>
              <th style={{ textAlign: "right" }}>Change (%)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="td-primary">
                  {r.label}
                  <div style={{ fontSize: "0.65rem", color: "var(--ink-5)", fontWeight: 400 }}>Source: {r.source}</div>
                </td>
                {r.empty ? (
                  <td colSpan={5} style={{ color: "var(--ink-5)", fontSize: "0.75rem" }}>Awaiting data submission</td>
                ) : (
                  <>
                    <td style={{ fontSize: "0.75rem" }}>{r.latest.period}</td>
                    <td className="td-num" style={{ fontWeight: 700, color: "var(--ink)" }}>{nb(r.latest.value)}</td>
                    <td className="td-num">{r.lastYr ? nb(r.lastYr.value) : "—"}</td>
                    <td className="td-num" style={{ color: r.diff == null ? "var(--ink-5)" : r.diff >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                      {r.diff == null ? "—" : `${r.diff >= 0 ? "▲ +" : "▼ −"}${nb(Math.abs(r.diff))}`}
                    </td>
                    <td className="td-num" style={{ color: r.pct == null ? "var(--ink-5)" : r.pct >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
                      {r.pct == null ? "—" : `${r.pct >= 0 ? "+" : "−"}${Math.abs(r.pct).toFixed(1)}%`}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="chart-source">
        {anyData
          ? `Cash receipts, ₦ billion, provisional until reconciled with source agency annual reports. Change is against the same period in ${year - 1}.`
          : "No fiscal records committed yet — figures appear once source agency data lands through the upload workflow."}
      </div>
    </div>
  );
}
