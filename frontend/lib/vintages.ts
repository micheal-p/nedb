// ── lib/vintages.ts ─────────────────────────────────────────────────────────
// Freezing the data bank into a vintage, and proving the freeze.
//
// A vintage is a PUBLICATION, so it contains only what the platform already
// publishes: the series the api-exposure console has marked public, and the
// k-anonymised aggregates of assessments already on the open-data page. The
// three withheld fiscal series stay out, and no PENA row-level data can ever
// enter — the aggregates come from lib/pena-public.ts, the single home of the
// privacy rules.
//
// The checksum is sha256 over a CANONICAL serialisation (keys sorted at every
// depth), so two parties serialising the same snapshot always get the same
// digest. That digest is the entire integrity story: it is printed in the
// catalogue, embedded in every download, and cited by working papers.

import { createHash } from "node:crypto";
import { db } from "@/lib/supabase-server";
import { K_ANON_MIN } from "@/lib/pena";
import { buildPublicAggregates } from "@/lib/pena-public";

/** JSON with keys sorted at every depth — same object, same bytes, always. */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
          .map(([k, val]) => [k, sort(val)])
      );
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

export type VintageBuild = {
  snapshot: Record<string, unknown>;
  manifest: Record<string, unknown>;
  checksum: string;
};

/** Read everything the platform publishes, right now, into one frozen document. */
export async function buildVintage(label: string): Promise<VintageBuild> {
  // 1. Published series and their records. Only public series enter a
  //    vintage, and only the fields the exposure console publishes for them.
  const { data: seriesData, error: se } = await db()
    .from("series_types")
    .select("id, name, sector, subsector, unit_default, frequency, geo_resolution, is_public, public_fields, public_note")
    .order("id");
  if (se) throw new Error(se.message);
  const publicSeries = (seriesData ?? []).filter((s) => s.is_public);

  const records: Record<string, unknown[]> = {};
  let recordCount = 0;
  for (const s of publicSeries) {
    const fields = (s.public_fields as string[] | null) ?? ["period", "value", "unit", "region", "source"];
    const cols = ["id", ...fields.filter((f) => f !== "id")];
    const rows: unknown[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db()
        .from("energy_records")
        .select(cols.join(", "))
        .eq("series_type_id", s.id)
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error(`${s.id}: ${error.message}`);
      rows.push(...((data ?? []) as unknown[]));
      if (!data || data.length < 1000) break;
    }
    records[s.id] = rows;
    recordCount += rows.length;
  }

  // 2. Open-data aggregates of every published assessment, through the one
  //    shared implementation of the privacy rules.
  const { data: forms, error: fe } = await db()
    .from("pena_forms")
    .select("id, slug, title, description, status, created_at")
    .eq("is_public_stats", true)
    .neq("status", "draft")
    .order("id");
  if (fe) throw new Error(fe.message);

  const assessments: Record<string, unknown>[] = [];
  for (const f of forms ?? []) {
    const agg = await buildPublicAggregates(f.id);
    assessments.push({
      slug: f.slug,
      title: f.title,
      description: f.description,
      status: f.status,
      created_at: f.created_at,
      k_anonymity_floor: K_ANON_MIN,
      ...agg,
    });
  }

  const frozen_at = new Date().toISOString();
  const snapshot: Record<string, unknown> = {
    vintage: label,
    frozen_at,
    publisher: "Nigeria Energy Data Bank (NEDB), Energy Commission of Nigeria",
    license: "Open data. Series records as published; assessment statistics are k-anonymised aggregates under NDPA 2023.",
    series: publicSeries.map((s) => ({
      id: s.id, name: s.name, sector: s.sector, subsector: s.subsector,
      unit_default: s.unit_default, frequency: s.frequency,
      geo_resolution: s.geo_resolution, public_note: s.public_note,
    })),
    records,
    assessments,
  };

  const checksum = sha256Hex(canonicalJson(snapshot));

  const manifest = {
    frozen_at,
    series_count: publicSeries.length,
    series_withheld: (seriesData ?? []).length - publicSeries.length,
    record_count: recordCount,
    assessment_count: assessments.length,
    series: publicSeries.map((s) => ({ id: s.id, name: s.name, records: (records[s.id] ?? []).length })),
    assessments: assessments.map((a) => ({ slug: a.slug, title: a.title, total_responses: a.total_responses, collecting: a.collecting })),
  };

  return { snapshot, manifest, checksum };
}

/** NEDB/VNT/yyyy/00001-style order reference, next in sequence. */
export async function nextOrderReference(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `NEDB/VNT/${year}/`;
  const { count } = await db()
    .from("vintage_orders")
    .select("id", { count: "exact", head: true })
    .like("reference", `${prefix}%`);
  return `${prefix}${String((count ?? 0) + 1).padStart(5, "0")}`;
}
