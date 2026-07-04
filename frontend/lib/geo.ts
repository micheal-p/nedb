// ── lib/geo.ts ──────────────────────────────────────────────────────────────
// Shared geographic name normalization — usable from both server components
// (aggregation) and client components (polygon matching). LGA names differ in
// punctuation/case between our lgas table and the geoBoundaries file
// ("Ijebu North East" vs "Ijebu-North-East"), so both sides normalize through
// this single function before matching.

export function normLga(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
