// ── lib/format.ts ───────────────────────────────────────────────────────────
// Compact axis-tick formatter. Large values (39,000,000) do not fit chart axis
// gutters and get clipped to ",000,000" — so axes render 39M / 1.2B / 450K
// while tooltips keep full locale numbers.

export function fmtCompact(v: number): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const fmt = (n: number) => (n >= 100 ? n.toFixed(0) : n >= 10 ? (Math.round(n * 10) / 10).toString() : (Math.round(n * 100) / 100).toString());
  if (abs >= 1e9) return `${sign}${fmt(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}${fmt(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}${fmt(abs / 1e3)}K`;
  return `${sign}${fmt(abs)}`;
}
