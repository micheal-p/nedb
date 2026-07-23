import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth, requireAdmin } from "@/lib/api-helpers";
import { penaSlugify, computeTier, DEFAULT_TIER_CONFIG, type TierConfig } from "@/lib/pena";

// GET /api/pena/forms/:id — form detail + questions + response count (staff)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const { id } = await params;

  const { data: form, error: fe } = await db().from("pena_forms").select("*").eq("id", id).single();
  if (fe || !form) return err("Assessment not found", 404);

  const [{ data: questions }, { count }] = await Promise.all([
    db().from("pena_questions").select("*").eq("form_id", form.id).order("display_order"),
    db().from("pena_responses").select("id", { count: "exact", head: true }).eq("form_id", form.id).eq("verify_status", "verified"),
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
  if (body.require_verification !== undefined) patch.require_verification = !!body.require_verification;
  if (body.status) {
    if (!["draft", "open", "closed"].includes(body.status)) return err("Invalid status");
    patch.status = body.status;
  }
  let retier = false;
  if (body.tier_config !== undefined) {
    if (body.tier_config !== null) {
      const tc = body.tier_config as Partial<TierConfig>;
      for (const k of ["A", "B", "C", "D"] as const) {
        const t = tc[k];
        if (!t || typeof t.light !== "number" || typeof t.burden !== "number" ||
            t.light < 0 || t.light > 24 || t.burden < 0 || t.burden > 1)
          return err(`Invalid tier config for tier ${k} — light 0–24, burden 0–1.`);
      }
    }
    patch.tier_config = body.tier_config;
    retier = true;
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

    // Reject duplicate slugs BEFORE touching the existing set — a failed
    // insert after the delete would leave the live form with zero questions.
    const seen = new Set<string>();
    for (const r of rows) {
      if (seen.has(r.slug))
        return err(`Two questions share the internal name "${r.slug}" — make their labels more distinct.`);
      seen.add(r.slug);
    }

    // Snapshot the current questions so a failed insert can be rolled back
    // (supabase-js has no transactions; restore is the safety net).
    const { data: snapshot } = await db().from("pena_questions").select("*").eq("form_id", form.id);

    const del = await db().from("pena_questions").delete().eq("form_id", form.id);
    if (del.error) return err(del.error.message, 500);
    const ins = await db().from("pena_questions").insert(rows);
    if (ins.error) {
      if (snapshot?.length) {
        const restore = await db().from("pena_questions")
          .insert(snapshot.map(({ id: _id, ...q }) => q));
        if (restore.error) return err(`Saving failed AND restoring the previous questions failed (${restore.error.message}) — the form has no questions; re-save immediately.`, 500);
      }
      return err(`Saving questions failed (${ins.error.message}) — the previous question set was restored.`, 500);
    }
  }

  // Threshold change → recompute every stored tier so old and new responses
  // are classified consistently. Batched: collect changed ids per new tier,
  // then at most 6 UPDATE ... IN (...) calls (chunked) instead of one
  // round-trip per row — a per-row loop times out the serverless function on
  // large forms and leaves tiers half old-config, half new-config.
  let retiered = 0;
  if (retier) {
    const cfg = (form.tier_config ?? DEFAULT_TIER_CONFIG) as Partial<TierConfig>;
    const byNewTier = new Map<string | null, number[]>();
    for (let from = 0; ; from += 1000) {
      const { data: rs, error: re } = await db()
        .from("pena_responses")
        .select("id, income, light_hours, energy_expense, tier")
        .eq("form_id", form.id)
        .order("id")
        .range(from, from + 999);
      if (re) return err(`Tier recompute failed while reading responses (${re.message}) — thresholds were saved; re-save them to finish the recompute.`, 500);
      for (const r of rs ?? []) {
        const t = computeTier(r.income, r.light_hours, r.energy_expense, cfg);
        if (t !== r.tier) {
          if (!byNewTier.has(t)) byNewTier.set(t, []);
          byNewTier.get(t)!.push(r.id);
        }
      }
      if (!rs || rs.length < 1000) break;
    }
    for (const [t, ids] of byNewTier) {
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const { error: ue } = await db().from("pena_responses").update({ tier: t }).in("id", chunk);
        if (ue) return err(`Tier recompute failed partway (${ue.message}) — re-save the thresholds to finish.`, 500);
        retiered += chunk.length;
      }
    }
  }

  return ok({ ...form, retiered });
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
