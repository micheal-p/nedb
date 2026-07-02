import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAdmin, ok, err } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req);
  if (!claims) return err("admin required", 403);

  const { searchParams } = new URL(req.url);
  const series   = searchParams.get("series") ?? "";
  const action   = searchParams.get("action") ?? "";
  const recordId = searchParams.get("record") ?? "";
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "200"), 500);

  let query = db()
    .from("audit_log")
    .select("id, action, series_type_id, period, region, old_value, new_value, performed_by, performed_at, notes")
    .order("performed_at", { ascending: false })
    .limit(limit);

  if (series)   query = query.eq("series_type_id", series);
  if (action)   query = query.eq("action", action);
  if (recordId) query = query.eq("record_id", Number(recordId));

  const { data, error } = await query;
  if (error) return err(error.message, 500);
  return ok({ entries: data ?? [] });
}
