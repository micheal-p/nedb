import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth, requireAdmin } from "@/lib/api-helpers";
import { penaSlugify } from "@/lib/pena";

// GET /api/pena/forms/:id — form detail + questions + response count (staff)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const { id } = await params;

  const { data: form, error: fe } = await db().from("pena_forms").select("*").eq("id", id).single();
  if (fe || !form) return err("Assessment not found", 404);

  const [{ data: questions }, { count }] = await Promise.all([
    db().from("pena_questions").select("*").eq("form_id", form.id).order("display_order"),
    db().from("pena_responses").select("id", { count: "exact", head: true }).eq("form_id", form.id),
  ]);

  return ok({ ...form, questions: questions ?? [], response_count: count ?? 0 });
}

// PATCH /api/pena/forms/:id — update meta / status / questions (admin only).
// When body.questions is present the question set is replaced wholesale —
// responses key answers by slug, so historical answers survive label edits.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Forbidden", 403);
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body) return err("Bad request");

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title?.trim())               patch.title = body.title.trim();
  if (body.description !== undefined)   patch.description = body.description?.trim() || null;
  if (body.consent_text?.trim())        patch.consent_text = body.consent_text.trim();
  if (body.is_public_stats !== undefined) patch.is_public_stats = !!body.is_public_stats;
  if (body.status) {
    if (!["draft", "open", "closed"].includes(body.status)) return err("Invalid status");
    patch.status = body.status;
  }

  const { data: form, error: fe } = await db().from("pena_forms").update(patch).eq("id", id).select("*").single();
  if (fe || !form) return err("Assessment not found", 404);

  if (Array.isArray(body.questions)) {
    const rows = body.questions.map((q: Record<string, unknown>, i: number) => ({
      form_id: form.id,
      label: String(q.label ?? "").trim(),
      slug: penaSlugify(String(q.slug || q.label || `q_${i + 1}`)),
      qtype: q.qtype || "text",
      unit: (q.unit as string)?.trim() || null,
      is_required: q.is_required !== false,
      is_pii: !!q.is_pii,
      analytics_key: (q.analytics_key as string) || null,
      config: q.config ?? null,
      display_order: i + 1,
    }));
    if (rows.some((r: { label: string }) => !r.label)) return err("Every question needs a label");

    const del = await db().from("pena_questions").delete().eq("form_id", form.id);
    if (del.error) return err(del.error.message, 500);
    const ins = await db().from("pena_questions").insert(rows);
    if (ins.error) return err(ins.error.message, 500);
  }

  return ok(form);
}

// DELETE /api/pena/forms/:id — remove the assessment and all responses (admin)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Forbidden", 403);
  const { id } = await params;

  const { error } = await db().from("pena_forms").delete().eq("id", id);
  if (error) return err(error.message, 500);
  return ok({ success: true });
}
