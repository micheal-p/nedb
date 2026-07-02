import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req);
  if (!claims) return NextResponse.json({ error: "admin required" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "";
  const limit  = Math.min(Number(searchParams.get("limit") ?? "100"), 500);

  let q = db().from("data_requests").select("*").order("created_at", { ascending: false }).limit(limit);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const claims = await requireAdmin(req);
  if (!claims) return NextResponse.json({ error: "admin required" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { id, status, admin_notes } = body ?? {};
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });
  if (!["pending", "fulfilled", "declined"].includes(status)) return NextResponse.json({ error: "invalid status" }, { status: 400 });

  const { error } = await db().from("data_requests").update({
    status, admin_notes: admin_notes ?? null, updated_at: new Date().toISOString(),
  }).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
