import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth, requireAdmin } from "@/lib/api-helpers";
import { DEFAULT_QUESTIONS, DEFAULT_CONSENT, penaSlugify } from "@/lib/pena";

// GET /api/pena/forms — list all PENA assessments (staff)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);

  const { data, error } = await db()
    .from("pena_forms")
    .select("id, slug, share_token, title, description, status, is_public_stats, created_by, created_at, pena_questions(count), pena_responses(count)")
    .order("created_at", { ascending: false });

  if (error) return err(error.message, 500);

  const rows = (data ?? []).map((f) => ({
    ...f,
    question_count: (f.pena_questions as { count: number }[])?.[0]?.count ?? 0,
    response_count: (f.pena_responses as { count: number }[])?.[0]?.count ?? 0,
    pena_questions: undefined,
    pena_responses: undefined,
  }));
  return ok(rows);
}

// POST /api/pena/forms — create an assessment (admin only), seeded with the
// default PENA question template. Body: { title, description?, consent_text? }
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Forbidden", 403);

  const body = await req.json().catch(() => null);
  if (!body?.title?.trim()) return err("title is required");

  const slug = penaSlugify(body.slug?.trim() || body.title);
  const share_token = randomBytes(16).toString("hex");

  const { data: form, error: fe } = await db()
    .from("pena_forms")
    .insert({
      slug,
      share_token,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      consent_text: body.consent_text?.trim() || DEFAULT_CONSENT,
      status: "draft",
      is_public_stats: body.is_public_stats !== false,
      created_by: auth.username,
    })
    .select("*")
    .single();

  if (fe) return err(fe.message.includes("unique") ? "An assessment with this slug already exists" : fe.message, fe.message.includes("unique") ? 409 : 500);

  const { error: qe } = await db()
    .from("pena_questions")
    .insert(DEFAULT_QUESTIONS.map((q) => ({ ...q, form_id: form!.id })));
  if (qe) return err(qe.message, 500);

  return ok(form, 201);
}
