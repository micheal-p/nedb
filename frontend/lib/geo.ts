// ── lib/geo.ts ──────────────────────────────────────────────────────────────
// Shared geographic name normalization — usable from both server components
// (aggregation) and client components (polygon matching). LGA names differ in
// punctuation/case between our lgas table and the geoBoundaries file
// ("Ijebu North East" vs "Ijebu-North-East"), so both sides normalize through
// this single function before matching.

export function normLga(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// 24 LGA names are SPELLED differently (not just punctuated) between the
// geoBoundaries file and the lgas table — measured by diffing all 774 names
// on both sides (e.g. boundary "Yenegoa" vs DB "Yenagoa", "Yewa North" vs
// "Egbado North"). Keys are boundary-file spellings (normalized), values are
// the lgas-table spellings (normalized) — the DB form is canonical because
// every PENA response stores its lga_name from the lgas table.
const LGA_ALIASES: Record<string, string> = {
  "obi nwga": "obi ngwa",
  "osisioma ngwa": "osisioma",
  "dambam": "damban",
  "jama are": "jamaa",
  "yenegoa": "yenagoa",
  "oturkpo": "otukpo",
  "yakurr": "yakuur",
  "iguegben": "igueben",
  "mbatoli": "mbaitoli",
  "malam madori": "malam maduri",
  "garun malam": "garun mallam",
  "bagudu": "bagudo",
  "yewa north": "egbado north",
  "yewa south": "egbado south",
  "atakunmosa east": "atakumosa east",
  "atakunmosa west": "atakumosa west",
  "ayedade": "ayedaade",
  "ilesha east": "ilesa east",
  "ilesha west": "ilesa west",
  "ori ire": "orire",
  "omumma": "omuma",
  "wamakko": "wamako",
  "kurmi": "kumi",
  "nassarawa": "nasarawa",
};

// Canonical LGA key: normalize, then fold boundary-file spellings onto the
// lgas-table spelling. Use this (not normLga) whenever matching a boundary
// polygon name against database LGA names.
export function canonLga(name: string): string {
  const n = normLga(name);
  return LGA_ALIASES[n] ?? n;
}
