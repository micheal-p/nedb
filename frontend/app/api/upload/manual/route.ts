import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.series_type_id || !Array.isArray(body?.rows) || !body.rows.length)
    return err("series_type_id and rows[] are required", 400);

  const { data: series } = await db()
    .from("series_types")
    .select("id, unit_default")
    .eq("id", body.series_type_id)
    .single();

  if (!series) return err("series not found", 404);

  // Create an upload session for audit trail
  const { data: session, error: se } = await db()
    .from("upload_sessions")
    .insert({
      series_type_id: body.series_type_id,
      filename: "manual-entry",
      row_count: body.rows.length,
      error_count: 0,
      status: "committed",
      uploaded_by: auth.username,
    })
    .select("id")
    .single();

  if (se) return err(se.message, 500);

  const records = body.rows.map((r: Record<string, unknown>) => ({
    series_type_id: body.series_type_id,
    period: r.period as string,
    period_date: r.period_date as string,
    region: (r.region as string) || "NGA",
    value: Number(r.value),
    unit: (r.unit as string) || series.unit_default,
    source: (r.source as string) || null,
    notes: (r.notes as string) || null,
    methodology_version: "v1",
    upload_session_id: session!.id,
  }));

  const { error: ie } = await db().from("energy_records").insert(records);
  if (ie) return err(ie.message, 500);

  return ok({ committed_rows: records.length, session_id: session!.id }, 201);
}
