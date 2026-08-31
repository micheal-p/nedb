import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAuth, requireAdmin, roleRank } from "@/lib/api-helpers";
import { DEFAULT_QUESTIONS, DEFAULT_CONSENT, penaSlugify } from "@/lib/pena";

// GET /api/pena/forms — list the PENA assessments this caller may open.
// A restricted assessment is hidden from staff who hold no grant on it: the
// access panel promises that only administrators and granted users can open a
// restricted assessment, and a listing that names it, and hands over its live
// fill link, does not keep that promise.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return err("Unauthorized", 401);
  const username = String(auth.username ?? auth.sub ?? "");
  const isAdmin = roleRank((auth as { role?: string }).role) >= 2;

  const { data, error } = await db()
    .from("pena_forms")
    .select("id, slug, share_token, title, description, status, is_public_stats, is_restricted, owner_agency, created_by, created_at, pena_questions(count), pena_responses(count)")
    .eq("pena_responses.verify_status", "verified")   // counts agree with insights
    .order("created_at", { ascending: false });

  if (error) return err(error.message, 500);

  let visible = data ?? [];
  if (!isAdmin) {
    const { data: grants, error: ge } = await db()
      .from("pena_form_access").select("form_id").eq("username", username);
    // Fail closed: without the grant list we cannot tell which restricted
    // assessments this person may see, so show none of them.
    const granted = new Set((ge ? [] : grants ?? []).map((g) => g.form_id as number));
    visible = visible.filter((f) => !f.is_restricted || granted.has(f.id));
  }

  const rows = visible.map((f) => ({
    ...f,
    // The share token IS the live fill link. Admins need it to share and
    // preview any assessment; everyone else gets it only while the assessment
    // is actually open, the same rule the public listing already applies.
    share_token: isAdmin || f.status === "open" ? f.share_token : null,
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
      require_verification: !!body.require_verification,  // direct by default — responses count immediately
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
