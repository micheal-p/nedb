// ── lib/api-exposure.ts ─────────────────────────────────────────────────────
// The gate between the data bank and the public API.
//
// Two rules, both administered from Admin → Public API:
//   1. A series is served publicly only when is_public is true.
//   2. Only the columns listed in public_fields are ever returned.
//
// Callers presenting a valid API key get the same published data with a higher
// rate limit — a key raises your quota, it does not widen what you can see.
// Internal columns are additionally hard-blocked here so a bad public_fields
// value can never expose them.

import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { checkRateLimitDurable } from "@/lib/rate-limit";

/** Columns that must never leave the platform, whatever public_fields says. */
const NEVER_PUBLIC = new Set([
  "id", "upload_session_id", "lga_id", "notes", "methodology_version", "created_at", "created_by",
]);

const DEFAULT_FIELDS = ["period", "period_date", "value", "unit", "region", "source"];

export type PublishedSeries = {
  id: string;
  name: string;
  sector: string;
  unit_default: string;
  frequency: string;
  is_public: boolean;
  public_fields: string[];
  public_note: string | null;
};

/** Sanitised column list for a series — always safe to hand to .select(). */
export function publicColumns(fields: string[] | null | undefined): string[] {
  const list = (fields?.length ? fields : DEFAULT_FIELDS).filter((f) => !NEVER_PUBLIC.has(f));
  return list.length ? list : DEFAULT_FIELDS;
}

/** Every published series. */
export async function listPublished(): Promise<PublishedSeries[]> {
  const { data } = await db()
    .from("series_types")
    .select("id, name, sector, unit_default, frequency, is_public, public_fields, public_note")
    .eq("is_public", true)
    .order("sector")
    .order("name");
  return (data ?? []) as PublishedSeries[];
}

/** One published series, or null when it is unpublished or unknown. */
export async function getPublished(id: string): Promise<PublishedSeries | null> {
  const { data } = await db()
    .from("series_types")
    .select("id, name, sector, unit_default, frequency, is_public, public_fields, public_note")
    .eq("id", id)
    .single();
  if (!data || !data.is_public) return null;
  return data as PublishedSeries;
}

export type ApiCaller = {
  keyed: boolean;
  label: string | null;
  limitPerMinute: number;
};

/**
 * Identify the caller and apply their quota.
 * Anonymous callers get a modest shared limit; a valid key raises it and is
 * metered. Returns null when the request should be refused.
 */
export async function authorizeApiCall(req: NextRequest): Promise<
  { ok: true; caller: ApiCaller } | { ok: false; status: number; error: string }
> {
  const presented = req.headers.get("x-api-key")?.trim();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";

  if (presented) {
    const { data: key } = await db()
      .from("api_keys")
      .select("id, key, label, is_active, rate_limit, call_count")
      .eq("key", presented)
      .single();

    if (!key || !key.is_active) {
      return { ok: false, status: 401, error: "Invalid or revoked API key." };
    }

    const limit = Number(key.rate_limit ?? 600);
    const rl = await checkRateLimitDurable(`api:key:${key.id}`, limit, 60);
    if (!rl.allowed) {
      return { ok: false, status: 429, error: `Rate limit reached (${limit}/minute). Try again in ${rl.resetIn}s.` };
    }

    // Metering is best-effort: never fail a served request over bookkeeping.
    db().from("api_keys")
      .update({ last_used: new Date().toISOString(), call_count: Number(key.call_count ?? 0) + 1 })
      .eq("id", key.id)
      .then(undefined, () => {});

    return { ok: true, caller: { keyed: true, label: (key.label as string) ?? null, limitPerMinute: limit } };
  }

  const rl = await checkRateLimitDurable(`api:ip:${ip}`, 60, 60);
  if (!rl.allowed) {
    return { ok: false, status: 429, error: `Rate limit reached (60/minute for anonymous callers). Present an API key for a higher quota, or try again in ${rl.resetIn}s.` };
  }
  return { ok: true, caller: { keyed: false, label: null, limitPerMinute: 60 } };
}
