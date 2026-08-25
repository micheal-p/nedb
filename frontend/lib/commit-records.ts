// ── lib/commit-records.ts ───────────────────────────────────────────────────
// The single write path into energy_records. Every route that publishes data
// (file commit, review approval, manual entry) goes through commitRecords so
// the same guarantees hold everywhere:
//
//   • frozen periods are refused, not silently written
//   • a conflicting (series, period, region) is REPLACED, not duplicated —
//     the upload UI has always promised replacement while the code inserted
//     duplicates, so charts silently double-counted
//   • every replacement lands in audit_log with old → new, which is what
//     feeds the public Data Revision Log
//   • anomaly detection runs on what was actually written
//
// Returns a summary the caller can surface verbatim.

import { db } from "@/lib/supabase-server";
import { logAudit } from "@/lib/audit";
import { cacheDel } from "@/lib/redis";
import { detectAndFlag } from "@/lib/anomaly";

export type IncomingRecord = {
  series_type_id: string;
  period: string;
  period_date: string;
  region?: string | null;
  lga_id?: number | null;
  fuel_product?: string | null;
  value: number;
  unit: string;
  source?: string | null;
  notes?: string | null;
  methodology_version?: string | null;
  upload_session_id?: number | null;
};

export type CommitResult =
  | { ok: true; inserted: number; replaced: number; frozen: string[] }
  | { ok: false; error: string; frozen?: string[] };

/** Periods of this series that are frozen and must not be written. */
async function frozenPeriods(seriesId: string): Promise<Set<string>> {
  const { data } = await db()
    .from("frozen_periods")
    .select("period")
    .eq("series_type_id", seriesId);
  return new Set((data ?? []).map((r) => String(r.period)));
}

export async function commitRecords(
  rows: IncomingRecord[],
  opts: { performedBy: string; reason: string; sessionId?: number | null }
): Promise<CommitResult> {
  if (!rows.length) return { ok: false, error: "no rows to commit" };

  const seriesId = rows[0].series_type_id;
  const client = db();

  // ── 1. Frozen-period guard ────────────────────────────────────────────────
  // "*" freezes the whole series. A frozen period is a published figure the
  // statistics office has locked; writing through it silently would break the
  // revision trail.
  const frozen = await frozenPeriods(seriesId);
  if (frozen.size) {
    const blocked = [...new Set(rows.filter((r) => frozen.has(r.period) || frozen.has("*")).map((r) => r.period))];
    if (blocked.length) {
      return {
        ok: false,
        error: frozen.has("*")
          ? `All periods of this series are frozen. Unlock the series before committing.`
          : `These periods are frozen and were not written: ${blocked.join(", ")}. Unlock them first.`,
        frozen: blocked,
      };
    }
  }

  const key = (r: { period: string; region?: string | null }) => `${r.period}|${r.region ?? "NGA"}`;

  // ── 2. Find what this commit replaces ────────────────────────────────────
  const periods = [...new Set(rows.map((r) => r.period))];
  const { data: existing } = await client
    .from("energy_records")
    .select("id, period, region, value")
    .eq("series_type_id", seriesId)
    .in("period", periods);

  const existingByKey = new Map<string, { id: number; value: number }[]>();
  for (const ex of existing ?? []) {
    const k = key({ period: ex.period as string, region: ex.region as string | null });
    if (!existingByKey.has(k)) existingByKey.set(k, []);
    existingByKey.get(k)!.push({ id: ex.id as number, value: Number(ex.value ?? 0) });
  }

  const replacedIds: number[] = [];
  const replacements: { period: string; region: string; oldValue: number; newValue: number }[] = [];
  for (const r of rows) {
    const prior = existingByKey.get(key(r));
    if (!prior?.length) continue;
    for (const p of prior) replacedIds.push(p.id);
    replacements.push({ period: r.period, region: r.region ?? "NGA", oldValue: prior[0].value, newValue: r.value });
  }

  // ── 3. Replace, then insert ──────────────────────────────────────────────
  if (replacedIds.length) {
    const { error: de } = await client.from("energy_records").delete().in("id", replacedIds);
    if (de) return { ok: false, error: `could not replace existing records: ${de.message}` };
  }

  const { error: ie } = await client.from("energy_records").insert(rows);
  if (ie) {
    // Since migration 051 the database enforces one record per
    // (series, period, region, fuel product). Before that it did not, and a
    // migration run twice put 36 duplicate rows into the bank unnoticed. A raw
    // Postgres constraint message helps nobody at an upload screen, so the one
    // failure this path can now hit is explained in the terms of the workflow.
    if (/uq_energy_records_key|duplicate key/i.test(ie.message)) {
      return {
        ok: false,
        error:
          "This upload would create a second record for a period that already has one, " +
          "and the data bank now holds one figure per series, period and region. " +
          "That normally means the same file is being committed twice. Re-validate the file: " +
          "conflicting rows are shown as replacements, and committing then revises the existing figure instead of adding to it.",
      };
    }
    return { ok: false, error: `failed to write records: ${ie.message}` };
  }

  // ── 4. Audit ─────────────────────────────────────────────────────────────
  await logAudit({
    action: "INSERT",
    series_type_id: seriesId,
    performed_by: opts.performedBy,
    notes: `${opts.reason} — ${rows.length} record${rows.length === 1 ? "" : "s"}${replacements.length ? `, ${replacements.length} replaced` : ""}`,
  });
  // One line per revised figure so the public Revision Log shows old → new.
  for (const rep of replacements.slice(0, 200)) {
    await logAudit({
      action: "edit",
      series_type_id: seriesId,
      period: rep.period,
      region: rep.region,
      old_value: rep.oldValue,
      new_value: rep.newValue,
      performed_by: opts.performedBy,
      notes: `Value revised by ${opts.reason.toLowerCase()}`,
    });
  }

  await cacheDel(`stats:${seriesId}`, "series:list");

  // ── 5. Anomaly detection on what actually landed ─────────────────────────
  if (opts.sessionId) {
    const { data: inserted } = await client
      .from("energy_records")
      .select("id, series_type_id, period, region, value")
      .eq("upload_session_id", opts.sessionId);
    if (inserted?.length) detectAndFlag(inserted).catch(() => {});
  }

  return { ok: true, inserted: rows.length, replaced: replacements.length, frozen: [] };
}
