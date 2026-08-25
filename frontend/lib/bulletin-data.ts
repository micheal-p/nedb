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

export type PeriodKind = "month" | "year";

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
};

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Build a window from a kind and an anchor date. */
export function makeWindow(kind: PeriodKind, year: number, month?: number): BulletinWindow {
  if (kind === "year") {
    return { kind, start: `${year}-01-01`, end: `${year}-12-31`, label: String(year) };
  }
  const m = Math.min(12, Math.max(1, month ?? 1));
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return {
    kind,
    start: `${year}-${pad(m)}-01`,
    end: `${year}-${pad(m)}-${pad(lastDay)}`,
    label: `${MONTHS[m - 1]} ${year}`,
  };
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

  const empty: BulletinData = {
    series: [], sectorStats: {}, totalRecords: 0, movers: [],
    generated_at: new Date().toISOString(), window, in_period_count: 0,
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
      const blank = {
        ...s, latest: null, latest_period: null, yoy_pct: null,
        cadence: normaliseDeclared(s.frequency), in_period: false, change_basis: null,
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

  return {
    series: statsResults,
    sectorStats,
    totalRecords,
    movers,
    generated_at: new Date().toISOString(),
    window,
    in_period_count: statsResults.filter((s) => s.in_period).length,
  };
}
