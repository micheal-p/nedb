import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

// POST /api/pena/forms/:id/wave — start the next wave of an assessment.
// Same questions, same consent machinery, its own responses, its parent
// named. This is the machinery the re-contact permission was collected for:
// wave two of the same population is what turns a snapshot into a panel.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return err("Forbidden", 403);
  const { id } = await params;
  const who = String(admin.username ?? admin.sub ?? "unknown");

  const { data: parent } = await db().from("pena_forms").select("*").eq("id", id).single();
  if (!parent) return err("Assessment not found", 404);

  // Waves chain off the ORIGINAL: wave 2 of wave 1's form, wave 3 requested
  // from either, always increments the family's highest wave.
  const rootId = parent.parent_form_id ?? parent.id;
  const { data: family } = await db()
    .from("pena_forms").select("wave").or(`id.eq.${rootId},parent_form_id.eq.${rootId}`);
  const nextWave = Math.max(...(family ?? []).map((f) => f.wave ?? 1), 1) + 1;

  const { data: wave, error } = await db()
    .from("pena_forms")
    .insert({
      slug: `${parent.slug.replace(/_w\d+$/, "")}_w${nextWave}`,
      share_token: randomBytes(16).toString("hex"),
      title: `${parent.title.replace(/ — Wave \d+$/, "")} — Wave ${nextWave}`,
      description: parent.description,
      consent_text: parent.consent_text,
      status: "draft",
      is_public_stats: parent.is_public_stats,
      require_verification: parent.require_verification,
      tier_config: parent.tier_config,
      target_population: parent.target_population,
      setting: parent.setting,
      parent_form_id: rootId,
      wave: nextWave,
      target_responses: parent.target_responses,
      created_by: who,
    })
    .select("id, slug, title, wave")
    .single();
  if (error) return err(error.message.includes("unique") ? `Wave ${nextWave} already exists for this assessment.` : error.message, 500);

  const { data: questions } = await db().from("pena_questions").select("*").eq("form_id", rootId).order("display_order");
  if (questions?.length) {
    const rows = questions.map(({ id: _id, form_id: _fid, ...q }) => ({ ...q, form_id: wave.id }));
    const { error: qe } = await db().from("pena_questions").insert(rows);
    if (qe) return err(qe.message, 500);
  }

  await logAudit({ action: "PENA_WAVE_STARTED", performed_by: who, notes: `Started wave ${nextWave} of "${parent.title}" (form ${wave.id})` });
  return ok(wave, 201);
}
