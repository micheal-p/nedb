import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";
import { buildVintage } from "@/lib/vintages";
import { logAudit } from "@/lib/audit";

// GET  /api/vintages — the public catalogue: published vintages, newest first.
//      Administrators (Bearer token) also see unpublished ones.
// POST /api/vintages — freeze a new vintage (admin). The snapshot is built,
//      checksummed and stored in one motion; from that point the database
//      itself refuses any change to its content (trigger, migration 059).

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  let q = db()
    .from("data_vintages")
    .select("id, label, title, notes, manifest, checksum, price_ngn, is_published, created_by, created_at")
    .order("created_at", { ascending: false });
  if (!admin) q = q.eq("is_published", true);
  const { data, error } = await q;
  if (error) return err(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return err("Forbidden", 403);

  const body = await req.json().catch(() => null);
  if (!body?.title?.trim()) return err("title is required");
  const price = body.price_ngn == null || body.price_ngn === "" ? null : Number(body.price_ngn);
  if (price != null && (!isFinite(price) || price < 0)) return err("price_ngn must be a non-negative number");

  // Default label = v<year>-<month>; a second freeze in the same month gets
  // the day appended so labels stay readable AND unique.
  const now = new Date();
  const ym = `v${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let label = String(body.label ?? "").trim() || ym;
  const { data: clash } = await db().from("data_vintages").select("id").eq("label", label).maybeSingle();
  if (clash) label = `${ym}-${String(now.getDate()).padStart(2, "0")}`;

  let build;
  try {
    build = await buildVintage(label);
  } catch (e) {
    return err(`Freezing failed: ${e instanceof Error ? e.message : "unknown error"}`, 500);
  }

  const { data: row, error } = await db()
    .from("data_vintages")
    .insert({
      label,
      title: body.title.trim(),
      notes: body.notes?.trim() || null,
      snapshot: build.snapshot,
      manifest: build.manifest,
      checksum: build.checksum,
      price_ngn: price,
      is_published: false,
      created_by: String(admin.username ?? admin.sub ?? "unknown"),
    })
    .select("id, label, title, checksum, manifest, created_at")
    .single();
  if (error) return err(error.message.includes("unique") ? `Vintage ${label} already exists.` : error.message, 500);

  await logAudit({
    action: "VINTAGE_FROZEN",
    performed_by: String(admin.username ?? admin.sub ?? "unknown"),
    notes: `Froze vintage ${label} ("${row.title}") — sha256:${build.checksum.slice(0, 16)}…`,
  });

  return ok(row, 201);
}
