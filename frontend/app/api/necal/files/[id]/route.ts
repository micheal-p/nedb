import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { requireNecal } from "@/lib/necal-access";

// GET    — open a file: the owner with their token, or anyone with the file's
//          share token (?share=…). A share link is read-only by construction —
//          this route has no write verbs for token holders.
// PATCH  — rename, share (mints the token), unshare (burns it). Owner only.
// DELETE — remove the file and free its bytes. Owner only.

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = new URL(req.url).searchParams.get("share");

  const { data: f } = await db()
    .from("necal_files")
    .select("id, owner_username, filename, scenario, base, briefing, share_token, created_at")
    .eq("id", id)
    .single();
  if (!f) return err("File not found", 404);

  if (share) {
    if (!f.share_token || share !== f.share_token) return err("This share link is not valid.", 403);
    return ok({ id: f.id, filename: f.filename, scenario: f.scenario, base: f.base, briefing: f.briefing, created_at: f.created_at, owner: f.owner_username, shared: true });
  }

  const access = await requireNecal(req);
  if (!access.ok) return err(access.error, access.status);
  if (f.owner_username !== access.username) return err("File not found", 404);
  return ok({ id: f.id, filename: f.filename, scenario: f.scenario, base: f.base, briefing: f.briefing, created_at: f.created_at, share_token: f.share_token });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireNecal(req);
  if (!access.ok) return err(access.error, access.status);
  const { id } = await params;

  const { data: f } = await db().from("necal_files").select("id, owner_username, share_token").eq("id", id).single();
  if (!f || f.owner_username !== access.username) return err("File not found", 404);

  const body = await req.json().catch(() => null);
  if (!body) return err("Bad request");

  const patch: Record<string, unknown> = {};
  if (body.filename?.trim()) patch.filename = String(body.filename).trim().slice(0, 160);
  if (body.share === true && !f.share_token) patch.share_token = randomBytes(18).toString("hex");
  if (body.share === false) patch.share_token = null;
  if (!Object.keys(patch).length) return err("nothing to do");

  const { data, error } = await db()
    .from("necal_files").update(patch).eq("id", id)
    .select("id, filename, share_token").single();
  if (error) return err(error.message, 500);
  return ok(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireNecal(req);
  if (!access.ok) return err(access.error, access.status);
  const { id } = await params;
  const { data: gone, error } = await db()
    .from("necal_files").delete().eq("id", id).eq("owner_username", access.username)
    .select("id").maybeSingle();
  if (error || !gone) return err("File not found", 404);
  return ok({ success: true });
}
