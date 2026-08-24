import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireRole } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

async function load(id: string) {
  const { data } = await db().from("bulletin_stories").select("*").eq("id", Number(id)).single();
  return data;
}

// GET — a published story is public; a draft needs editor access.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const story = await load(id);
  if (!story) return err("story not found", 404);
  if (story.status !== "published" && !(await requireRole(req, "editor"))) return err("story not found", 404);
  return ok(story);
}

// PUT — editors edit drafts; admins publish or withdraw.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return err("Bad request");

  const story = await load(id);
  if (!story) return err("story not found", 404);

  // ── Publish / withdraw: checker only ────────────────────────────────────
  if (body.action === "publish" || body.action === "withdraw") {
    const admin = await requireRole(req, "admin");
    if (!admin) return err("admin access required to publish or withdraw a story", 403);

    const publishing = body.action === "publish";
    if (publishing && !String(story.body ?? "").trim()) {
      return err("A story cannot be published with an empty body.");
    }

    const { error } = await db()
      .from("bulletin_stories")
      .update({
        status: publishing ? "published" : "draft",
        published_by: publishing ? String(admin.username ?? admin.sub ?? "unknown") : null,
        published_at: publishing ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", story.id);
    if (error) return err(error.message, 500);

    await logAudit({
      action: publishing ? "STORY_PUBLISH" : "STORY_WITHDRAW",
      performed_by: String(admin.username ?? admin.sub ?? "unknown"),
      notes: `${publishing ? "Published" : "Withdrew"} story "${story.title}"`,
    });
    return ok({ status: publishing ? "published" : "draft" });
  }

  // ── Edit: maker ─────────────────────────────────────────────────────────
  const editor = await requireRole(req, "editor");
  if (!editor) return err("editor access required", 403);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const f of ["title", "standfirst", "body", "sector", "author"] as const) {
    if (body[f] !== undefined) patch[f] = typeof body[f] === "string" ? body[f].trim() || null : body[f];
  }
  if (body.edition_no !== undefined) patch.edition_no = body.edition_no || null;
  if (Object.keys(patch).length === 1) return err("nothing to update");

  // A published story is the citable record. Editing it in place would rewrite
  // history under readers who already have the link.
  if (story.status === "published") {
    return err("This story is published. Withdraw it to a draft before editing.", 409);
  }

  const { error } = await db().from("bulletin_stories").update(patch).eq("id", story.id);
  if (error) return err(error.message, 500);
  return ok({ updated: true });
}

// DELETE — admin only, drafts only.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireRole(req, "admin");
  if (!admin) return err("admin access required", 403);
  const { id } = await params;
  const story = await load(id);
  if (!story) return err("story not found", 404);
  if (story.status === "published") return err("Withdraw the story before deleting it.", 409);

  const { error } = await db().from("bulletin_stories").delete().eq("id", story.id);
  if (error) return err(error.message, 500);
  await logAudit({
    action: "STORY_DELETE",
    performed_by: String(admin.username ?? admin.sub ?? "unknown"),
    notes: `Deleted draft story "${story.title}"`,
  });
  return ok({ deleted: true });
}
