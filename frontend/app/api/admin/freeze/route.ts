import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAdmin, ok, err } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

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

  // Locking a published national figure is the most consequential thing an
  // administrator can do to a statistic, and it used to leave no trace at all.
  // The public revision log has carried a "Period frozen" label since it was
  // written; nothing ever produced one.
  await logAudit({
    action: "freeze",
    performed_by: String(claims.username ?? claims.sub ?? "unknown"),
    series_type_id: String(body.series_type_id),
    period: String(body.period),
    notes: body.reason
      ? `Froze ${body.series_type_id} ${body.period}. Reason: ${body.reason}`
      : `Froze ${body.series_type_id} ${body.period}. No reason given.`,
  });

  return ok({ frozen: true, series_type_id: body.series_type_id, period: body.period });
}

// DELETE /api/admin/freeze — unfreeze by id
export async function DELETE(req: NextRequest) {
  const claims = await requireAdmin(req);
  if (!claims) return err("admin required", 403);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return err("id required", 400);

  // Read it first: after the delete there is nothing left to name in the log,
  // and "someone unfroze row 14" is not an audit trail.
  const { data: row } = await db()
    .from("frozen_periods")
    .select("series_type_id, period, frozen_by, reason")
    .eq("id", Number(id))
    .maybeSingle();

  const { error } = await db().from("frozen_periods").delete().eq("id", Number(id));
  if (error) return err(error.message, 500);

  await logAudit({
    action: "unfreeze",
    performed_by: String(claims.username ?? claims.sub ?? "unknown"),
    series_type_id: row?.series_type_id ? String(row.series_type_id) : undefined,
    period: row?.period ? String(row.period) : undefined,
    notes: row
      ? `Unfroze ${row.series_type_id} ${row.period}, which was frozen by ${row.frozen_by ?? "unknown"}${row.reason ? ` for: ${row.reason}` : ""}. The period is now open to revision again.`
      : `Unfroze frozen_periods row ${id}, which could not be read back before deletion.`,
  });

  return ok({ unfrozen: Number(id) });
}
