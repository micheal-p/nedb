import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

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

// PATCH — quote a request (price + note), or move its status.
// The flow the columns enforce: pending → quoted → paid → fulfilled, declined
// anywhere. Fulfilment of a priced request demands the payment actually
// happened — an admin cannot hand over paid work that was never paid for,
// except by first waiving the fee with a quote of zero, which is a recorded
// decision rather than a quiet skip.
export async function PATCH(req: NextRequest) {
  const claims = await requireAdmin(req);
  if (!claims) return NextResponse.json({ error: "admin required" }, { status: 403 });
  const who = String(claims.username ?? claims.sub ?? "unknown");

  const body = await req.json().catch(() => null);
  const { id, status, admin_notes, price_ngn, quote_note } = body ?? {};
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: row } = await db().from("data_requests").select("id, status, price_ngn, created_at").eq("id", id).single();
  if (!row) return NextResponse.json({ error: "request not found" }, { status: 404 });
  const reference = `NEDB/DR/${new Date(row.created_at as string).getFullYear()}/${String(row.id).padStart(5, "0")}`;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (admin_notes !== undefined) patch.admin_notes = admin_notes ?? null;

  // Quoting
  if (price_ngn !== undefined) {
    const price = Number(price_ngn);
    if (!isFinite(price) || price < 0) return NextResponse.json({ error: "price_ngn must be a non-negative number" }, { status: 400 });
    if (row.status === "paid" || row.status === "fulfilled")
      return NextResponse.json({ error: "This request is already paid — the quote can no longer change." }, { status: 400 });
    patch.price_ngn = price;
    patch.quote_note = quote_note?.trim() || null;
    patch.priced_by = who;
    patch.priced_at = new Date().toISOString();
    patch.status = "quoted";
    await logAudit({
      action: price === 0 ? "DATA_REQUEST_FEE_WAIVED" : "DATA_REQUEST_QUOTED",
      performed_by: who,
      notes: `${price === 0 ? "Waived the fee on" : `Quoted ₦${price.toLocaleString()} for`} ${reference}`,
    });
  }

  if (status !== undefined && status !== null && price_ngn === undefined) {
    if (!["pending", "quoted", "fulfilled", "declined"].includes(status))
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    if (status === "fulfilled") {
      const price = row.price_ngn == null ? null : Number(row.price_ngn);
      const payable = price != null && price > 0;
      if (payable && row.status !== "paid")
        return NextResponse.json({ error: "This request carries a fee that has not been paid. Wait for payment, or waive the fee with a quote of ₦0 first." }, { status: 400 });
    }
    patch.status = status;
  }

  const { error } = await db().from("data_requests").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
