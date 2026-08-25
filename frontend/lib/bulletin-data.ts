// ── lib/bulletin-data.ts ────────────────────────────────────────────────────
// Computes the bulletin statistics from committed records. Used two ways:
// the live provisional view on /bulletin, and the frozen snapshot written
// into bulletin_editions when a draft edition is created. Server-only.
//
// Two things this file used to get wrong, both from assuming a cadence instead
// of reading one:
//
//   • It took no period at all. An edition labelled "August 2026" showed the
//     newest record of every series, which for generation is a 2024 annual
//     total. The masthead said one month, the figures were from another year,
//     and nothing on the page admitted the difference.
//   • It computed "year on year" as rows[12], which is one year back only on a
//     monthly series. On the annual series NEDB actually holds, rows[12] is
//     twelve YEARS ago, printed under the label "year on year".
//
// A bulletin is now built FOR a period. Series with a record in that window
// report it. Series without one say so and fall back to their latest, marked,
// because a monthly bulletin that silently prints two-year-old annual figures
// as this month's news is the kind of thing a statistics agency gets remembered
// for.

import { db } from "@/lib/supabase-server";
import { inferCadence, stepsBackOneYear, cadenceLabel, normaliseDeclared, type Cadence } from "@/lib/cadence";
export { SECTOR_LABEL } from "@/lib/bulletin-shared";

export type PeriodKind = "month" | "quarter" | "year";

/** The window an edition is built for. */
export type BulletinWindow = {
  kind: PeriodKind;
  /** Inclusive ISO date, e.g. "2026-08-01". */
  start: string;
  /** Inclusive ISO date, e.g. "2026-08-31". */
  end: string;
  /** e.g. "August 2026" or "2026". */
  label: string;
};

export type BulletinSeries = {
  id: string; name: string; sector: string; unit: string; frequency: string;
  record_count: number;
  latest: number | null; latest_period: string | null; yoy_pct: number | null;
  /** Cadence read from the records, which may contradict `frequency`. */
  cadence: Cadence;
  /** True when the reported value falls inside the edition's window. */
  in_period: boolean;
  /** What the change is measured against, in words. Null when there is none. */
  change_basis: string | null;

  // ── Differential analysis ────────────────────────────────────────────────
  /** Total across the window, which for a quarter is the sum of its months. */
  period_total: number | null;
  /** How many records made up that total. */
  period_records: number;
  /** Change against the immediately preceding period, percent. */
  vs_previous_pct: number | null;
  /** Change against the same period one year earlier, percent. */
  vs_year_ago_pct: number | null;
  /** Totals for the two comparison windows, so the reader can check the sums. */
  previous_total: number | null;
  year_ago_total: number | null;
};

/** One quarter of a year, summarised for the Q1 to Q4 comparison. */
export type QuarterSummary = {
  label: string;          // "Q1 2026"
  quarter: number;        // 1-4
  start: string;
  end: string;
  /** Per-series totals inside that quarter, keyed by series id. */
  totals: Record<string, number | null>;
  /** Series that reported at all in the quarter. */
  reporting: number;
  /**
   * Series whose cadence is annual, so their figure sits in whichever quarter
   * its single date falls in rather than being a quarterly split.
   */
  annualStamped: string[];
};

