// ── lib/analytics.ts ──────────────────────────────────────────────────────────
// Pure, framework-free statistical transforms for energy time series.
// Every function takes normalized Point[] and returns a new derived series or a
// scalar summary. No React, no side effects — these are unit-testable in isolation
// and shared by both the public portal and Data Point analytical charts.
//
// Design contract:
//   • Input records may have null values (gaps) — transforms skip/handle them.
//   • Output series are always sorted ascending by period_date.
//   • Percentage outputs are in percentage points (e.g. 12.4 means +12.4%).

export interface RawRecord {
  period: string;
  period_date: string;
  value: number | null;
}

export interface Point {
  period: string;
  periodDate: string;
  value: number;
}

// ── Normalization ─────────────────────────────────────────────────────────────

/** Drop null values, sort ascending by date, and coerce to clean Point[]. */
export function toPoints(records: RawRecord[]): Point[] {
  return records
    .filter((r) => r.value !== null && r.value !== undefined && !Number.isNaN(r.value))
    .map((r) => ({ period: r.period, periodDate: r.period_date, value: r.value as number }))
    .sort((a, b) => a.periodDate.localeCompare(b.periodDate));
}

// ── Frequency detection ───────────────────────────────────────────────────────

export type Frequency = "monthly" | "quarterly" | "annual";

/** Infer reporting frequency from period strings. Drives the YoY lag length. */
export function detectFrequency(points: Point[]): Frequency {
  const p = points[0]?.period ?? "";
  if (/^\d{4}-\d{2}$/.test(p)) return "monthly";
  if (/^\d{4}-Q\d$/.test(p)) return "quarterly";
  return "annual";
}

/** Number of periods in one year for the given frequency. */
export function periodsPerYear(freq: Frequency): number {
  return freq === "monthly" ? 12 : freq === "quarterly" ? 4 : 1;
}

// ── Change series ─────────────────────────────────────────────────────────────

export interface ChangePoint {
  period: string;
  periodDate: string;
  pct: number;
}

/**
 * Year-on-year % change. Compares each period to the same period one year prior,
 * using the detected frequency to pick the correct lag (12 / 4 / 1).
 */
export function yoyChange(points: Point[]): ChangePoint[] {
  const lag = periodsPerYear(detectFrequency(points));
  const out: ChangePoint[] = [];
  for (let i = lag; i < points.length; i++) {
    const prev = points[i - lag].value;
    if (prev === 0) continue;
    out.push({
      period: points[i].period,
      periodDate: points[i].periodDate,
      pct: ((points[i].value - prev) / Math.abs(prev)) * 100,
    });
  }
  return out;
}

/** Period-over-period (month-on-month / quarter-on-quarter) % change. */
export function periodChange(points: Point[]): ChangePoint[] {
  const out: ChangePoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].value;
    if (prev === 0) continue;
    out.push({
      period: points[i].period,
      periodDate: points[i].periodDate,
      pct: ((points[i].value - prev) / Math.abs(prev)) * 100,
    });
  }
  return out;
}

// ── Smoothing & accumulation ──────────────────────────────────────────────────

export interface ValuePoint {
  period: string;
  periodDate: string;
  value: number;
}

/** Trailing simple moving average over `window` periods. */
export function rollingMean(points: Point[], window: number): ValuePoint[] {
  const out: ValuePoint[] = [];
  for (let i = window - 1; i < points.length; i++) {
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += points[j].value;
    out.push({ period: points[i].period, periodDate: points[i].periodDate, value: sum / window });
  }
  return out;
}

/** Running cumulative sum from the first period. */
export function cumulative(points: Point[]): ValuePoint[] {
  let acc = 0;
  return points.map((p) => {
    acc += p.value;
    return { period: p.period, periodDate: p.periodDate, value: acc };
  });
}

/** Rebase the series to an index where the first value = 100 (growth comparison). */
export function indexed(points: Point[], base = 100): ValuePoint[] {
  const first = points[0]?.value;
  if (!first) return points.map((p) => ({ period: p.period, periodDate: p.periodDate, value: base }));
  return points.map((p) => ({ period: p.period, periodDate: p.periodDate, value: (p.value / first) * base }));
}

// ── Volatility band ───────────────────────────────────────────────────────────

export interface BandPoint {
  period: string;
  periodDate: string;
  value: number;
  mean: number;
  upper: number;
  lower: number;
}

/**
 * Rolling mean ± k standard deviations over `window` periods.
 * Reveals whether the latest observation sits inside its normal fluctuation band.
 */
export function volatilityBand(points: Point[], window: number, k = 2): BandPoint[] {
  const out: BandPoint[] = [];
  for (let i = window - 1; i < points.length; i++) {
    const slice = points.slice(i - window + 1, i + 1).map((p) => p.value);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length;
    const sd = Math.sqrt(variance);
    out.push({
      period: points[i].period,
      periodDate: points[i].periodDate,
      value: points[i].value,
      mean,
      upper: mean + k * sd,
      lower: Math.max(0, mean - k * sd),
    });
  }
  return out;
}

// ── Trend decomposition (OLS) ─────────────────────────────────────────────────

export interface DecompPoint {
  period: string;
  periodDate: string;
  value: number;
  trend: number;
  residual: number;
}

/** Ordinary-least-squares line through the series → trend + residual (noise). */
export function trendDecomposition(points: Point[]): DecompPoint[] {
  const n = points.length;
  if (n < 2) return points.map((p) => ({ ...p, value: p.value, trend: p.value, residual: 0 }));
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.value);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return points.map((p, i) => {
    const trend = intercept + slope * i;
    return { period: p.period, periodDate: p.periodDate, value: p.value, trend, residual: p.value - trend };
  });
}

// ── Summary statistics ────────────────────────────────────────────────────────

export interface SummaryStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdev: number;
  latest: number;
  cagr: number | null; // compound annual growth rate, %
  volatilityPct: number; // coefficient of variation, %
}

export function summaryStats(points: Point[]): SummaryStats | null {
  if (!points.length) return null;
  const vals = points.map((p) => p.value);
  const n = vals.length;
  const sorted = [...vals].sort((a, b) => a - b);
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stdev = Math.sqrt(variance);
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;

  // CAGR based on elapsed calendar time between first and last observation
  let cagr: number | null = null;
  const first = points[0];
  const last = points[n - 1];
  const years =
    (new Date(last.periodDate).getTime() - new Date(first.periodDate).getTime()) /
    (1000 * 60 * 60 * 24 * 365.25);
  if (first.value > 0 && last.value > 0 && years > 0) {
    cagr = (Math.pow(last.value / first.value, 1 / years) - 1) * 100;
  }

  return {
    count: n,
    min: sorted[0],
    max: sorted[n - 1],
    mean,
    median,
    stdev,
    latest: last.value,
    cagr,
    volatilityPct: mean !== 0 ? (stdev / Math.abs(mean)) * 100 : 0,
  };
}
