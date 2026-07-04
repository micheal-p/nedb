// ── lib/report-model.ts ─────────────────────────────────────────────────────
// Pure assembler that turns raw records + series metadata into a single, flat
// "report model". Both outputs — the print/PDF report view and the Excel export —
// consume this identical model, so the two can never drift out of sync. No React,
// no I/O: given the same inputs it always produces the same object.

import {
  toPoints, detectFrequency, periodsPerYear,
  yoyChange, periodChange, rollingMean, cumulative, indexed,
  summaryStats, type Frequency, type SummaryStats,
} from "@/lib/analytics";
import type { EnergyRecord } from "@/lib/api";

export interface ReportMeta {
  seriesId: string;
  name: string;
  unit: string;
  sector: string;
  frequency: string;
  sourceAgency?: string;
  whatIs?: string | null;
  howToRead?: string | null;
  whyItMatters?: string | null;
}

export interface ReportKPIs {
  latest: number | null;
  latestPeriod: string;
  yoyPct: number | null;
  popPct: number | null;
  cagr: number | null;
  rolling: number | null;
  min: number;
  max: number;
  mean: number;
  volatilityPct: number;
}

// One fully-derived row per period — the analyst-grade table that feeds Excel.
export interface ReportRow {
  period: string;
  periodDate: string;
  region: string;
  value: number;
  yoyPct: number | null;
  popPct: number | null;
  rolling: number | null;
  cumulative: number;
  index: number;
}

export interface ReportModel {
  meta: ReportMeta & { generatedAt: string; recordCount: number; frequencyDetected: Frequency; smoothingWindow: number };
  kpis: ReportKPIs;
  summary: SummaryStats | null;
  rows: ReportRow[];
}

export function buildReportModel(records: EnergyRecord[], meta: ReportMeta): ReportModel {
  const points = toPoints(records);
  const freq = detectFrequency(points);
  const ppy = periodsPerYear(freq);
  const window = freq === "annual" ? 3 : ppy;

  const summary = summaryStats(points);
  const yoy = new Map(yoyChange(points).map((c) => [c.period, c.pct]));
  const pop = new Map(periodChange(points).map((c) => [c.period, c.pct]));
  const roll = new Map(rollingMean(points, window).map((r) => [r.period, r.value]));
  const cum = new Map(cumulative(points).map((c) => [c.period, c.value]));
  const idx = new Map(indexed(points, 100).map((i) => [i.period, i.value]));

  // Region is not on the normalized Point; recover it by matching period_date.
  const regionByPeriod = new Map(records.map((r) => [r.period, r.region ?? "NGA"]));

  const rows: ReportRow[] = points.map((p) => ({
    period: p.period,
    periodDate: p.periodDate,
    region: regionByPeriod.get(p.period) ?? "NGA",
    value: p.value,
    yoyPct: yoy.get(p.period) ?? null,
    popPct: pop.get(p.period) ?? null,
    rolling: roll.get(p.period) ?? null,
    cumulative: cum.get(p.period) ?? 0,
    index: idx.get(p.period) ?? 100,
  }));

  const latest = points.at(-1) ?? null;
  const kpis: ReportKPIs = {
    latest: latest?.value ?? null,
    latestPeriod: latest?.period ?? "—",
    yoyPct: latest ? yoy.get(latest.period) ?? null : null,
    popPct: latest ? pop.get(latest.period) ?? null : null,
    cagr: summary?.cagr ?? null,
    rolling: latest ? roll.get(latest.period) ?? null : null,
    min: summary?.min ?? 0,
    max: summary?.max ?? 0,
    mean: summary?.mean ?? 0,
    volatilityPct: summary?.volatilityPct ?? 0,
  };

  return {
    meta: {
      ...meta,
      generatedAt: new Date().toISOString(),
      recordCount: records.length,
      frequencyDetected: freq,
      smoothingWindow: window,
    },
    kpis,
    summary,
    rows,
  };
}
