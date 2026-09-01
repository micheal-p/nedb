// ── lib/records-ground.ts ───────────────────────────────────────────────────
// Deterministic retrieval of committed statistics for Apex AI.
//
// The assistant's job split is strict: the data bank supplies every figure,
// the language model supplies only the words. Embeddings are the wrong tool
// for numeric series — "crude oil production in 2024" needs the actual rows,
// matched by name and period, not a paragraph that sounds similar. So this is
// plain token matching over a table of ~15 series, and it is auditable in a
// way a vector similarity score never is.
//
// Every line carries the record's id. The model must repeat that id, verbatim,
// as [rec N] beside any figure it states, and the route hands the cited
// records back to the UI so a reader can check each number against the row it
// came from — series, period, value, source, and whether the figure is
// provisional, revised or final.

import { db } from "@/lib/supabase-server";

export type GroundedRecord = {
  id: number;
  series_type_id: string;
  series_name: string;
  period: string;
  region: string | null;
  fuel_product: string | null;
  value: number;
  unit: string | null;
  source: string | null;
  status: string | null;
  revision_count: number | null;
};

type SeriesRow = {
  id: string; name: string; unit_default: string | null;
  is_public: boolean | null; public_fields: string[] | null;
};

// Everyday words → the vocabulary the series actually use. Kept small and
// literal; a miss just means the docs and graph answer instead.
const SYNONYMS: Record<string, string[]> = {
  petrol: ["pms"], fuel: ["pms"], gasoline: ["pms"],
  diesel: ["ago"],
  kerosene: ["hhk", "dpk"],
  "cooking": ["lpg"],
  lpg: ["lpg"],
  power: ["electricity"], light: ["electricity"], grid: ["electricity"],
  oil: ["crude"], barrels: ["crude"],
  firewood: ["fuelwood"], wood: ["fuelwood"],
  capacity: ["installed", "capacity"],
  renewables: ["renewable"],
};

const tokenize = (s: string) =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);

/**
 * Retrieve the committed records a question is about, formatted for the
 * prompt, plus the metadata the route returns for verification.
 *
 * includeNonPublic: staff sessions ground on everything; anonymous visitors
 * ground only on series the api-exposure control plane has published with
 * their values — the assistant must not become a side door around it.
 */
export async function retrieveRecords(
  question: string,
  includeNonPublic: boolean
): Promise<{ contextLines: string; records: GroundedRecord[] }> {
  const none = { contextLines: "", records: [] as GroundedRecord[] };

  const { data: seriesData } = await db()
    .from("series_types")
    .select("id, name, unit_default, is_public, public_fields");
  let series = (seriesData ?? []) as SeriesRow[];
  if (!series.length) return none;

  if (!includeNonPublic) {
    series = series.filter(
      (s) => s.is_public && (!s.public_fields || s.public_fields.includes("value"))
    );
  }

  // Expand the question through the synonym map, then score each series by
  // how many of its own name/id tokens appear.
  const qTokens = new Set(tokenize(question));
  for (const t of [...qTokens]) for (const syn of SYNONYMS[t] ?? []) qTokens.add(syn);

  const scored = series
    .map((s) => {
      const own = new Set([...tokenize(s.name), ...s.id.split("_")]);
      let score = 0;
      for (const t of own) if (qTokens.has(t)) score++;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (!scored.length) return none;

  const nameOf = new Map(series.map((s) => [s.id, s.name]));
  const ids = scored.map((x) => x.s.id);

  const { data: recData } = await db()
    .from("energy_records")
    .select("id, series_type_id, period, region, fuel_product, value, unit, source, status, revision_count")
    .in("series_type_id", ids)
    .order("period", { ascending: false })
    .limit(400);
  let rows = (recData ?? []) as Omit<GroundedRecord, "series_name">[];
  if (!rows.length) return none;

  // Years named in the question narrow the periods; otherwise recent first.
  const years = [...question.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => m[0]);
  if (years.length) {
    const filtered = rows.filter((r) => years.some((y) => r.period?.startsWith(y)));
    if (filtered.length) rows = filtered;
  }
  rows = rows.slice(0, 48);

  const records: GroundedRecord[] = rows.map((r) => ({
    ...r,
    series_name: nameOf.get(r.series_type_id) ?? r.series_type_id,
  }));

  const contextLines = records
    .map((r) => {
      const where = r.region && r.region !== "NGA" ? `, ${r.region}` : "";
      const prod = r.fuel_product && r.fuel_product !== "Crude" ? ` (${r.fuel_product})` : "";
      const rev = r.status && r.status !== "final" ? `; ${r.status}${r.revision_count ? `, revision ${r.revision_count}` : ""}` : "";
      return `[rec ${r.id}] ${r.series_name}${prod} — ${r.period}${where}: ${r.value.toLocaleString("en-US")} ${r.unit ?? ""} (source: ${r.source ?? "unrecorded"}${rev})`;
    })
    .join("\n");

  return { contextLines, records };
}

/** The [rec N] markers a generated answer actually used, in order. */
export function citedRecordIds(answer: string): number[] {
  const seen = new Set<number>();
  for (const m of answer.matchAll(/\[rec (\d+)\]/g)) seen.add(Number(m[1]));
  return [...seen];
}
