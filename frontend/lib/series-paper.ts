// ── lib/series-paper.ts ─────────────────────────────────────────────────────
// The evidence base for an AI-written series paper.
//
// The doctrine is unchanged: the data bank supplies every figure, the
// language model supplies only the words. This module builds the figures —
// record lines with [rec N] markers, and DERIVED lines (year-on-year moves,
// spans, extremes) computed HERE, deterministically, each declaring exactly
// which records it was computed from. The model may then narrate; it may not
// calculate. A paper regenerated against a newer vintage picks up every new
// record automatically, which is what keeps the research current: the writing
// improves because the evidence under it does.

import { db } from "@/lib/supabase-server";

export type SeriesEvidence = {
  id: string;
  name: string;
  unit: string;
  frequency: string | null;
  record_count: number;
  span: string;
  latest: { period: string; value: number; recId: number } | null;
  yoy: { pct: number; fromRec: number; toRec: number } | null;
  max: { period: string; value: number; recId: number } | null;
  min: { period: string; value: number; recId: number } | null;
};

export type PaperEvidence = {
  series: SeriesEvidence[];
  /** Prompt-ready lines: raw records + derived figures, all marked. */
  contextLines: string;
  /** Every record that appeared in a line, for citation verification. */
  records: { id: number; series: string; period: string; value: number; unit: string; source: string | null; status: string | null }[];
};

type Rec = {
  id: number; period: string; value: number; unit: string | null;
  source: string | null; status: string | null; region?: string | null;
};

const NATIONAL = new Set(["NGA", "", "national"]);
const isNational = (r: Rec) => !r.region || NATIONAL.has(String(r.region));

const fmtVal = (v: number) => v.toLocaleString("en-US");

/**
 * Gather evidence for the named series. When a vintage snapshot is supplied
 * the records come from the FROZEN document, so the paper is reproducible
 * from the exact edition it cites; otherwise from the live table.
 */
