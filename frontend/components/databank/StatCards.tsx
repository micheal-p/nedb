import type { AutoStats } from "@/lib/api";
import InfoTip from "@/components/ui/InfoTip";

interface Props { stats: AutoStats; }

function fmt(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function pct(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function cls(v: number | null): string {
  if (v === null) return "";
  return v >= 0 ? "up" : "down";
}

const TIPS: Record<string, string> = {
  "Latest Value":     "The most recently committed data point for this series.",
  "Year-on-Year":     "Percentage change vs the same period in the prior year. Calculated as (current − prior) ÷ |prior| × 100.",
  "Month-on-Month":   "Percentage change vs the immediately preceding period (e.g. last month or last quarter).",
  "CAGR":             "Compound Annual Growth Rate — the smoothed annualised growth rate from the oldest record to the latest. Useful for comparing series over different time spans.",
  "Rolling 3-Period": "Simple average of the 3 most recent data points. Smooths out short-term noise.",
  "Rolling 12-Period":"Simple average of the 12 most recent data points. Approximates a trailing-year average for monthly data.",
};

export default function StatCards({ stats }: Props) {
  const items = [
    { label: "Latest Value",     value: fmt(stats.latest),      sub: stats.latest_period ? `as of ${stats.latest_period}` : "", vc: "" },
    { label: "Year-on-Year",     value: pct(stats.yoy_pct),     sub: "vs same period prior year",   vc: cls(stats.yoy_pct) },
    { label: "Month-on-Month",   value: pct(stats.mom_pct),     sub: "vs prior period",             vc: cls(stats.mom_pct) },
    { label: "CAGR",             value: pct(stats.cagr),        sub: "compound annual growth rate", vc: cls(stats.cagr) },
    { label: "Rolling 3-Period", value: fmt(stats.rolling_3),   sub: `avg · ${stats.unit}`,         vc: "" },
    { label: "Rolling 12-Period",value: fmt(stats.rolling_12),  sub: `avg · ${stats.unit}`,         vc: "" },
  ];

  return (
    <div className="kpi-strip">
      {items.map((item) => (
        <div key={item.label} className="kpi-cell">
          <div className="kpi-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {item.label}
            {TIPS[item.label] && <InfoTip text={TIPS[item.label]} position="bottom" width={240} />}
          </div>
          <div className={`kpi-value ${item.vc}`}>{item.value}</div>
          <div className="kpi-sub">{item.sub}</div>
        </div>
      ))}
    </div>
  );
}
