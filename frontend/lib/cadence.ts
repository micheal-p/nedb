// ── lib/cadence.ts ──────────────────────────────────────────────────────────
// How often a series ACTUALLY reports, read from its records.
//
// `series_types.frequency` is a declaration of intent and it is not reliable.
// electricity_generation is registered as 'monthly' while every committed
// record is an annual total from Ember (one row a year, note "Annual total
// generation"). Two things trusted that column and both said something false as
// a result:
//
//   • the NECAL inputs route expected twelve records a year, found one, and put
//     a permanent "this year is INCOMPLETE, every figure is understated" banner
//     on a complete and correct annual figure;
//   • the bulletin computed year on year as rows[12], which on an annual series
//     is the value from twelve YEARS ago printed under the label "year on year".
//
// So cadence is inferred from the spacing of the periods actually held. The
// records are the evidence; the registry is a claim about the records.

export type Cadence = "monthly" | "quarterly" | "annual";

/** Records expected in a full year at this cadence. */
export function recordsPerYear(c: Cadence): number {
  return c === "monthly" ? 12 : c === "quarterly" ? 4 : 1;
}

/** How many records back one year sits, at this cadence. */
export const stepsBackOneYear = recordsPerYear;

/**
 * Infer cadence from the median gap between distinct period dates.
 *
 * Median rather than mean, because a single backfilled gap or a duplicated row
 * would drag an average across a boundary. Fewer than two distinct periods
 * carries no evidence of spacing at all, so it falls back to the declared
 * frequency rather than guessing.
 */
export function inferCadence(periodDates: Array<string | Date>, declared?: string | null): Cadence {
  const times = [...new Set(
    periodDates
      .map((d) => new Date(d).getTime())
      .filter((t) => Number.isFinite(t))
  )].sort((a, b) => b - a);

  if (times.length < 2) return normaliseDeclared(declared);

  const gapsInDays: number[] = [];
  for (let i = 0; i < times.length - 1; i++) {
    gapsInDays.push((times[i] - times[i + 1]) / 86_400_000);
  }
  gapsInDays.sort((a, b) => a - b);
  const median = gapsInDays[Math.floor(gapsInDays.length / 2)];

  // Wide bands on purpose: month lengths vary, and a series that skips a period
  // should still be recognised rather than promoted to the next cadence up.
  if (median <= 45) return "monthly";
  if (median <= 200) return "quarterly";
  return "annual";
}

/** The declared frequency, when there is no evidence to read instead. */
export function normaliseDeclared(declared?: string | null): Cadence {
  const d = String(declared ?? "").toLowerCase();
  if (d === "monthly") return "monthly";
  if (d === "quarterly") return "quarterly";
  return "annual";
}

/** Human label for a cadence, for notes shown to a reader. */
export function cadenceLabel(c: Cadence): string {
  return c === "monthly" ? "monthly" : c === "quarterly" ? "quarterly" : "annual";
}

/**
 * True when the observed cadence contradicts what the registry declares.
 * Worth surfacing: it means the registry needs correcting, and it is the sort
 * of thing that silently poisons anything trusting the column.
 */
export function cadenceMismatch(observed: Cadence, declared?: string | null): boolean {
  if (!declared) return false;
  return observed !== normaliseDeclared(declared);
}
