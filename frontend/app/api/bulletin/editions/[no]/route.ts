import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireRole } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

// GET /api/bulletin/editions/[no] — a published edition is public; a draft is
// visible to editors and above only.
export async function GET(req: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const { data, error } = await db()
    .from("bulletin_editions")
    .select("*")
    .eq("edition_no", Number(no))
    .single();
  if (error || !data) return err("edition not found", 404);

  if (data.status !== "published") {
    const staff = await requireRole(req, "editor");
    if (!staff) return err("edition not found", 404);
  }
  return ok(data);
}

// PUT /api/bulletin/editions/[no] — maker checker:
//   { commentary: {...} }   editor+ updates commentary on a draft
//   { action: "publish" }   admin+ freezes and publishes (audited)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ no: string }> }) {
  const { no } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return err("Bad request");

  const { data: edition } = await db()
    .from("bulletin_editions")
    .select("id, edition_no, period_label, status")
    .eq("edition_no", Number(no))
    .single();
  if (!edition) return err("edition not found", 404);

  if (body.action === "publish") {
    const admin = await requireRole(req, "admin");
    if (!admin) return err("admin access required to publish", 403);
    if (edition.status === "published") return err("edition already published", 409);

    const { error } = await db()
      .from("bulletin_editions")
      .update({ status: "published", published_by: String(admin.username ?? admin.sub ?? "unknown"), published_at: new Date().toISOString() })
      .eq("id", edition.id);
    if (error) return err(error.message, 500);

    await logAudit({
      action: "BULLETIN_PUBLISH",
      performed_by: String(admin.username ?? admin.sub ?? "unknown"),
      notes: `Published bulletin No. ${edition.edition_no} (${edition.period_label})`,
    });
    return ok({ published: true });
  }

  if (body.commentary !== undefined) {
    const editor = await requireRole(req, "editor");
    if (!editor) return err("editor access required", 403);
    if (edition.status === "published") return err("published editions are frozen — issue a new edition instead", 409);
    if (typeof body.commentary !== "object" || body.commentary === null) return err("commentary must be an object of sector → text");

    const { error } = await db()
      .from("bulletin_editions")
      .update({ commentary: body.commentary })
      .eq("id", edition.id);
    if (error) return err(error.message, 500);
    return ok({ updated: true });
  }

  return err("nothing to do — send { commentary } or { action: \"publish\" }");
}
