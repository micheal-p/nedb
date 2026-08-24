import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { cacheDel } from "@/lib/redis";

// Columns of energy_records an administrator may expose. Anything not on this
// list is internal and is never offered in the UI.
export const EXPOSABLE_FIELDS = ["period", "period_date", "value", "unit", "region", "source", "fuel_product"];

// GET /api/admin/api-exposure — every series with its publication state
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return err("admin access required", 403);

  const { data, error } = await db()
    .from("series_types")
    .select("id, name, sector, unit_default, frequency, is_public, public_fields, public_note, energy_records(count)")
    .order("sector").order("name");
  if (error) return err(error.message, 500);

  const rows = (data ?? []).map((s: Record<string, unknown>) => ({
    ...s,
    record_count: (s.energy_records as { count: number }[])?.[0]?.count ?? 0,
    energy_records: undefined,
  }));
  return ok({ series: rows, exposable_fields: EXPOSABLE_FIELDS });
}

// PUT /api/admin/api-exposure — publish or withdraw a series, set its fields
export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return err("admin access required", 403);

  const body = await req.json().catch(() => null);
  if (!body?.id) return err("id is required");

  const patch: Record<string, unknown> = {};
  if (body.is_public !== undefined) patch.is_public = !!body.is_public;
  if (body.public_note !== undefined) patch.public_note = String(body.public_note ?? "").trim() || null;
  if (Array.isArray(body.public_fields)) {
    const clean = body.public_fields.filter((f: string) => EXPOSABLE_FIELDS.includes(f));
    if (!clean.includes("period") || !clean.includes("value")) {
      return err("period and value must stay exposed — a series without them is not usable data.");
    }
    patch.public_fields = clean;
  }
  if (!Object.keys(patch).length) return err("nothing to update");

  const { data: before } = await db().from("series_types").select("name, is_public").eq("id", body.id).single();
  if (!before) return err("series not found", 404);

  const { error } = await db().from("series_types").update(patch).eq("id", body.id);
  if (error) return err(error.message, 500);

  // The published catalogue is cached; withdrawing must take effect at once.
  await cacheDel("series:list:public", "series:list");

  const changedPublication = patch.is_public !== undefined && patch.is_public !== before.is_public;
  await logAudit({
    action: changedPublication ? (patch.is_public ? "API_PUBLISH" : "API_WITHDRAW") : "API_FIELDS",
    series_type_id: String(body.id),
    performed_by: String(auth.username ?? auth.sub ?? "unknown"),
    notes: changedPublication
      ? `${patch.is_public ? "Published" : "Withdrew"} ${before.name} on the public API`
      : `Updated public API fields for ${before.name}`,
  });

  return ok({ updated: true });
}
