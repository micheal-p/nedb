import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAdmin, ok, err } from "@/lib/api-helpers";

// GET /api/admin/freeze — list all frozen periods
export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req);
  if (!claims) return err("admin required", 403);

  const { searchParams } = new URL(req.url);
  const series = searchParams.get("series") ?? "";

  let query = db()
    .from("frozen_periods")
    .select("id, series_type_id, period, frozen_by, frozen_at, reason")
    .order("frozen_at", { ascending: false });

  if (series) query = query.eq("series_type_id", series);

  const { data, error } = await query;
  if (error) return err(error.message, 500);
  return ok({ frozen: data ?? [] });
}

// POST /api/admin/freeze — freeze a period
export async function POST(req: NextRequest) {
  const claims = await requireAdmin(req);
  if (!claims) return err("admin required", 403);

  const body = await req.json().catch(() => null);
  if (!body?.series_type_id || !body?.period) return err("series_type_id and period required", 400);

  const { error } = await db().from("frozen_periods").insert({
    series_type_id: body.series_type_id,
    period:         body.period,
    frozen_by:      claims.username,
    reason:         body.reason ?? null,
  });

  if (error) return err(error.message, 500);
  return ok({ frozen: true, series_type_id: body.series_type_id, period: body.period });
}

// DELETE /api/admin/freeze — unfreeze by id
export async function DELETE(req: NextRequest) {
  const claims = await requireAdmin(req);
  if (!claims) return err("admin required", 403);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return err("id required", 400);

  const { error } = await db().from("frozen_periods").delete().eq("id", Number(id));
  if (error) return err(error.message, 500);
  return ok({ unfrozen: Number(id) });
}
