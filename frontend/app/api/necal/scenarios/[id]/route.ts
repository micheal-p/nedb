import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { requireNecal } from "@/lib/necal-access";
import { logAudit } from "@/lib/audit";

// PATCH  — rename, or publish/unpublish to the public explorer. Publishing
//          freezes the anchor base with the pathway, so the public copy stays
//          checkable even as the live records move.
// DELETE — remove one of your own scenarios.

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireNecal(req);
  if (!access.ok) return err(access.error, access.status);
  const { id } = await params;

  const { data: row } = await db()
    .from("necal_scenarios").select("id, owner_username, name, is_published").eq("id", id).single();
  if (!row || row.owner_username !== access.username) return err("Scenario not found", 404);

  const body = await req.json().catch(() => null);
  if (!body) return err("Bad request");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name?.trim()) patch.name = String(body.name).trim().slice(0, 120);
  if (body.scenario?.v === 1) patch.scenario = body.scenario;
  if (body.is_published === true) {
    if (!body.base || typeof body.base.generationGwh !== "number")
      return err("Publishing needs the anchor base the plan was computed against.");
    patch.is_published = true;
    patch.published_base = body.base;
    patch.published_at = new Date().toISOString();
  }
  if (body.is_published === false) { patch.is_published = false; }

  const { data, error } = await db()
    .from("necal_scenarios").update(patch).eq("id", id)
    .select("id, name, is_published").single();
  if (error) return err(error.message, 500);

  if (body.is_published !== undefined) {
    await logAudit({
      action: body.is_published ? "NECAL_SCENARIO_PUBLISHED" : "NECAL_SCENARIO_WITHDRAWN",
      performed_by: access.username,
      notes: `${body.is_published ? "Published" : "Withdrew"} pathway "${row.name}" ${body.is_published ? "to" : "from"} the public explorer`,
    });
  }
  return ok(data);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireNecal(req);
  if (!access.ok) return err(access.error, access.status);
  const { id } = await params;
  const { data: gone, error } = await db()
    .from("necal_scenarios").delete().eq("id", id).eq("owner_username", access.username)
    .select("id").maybeSingle();
  if (error || !gone) return err("Scenario not found", 404);
  return ok({ success: true });
}