export type BulletinData = {
  series: BulletinSeries[];
  sectorStats: Record<string, { label: string; count: number; records: number }>;
  totalRecords: number;
  movers: BulletinSeries[];
  generated_at: string;   // ISO — the data cutoff for a frozen edition
  /** The window this edition covers. Null for an unscoped legacy edition. */
  window: BulletinWindow | null;
  /** How many series actually reported inside the window. */
  in_period_count: number;
  /**
   * The window this edition is measured against, and the one a year before.
   * `sameWindow` is true on a year edition, where they are the same thing.
   */
  comparison: { previous: BulletinWindow; year_ago: BulletinWindow; sameWindow: boolean } | null;
  /**
   * Q1 to Q4 for the edition's year, present on quarter and year editions.
   * This is the differential view: four columns, one per quarter, so a series
   * can be read across the year rather than as a single number.
   */
  quarters: QuarterSummary[] | null;
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Build a window from a kind and an anchor.
 *
 * `unit` is the month (1-12) for a month window and the quarter (1-4) for a
 * quarter window. It is ignored for a year.
 */
export function makeWindow(kind: PeriodKind, year: number, unit?: number): BulletinWindow {
  if (kind === "year") {
    return { kind, start: `${year}-01-01`, end: `${year}-12-31`, label: String(year) };
  }
  if (kind === "quarter") {
    const q = Math.min(4, Math.max(1, unit ?? 1));
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
    return {
      kind,
      start: `${year}-${pad(startMonth)}-01`,
      end: `${year}-${pad(endMonth)}-${pad(lastDay)}`,
      label: `Q${q} ${year}`,
    };
  }
  const m = Math.min(12, Math.max(1, unit ?? 1));
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return {
    kind,
    start: `${year}-${pad(m)}-01`,
    end: `${year}-${pad(m)}-${pad(lastDay)}`,
    label: `${MONTHS[m - 1]} ${year}`,
  };
}

/** The window immediately before this one: last month, last quarter, last year. */
export function previousWindow(w: BulletinWindow): BulletinWindow {
  const y = Number(w.start.slice(0, 4));
  if (w.kind === "year") return makeWindow("year", y - 1);
  if (w.kind === "quarter") {
    const q = Math.floor(Number(w.start.slice(5, 7)) / 3) + 1;
    return q === 1 ? makeWindow("quarter", y - 1, 4) : makeWindow("quarter", y, q - 1);
  }
  const m = Number(w.start.slice(5, 7));
  return m === 1 ? makeWindow("month", y - 1, 12) : makeWindow("month", y, m - 1);
}

/** The same window one year earlier, for a like-for-like comparison. */
export function yearAgoWindow(w: BulletinWindow): BulletinWindow {
  const y = Number(w.start.slice(0, 4)) - 1;
  if (w.kind === "year") return makeWindow("year", y);
  if (w.kind === "quarter") return makeWindow("quarter", y, Math.floor(Number(w.start.slice(5, 7)) / 3) + 1);
  return makeWindow("month", y, Number(w.start.slice(5, 7)));
}

/** The four quarters of a year, for a Q1 to Q4 comparison. */
export function quartersOf(year: number): BulletinWindow[] {
  return [1, 2, 3, 4].map((q) => makeWindow("quarter", year, q));
}

/** The window covering the month before today, which is what a monthly bulletin reports on. */
export function defaultWindow(): BulletinWindow {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  return makeWindow("month", m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1);
}

export async function getBulletinData(window: BulletinWindow | null = null): Promise<BulletinData> {
  const { data: series } = await db()
    .from("series_types")
    .select("id, name, sector, unit_default, frequency, energy_records(count)")
    .order("sector").order("name");

  // On a year edition the previous period and the same period a year earlier
  // are the same window, so the second comparison is dropped rather than shown
  // twice under two different headings.
  const comparison = window
    ? (() => {
        const previous = previousWindow(window);
        const year_ago = yearAgoWindow(window);
        return { previous, year_ago, sameWindow: previous.start === year_ago.start };
      })()
    : null;

  const empty: BulletinData = {
    series: [], sectorStats: {}, totalRecords: 0, movers: [],
    generated_at: new Date().toISOString(), window, in_period_count: 0,
    comparison, quarters: null,
  };
  if (!series) return empty;

  const shaped = series.map((s) => ({
    id: s.id as string,
    name: s.name as string,
    sector: s.sector as string,
    unit: s.unit_default as string,
    frequency: s.frequency as string,
    record_count: (s.energy_records as { count: number }[])?.[0]?.count ?? 0,
  }));

  const statsResults: BulletinSeries[] = await Promise.all(
    shaped.map(async (s) => {
      // Enough history to reach one year back at any cadence, plus headroom.
      const { data } = await db()
        .from("energy_records")
        .select("period, period_date, value, unit")
        .eq("series_type_id", s.id)
        .order("period_date", { ascending: false })
        .limit(40);

      const rows = data ?? [];
      // No records is no evidence, so the declared frequency stands and nothing
      // is flagged as contradicting it. Reporting an empty series as "annual,
      // and the registry disagrees" invents a discrepancy out of absence.
      const blank: BulletinSeries = {
        ...s, latest: null, latest_period: null, yoy_pct: null,
        cadence: normaliseDeclared(s.frequency), in_period: false, change_basis: null,
        period_total: null, period_records: 0,
        vs_previous_pct: null, vs_year_ago_pct: null,
        previous_total: null, year_ago_total: null,
      };
      if (!rows.length) return blank;

      // Cadence from the records themselves. See lib/cadence.ts.
      const cadence = inferCadence(rows.map((r) => String(r.period_date)), s.frequency);

      // The value this edition reports: the one inside the window if there is
      // one, otherwise the most recent, flagged as out of period.
      const inWindow = window
        ? rows.filter((r) => {
            const d = String(r.period_date).slice(0, 10);
            return d >= window.start && d <= window.end;
          })
        : rows;

      const chosen = (inWindow.length ? inWindow : rows)[0];
      const in_period = inWindow.length > 0;
      const chosenIdx = rows.findIndex((r) => r.period === chosen.period && r.period_date === chosen.period_date);

      // Change is measured against the SAME period one year earlier, stepped by
      // the observed cadence. On an annual series that is the previous row; on a
      // monthly series it is twelve rows back.
      const back = stepsBackOneYear(cadence);
      const priorRow = rows[chosenIdx + back] ?? null;
      const comparable = priorRow && String(priorRow.unit ?? "") === String(chosen.unit ?? "");
      const yoy_pct =
        comparable && priorRow!.value && chosen.value !== null
          ? ((chosen.value - priorRow!.value) / Math.abs(priorRow!.value)) * 100
          : null;

      // ── Differential analysis ──────────────────────────────────────────
      // A quarter is the SUM of what fell inside it, not its newest record, so
      // a quarterly edition of a monthly series reports three months added up.
      // Comparisons are window against window rather than row against row,
      // which is the only way Q3 against Q2 means anything.
      const sumIn = (w: BulletinWindow | null) => {
        if (!w) return { total: null as number | null, count: 0 };
        const inW = rows.filter((r) => {
          const d = String(r.period_date).slice(0, 10);
          return d >= w.start && d <= w.end;
        });
        if (!inW.length) return { total: null as number | null, count: 0 };
        // Refuse to add across units; the sum would mean nothing.
        const units = new Set(inW.map((r) => String(r.unit ?? "")));
        if (units.size > 1) return { total: null as number | null, count: inW.length };
        return { total: inW.reduce((a, r) => a + Number(r.value ?? 0), 0), count: inW.length };
      };

      const thisPeriod = sumIn(window);
      const prevPeriod = sumIn(comparison?.previous ?? null);
      const yearAgo    = sumIn(comparison?.year_ago ?? null);

      const pct = (now: number | null, then: number | null) =>
        now !== null && then !== null && then !== 0
          ? ((now - then) / Math.abs(then)) * 100
          : null;

      return {
        ...s,
        latest: chosen.value,
        latest_period: chosen.period,
        unit: chosen.unit ?? s.unit,
        yoy_pct,
        cadence,
        in_period,
        change_basis: yoy_pct === null
          ? null
          : `against ${priorRow!.period}, one year earlier on a ${cadenceLabel(cadence)} series`,
        period_total: thisPeriod.total,
        period_records: thisPeriod.count,
        previous_total: prevPeriod.total,
        year_ago_total: yearAgo.total,
        vs_previous_pct: pct(thisPeriod.total, prevPeriod.total),
        vs_year_ago_pct: pct(thisPeriod.total, yearAgo.total),
      };
    })
  );

  const totalRecords = shaped.reduce((sum, s) => sum + s.record_count, 0);

  const sectorStats: Record<string, { label: string; count: number; records: number }> = {};
  for (const s of statsResults) {
    if (!sectorStats[s.sector]) {
      sectorStats[s.sector] = {
        label: s.sector.charAt(0).toUpperCase() + s.sector.slice(1),
        count: 0,
        records: 0,
      };
    }
    sectorStats[s.sector].count++;
    sectorStats[s.sector].records += s.record_count;
  }

  // Movers are drawn from what actually reported this period where possible, so
  // a "biggest movers" list is about the edition rather than about the archive.
  const scored = statsResults.filter((s) => s.yoy_pct !== null);
  const preferred = window ? scored.filter((s) => s.in_period) : scored;
  const movers = (preferred.length ? preferred : scored)
    .sort((a, b) => Math.abs(b.yoy_pct!) - Math.abs(a.yoy_pct!))
    .slice(0, 5);

  // ── Q1 to Q4 across the edition's year ────────────────────────────────────
  // Present on quarter and year editions, because that is where reading a
  // series across four columns is the point. Computed from the same records, so
  // it can never disagree with the table above it.
  let quarters: QuarterSummary[] | null = null;
  if (window && (window.kind === "quarter" || window.kind === "year")) {
    const year = Number(window.start.slice(0, 4));
    const qWindows = quartersOf(year);

    // Every series is included. An annual series carries its whole year on one
    // date, usually 1 January, so it lands entirely in Q1 and would read as
    // though nothing happened after March. Excluding it hides real data, so it
    // is shown and MARKED instead: the reader is told the figure sits in the
    // quarter it is dated, and is not a quarterly split.
    const annualCadence = new Set(statsResults.filter((x) => x.cadence === "annual").map((x) => x.id));

    const perSeries = await Promise.all(
      shaped.map(async (s) => {
        const { data } = await db()
          .from("energy_records")
          .select("period_date, value, unit")
          .eq("series_type_id", s.id)
          .gte("period_date", `${year}-01-01`)
          .lte("period_date", `${year}-12-31`)
          .limit(400);
        return { id: s.id, rows: data ?? [] };
      })
    );

    quarters = qWindows.map((w, i) => {
      const totals: Record<string, number | null> = {};
      let reporting = 0;
      for (const { id, rows } of perSeries) {
        const inQ = rows.filter((r) => {
          const d = String(r.period_date).slice(0, 10);
          return d >= w.start && d <= w.end;
        });
        if (!inQ.length) { totals[id] = null; continue; }
        const units = new Set(inQ.map((r) => String(r.unit ?? "")));
        totals[id] = units.size > 1 ? null : inQ.reduce((a, r) => a + Number(r.value ?? 0), 0);
        reporting++;
      }
      return { label: w.label, quarter: i + 1, start: w.start, end: w.end, totals, reporting, annualStamped: [...annualCadence] };
    });
  }

  return {
    series: statsResults,
    sectorStats,
    totalRecords,
    movers,
    generated_at: new Date().toISOString(),
    window,
    in_period_count: statsResults.filter((s) => s.in_period).length,
    comparison,
    quarters,
  };
}
