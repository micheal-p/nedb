import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req);
  if (!claims) return NextResponse.json({ error: "admin required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const series   = searchParams.get("series") ?? "";
  const reviewed = searchParams.get("reviewed");
  const limit    = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

  let q = db().from("anomaly_flags").select("*").order("flagged_at", { ascending: false }).limit(limit);
  if (series)           q = q.eq("series_type_id", series);
  if (reviewed === "0") q = q.eq("reviewed", false);
  if (reviewed === "1") q = q.eq("reviewed", true);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// PATCH /api/admin/anomalies — mark reviewed
export async function PATCH(req: NextRequest) {
  const claims = await requireAdmin(req);
  if (!claims) return NextResponse.json({ error: "admin required" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const id   = body?.id as number | undefined;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await db().from("anomaly_flags").update({
    reviewed: true, reviewed_by: claims.username, reviewed_at: new Date().toISOString(),
  }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
