import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";

// GET /api/vintages/orders — every order across vintages (admin only).
// Buyer emails are personal data; this stays behind the admin wall.

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return err("Forbidden", 403);

  const { data, error } = await db()
    .from("vintage_orders")
    .select("reference, email, buyer_name, organisation, amount_ngn, status, created_at, paid_at, data_vintages(label, title)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return err(error.message, 500);

  return ok((data ?? []).map((o) => ({
    ...o,
    vintage: (o.data_vintages as unknown as { label: string; title: string } | null) ?? null,
    data_vintages: undefined,
  })));
}
