import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

// GET   /api/vintages/:label — one vintage's public metadata (no snapshot).
// PATCH /api/vintages/:label — admin: title, notes, price, publish state.
//       The content fields cannot change — the database trigger refuses.

export async function GET(req: NextRequest, { params }: { params: Promise<{ label: string }> }) {
  const { label } = await params;
  const admin = await requireAdmin(req);
  const { data: v } = await db()
    .from("data_vintages")
    .select("id, label, title, notes, manifest, checksum, price_ngn, is_published, created_at")
    .eq("label", label)
    .single();
  if (!v || (!v.is_published && !admin)) return err("Vintage not found", 404);
  return ok(v);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ label: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return err("Forbidden", 403);
  const { label } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return err("Bad request");

  const patch: Record<string, unknown> = {};
  if (body.title?.trim()) patch.title = body.title.trim();
  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;
  if (body.price_ngn !== undefined) {
    const price = body.price_ngn == null || body.price_ngn === "" ? null : Number(body.price_ngn);
    if (price != null && (!isFinite(price) || price < 0)) return err("price_ngn must be a non-negative number");
    patch.price_ngn = price;
  }
  if (body.is_published !== undefined) patch.is_published = !!body.is_published;
  if (!Object.keys(patch).length) return err("nothing to do");

  const { data: v, error } = await db()
    .from("data_vintages").update(patch).eq("label", label)
    .select("id, label, title, notes, price_ngn, is_published").single();
  if (error || !v) return err(error?.message ?? "Vintage not found", error ? 500 : 404);

  if (body.is_published !== undefined) {
    await logAudit({
      action: body.is_published ? "VINTAGE_PUBLISHED" : "VINTAGE_WITHDRAWN",
      performed_by: String(admin.username ?? admin.sub ?? "unknown"),
      notes: `${body.is_published ? "Published" : "Withdrew"} vintage ${label} ("${v.title}")`,
    });
  }
  return ok(v);
}