export async function buildSeriesEvidence(
  seriesIds: string[],
  snapshot?: { series?: { id: string; name: string; unit_default?: string | null; frequency?: string | null }[]; records?: Record<string, Rec[]> } | null
): Promise<PaperEvidence> {
  // Series metadata
  let meta: { id: string; name: string; unit_default: string | null; frequency: string | null }[];
  if (snapshot?.series) {
    meta = snapshot.series
      .filter((s) => seriesIds.includes(s.id))
      .map((s) => ({ id: s.id, name: s.name, unit_default: s.unit_default ?? null, frequency: s.frequency ?? null }));
  } else {
    const { data } = await db()
      .from("series_types")
      .select("id, name, unit_default, frequency, is_public")
      .in("id", seriesIds);
    meta = (data ?? []).filter((s) => s.is_public).map((s) => ({ id: s.id, name: s.name, unit_default: s.unit_default, frequency: s.frequency }));
  }

  const lines: string[] = [];
  const cited: PaperEvidence["records"] = [];
  const summaries: SeriesEvidence[] = [];

  for (const m of meta) {
    let recs: Rec[];
    if (snapshot?.records) {
      recs = (snapshot.records[m.id] ?? []) as Rec[];
    } else {
      const { data } = await db()
        .from("energy_records")
        .select("id, period, value, unit, source, status, region")
        .eq("series_type_id", m.id)
        .order("period", { ascending: true })
        .limit(1000);
      recs = (data ?? []) as Rec[];
    }
    recs = recs.filter((r) => isNational(r) && r.value != null).sort((a, b) => a.period.localeCompare(b.period));
    if (!recs.length) {
      summaries.push({ id: m.id, name: m.name, unit: m.unit_default ?? "", frequency: m.frequency, record_count: 0, span: "no records", latest: null, yoy: null, max: null, min: null });
      continue;
    }

    const unit = recs[recs.length - 1].unit ?? m.unit_default ?? "";
    const latest = recs[recs.length - 1];
    const maxR = recs.reduce((a, b) => (b.value > a.value ? b : a));
    const minR = recs.reduce((a, b) => (b.value < a.value ? b : a));

    // Year-on-year: the same period one year earlier (monthly), or the
    // previous year (annual). Derived HERE, never by the model.
    const monthly = /^\d{4}-\d{2}$/.test(latest.period);
    const prevPeriod = monthly
      ? `${Number(latest.period.slice(0, 4)) - 1}${latest.period.slice(4)}`
      : String(Number(latest.period) - 1);
    const prev = recs.find((r) => r.period === prevPeriod);
    const yoy = prev && prev.value !== 0
      ? { pct: ((latest.value - prev.value) / Math.abs(prev.value)) * 100, fromRec: prev.id, toRec: latest.id }
      : null;

    lines.push(`SERIES: ${m.name} (${unit}${m.frequency ? `, ${m.frequency}` : ""}) — ${recs.length} national records, ${recs[0].period} to ${latest.period}.`);
    // Recent records, capped: the newest 14 carry the story
    for (const r of recs.slice(-14)) {
      const rev = r.status && r.status !== "final" ? `; ${r.status}` : "";
      lines.push(`[rec ${r.id}] ${m.name} — ${r.period}: ${fmtVal(r.value)} ${unit} (source: ${r.source ?? "unrecorded"}${rev})`);
      if (!cited.some((c) => c.id === r.id)) cited.push({ id: r.id, series: m.name, period: r.period, value: r.value, unit, source: r.source, status: r.status });
    }
    for (const r of [maxR, minR]) {
      if (!cited.some((c) => c.id === r.id)) {
        lines.push(`[rec ${r.id}] ${m.name} — ${r.period}: ${fmtVal(r.value)} ${unit} (source: ${r.source ?? "unrecorded"})`);
        cited.push({ id: r.id, series: m.name, period: r.period, value: r.value, unit, source: r.source, status: r.status });
      }
    }
    if (yoy) lines.push(`DERIVED: ${m.name} year-on-year change at ${latest.period} = ${yoy.pct >= 0 ? "+" : ""}${yoy.pct.toFixed(1)}% (computed from [rec ${yoy.fromRec}] and [rec ${yoy.toRec}])`);
    lines.push(`DERIVED: ${m.name} series maximum ${fmtVal(maxR.value)} ${unit} in ${maxR.period} [rec ${maxR.id}]; minimum ${fmtVal(minR.value)} ${unit} in ${minR.period} [rec ${minR.id}]`);
    lines.push("");

    summaries.push({
      id: m.id, name: m.name, unit, frequency: m.frequency,
      record_count: recs.length,
      span: `${recs[0].period} – ${latest.period}`,
      latest: { period: latest.period, value: latest.value, recId: latest.id },
      yoy: yoy ? { pct: Math.round(yoy.pct * 10) / 10, fromRec: yoy.fromRec, toRec: yoy.toRec } : null,
      max: { period: maxR.period, value: maxR.value, recId: maxR.id },
      min: { period: minR.period, value: minR.value, recId: minR.id },
    });
  }

  return { series: summaries, contextLines: lines.join("\n"), records: cited };
}

export const SERIES_PAPER_PROMPT_RULES = `You are writing a short research paper for the Nigeria Energy Data Bank's working paper series, read by analysts, ministries and researchers.

ABSOLUTE RULES:
- Every figure you state must be copied from an evidence line below and followed immediately by its [rec N] marker exactly as written. DERIVED lines carry their own citations; repeat them when you use the derived figure.
- Do no arithmetic of any kind. No sums, averages, shares, conversions or rounding beyond what an evidence line already shows.
- Never speculate about causes the evidence cannot support. You may note that a movement coincides with another cited movement; you may not assert causation.
- If a series' evidence says provisional or revised beside a figure, say so where you use it.
- Where the evidence is thin (few records, short span), say so plainly in the limitations — thin evidence honestly described is the standard.

STRUCTURE, with these exact headings, each as a line starting with ## :
## Abstract
## What the series show
## Movements worth attention
## Coverage and data quality
## Limitations

Length: 450 to 700 words. Register: formal, plain, a national statistics office. No dash punctuation; use commas.`;
