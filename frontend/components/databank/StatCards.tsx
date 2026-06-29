import type { AutoStats } from "@/lib/api";

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

export default function StatCards({ stats }: Props) {
  const items = [
    { label: "Latest Value",    value: fmt(stats.latest),      sub: stats.latest_period ? `as of ${stats.latest_period}` : "", vc: "" },
    { label: "Year-on-Year",    value: pct(stats.yoy_pct),     sub: "vs same period prior year",  vc: cls(stats.yoy_pct) },
    { label: "Month-on-Month",  value: pct(stats.mom_pct),     sub: "vs prior period",            vc: cls(stats.mom_pct) },
    { label: "CAGR",            value: pct(stats.cagr),        sub: "compound annual growth rate", vc: cls(stats.cagr) },
    { label: "Rolling 3-Period",value: fmt(stats.rolling_3),   sub: `avg · ${stats.unit}`,        vc: "" },
    { label: "Rolling 12-Period",value: fmt(stats.rolling_12), sub: `avg · ${stats.unit}`,        vc: "" },
  ];

  return (
    <div className="kpi-strip">
      {items.map((item) => (
        <div key={item.label} className="kpi-cell">
          <div className="kpi-label">{item.label}</div>
          <div className={`kpi-value ${item.vc}`}>{item.value}</div>
          <div className="kpi-sub">{item.sub}</div>
        </div>
      ))}
    </div>
  );
}
