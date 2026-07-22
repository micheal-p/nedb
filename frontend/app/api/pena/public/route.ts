import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";

// GET /api/pena/public — open-data listing of published PENA assessments.
// Unauthenticated by design: only titles, slugs and response counts — no
// respondent data of any kind.
export async function GET() {
  const { data, error } = await db()
    .from("pena_forms")
    .select("slug, share_token, title, description, status, created_at, pena_responses(count)")
    .eq("is_public_stats", true)
    .neq("status", "draft")
    .eq("pena_responses.verify_status", "verified")   // count matches the detail page
    .order("created_at", { ascending: false });

  if (error) return err(error.message, 500);

  return ok((data ?? []).map((f) => ({
    slug: f.slug,
    title: f.title,
    description: f.description,
    status: f.status,
    created_at: f.created_at,
    response_count: (f.pena_responses as { count: number }[])?.[0]?.count ?? 0,
    // Open published surveys are fillable straight from the data bank
    share_token: f.status === "open" ? f.share_token : null,
  })));
}
