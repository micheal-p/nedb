import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/api-helpers";

async function writeAudit(
  action: "UPDATE" | "DELETE",
  record: { id: number; series_type_id: string; period: string; region: string; value: number | null },
  newValue: number | null,
  performedBy: string,
  notes?: string
) {
  try {
    await db().from("audit_log").insert({
      action,
      record_id:     record.id,
      series_type_id: record.series_type_id,
      period:        record.period,
      region:        record.region,
      old_value:     record.value,
      new_value:     newValue,
      performed_by:  performedBy,
      notes,
    });
  } catch { /* audit failures must not block the main operation */ }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const claims = await requireAdmin(req);
  if (!claims) return NextResponse.json({ error: "admin required" }, { status: 403 });

  const { id } = await params;
  if (!id || isNaN(Number(id))) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body required" }, { status: 400 });

  const client = db();

  // Fetch current record for audit trail + freeze check
  const { data: before } = await client
    .from("energy_records")
    .select("id, series_type_id, period, region, value")
    .eq("id", Number(id))
    .single();

  if (before) {
    const { data: freeze } = await client
      .from("frozen_periods")
      .select("id")
      .eq("series_type_id", before.series_type_id)
      .or(`period.eq.${before.period},period.eq.*`)
      .limit(1);
    if (freeze && freeze.length > 0) {
      return NextResponse.json({ error: `Period ${before.period} is frozen and cannot be edited. Unfreeze it in the admin panel first.` }, { status: 423 });
    }
  }

  const allowed = ["period", "period_date", "value", "unit", "region", "source", "notes"];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: "No valid fields" }, { status: 400 });

  const { data, error } = await client.from("energy_records").update(patch).eq("id", Number(id)).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (before) {
    await writeAudit("UPDATE", before, "value" in patch ? Number(patch.value) : before.value, claims.username);
  }

  return NextResponse.json({ record: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const claims = await requireAdmin(req);
  if (!claims) return NextResponse.json({ error: "admin required" }, { status: 403 });

  const { id } = await params;
  if (!id || isNaN(Number(id))) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const client = db();

  // Fetch record before deletion for audit trail + freeze check
  const { data: before } = await client
    .from("energy_records")
    .select("id, series_type_id, period, region, value")
    .eq("id", Number(id))
    .single();

  if (before) {
    const { data: freeze } = await client
      .from("frozen_periods")
      .select("id")
      .eq("series_type_id", before.series_type_id)
      .or(`period.eq.${before.period},period.eq.*`)
      .limit(1);
    if (freeze && freeze.length > 0) {
      return NextResponse.json({ error: `Period ${before.period} is frozen and cannot be deleted.` }, { status: 423 });
    }
  }

  const { error } = await client.from("energy_records").delete().eq("id", Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (before) {
    await writeAudit("DELETE", before, null, claims.username, "record deleted by admin");
  }

  return NextResponse.json({ deleted: Number(id) });
}
