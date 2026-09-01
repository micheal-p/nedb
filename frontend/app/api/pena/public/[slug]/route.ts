import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { K_ANON_MIN } from "@/lib/pena";
import { buildPublicAggregates } from "@/lib/pena-public";
import { cacheGet, cacheSet } from "@/lib/redis";

// GET /api/pena/public/:slug — open-data aggregates for a published assessment.
// The NDPA 2023 safeguards (aggregates only, k-anonymity floor) are enforced
// in lib/pena-public.ts, which is shared with data vintages and working papers
// so the privacy rules exist exactly once.
// Cached 10 min; the staff-side insights route stays live and unredacted.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const cacheKey = `pena:pub:${slug}`;
  const cached = await cacheGet<object>(cacheKey);
  if (cached) return ok(cached);

  const { data: form } = await db()
    .from("pena_forms")
    .select("id, slug, share_token, title, description, status, is_public_stats, created_at")
    .eq("slug", slug)
    .single();
  if (!form || !form.is_public_stats || form.status === "draft") return err("Assessment not found", 404);
  const shareToken = form.status === "open" ? form.share_token : null;

  let agg;
  try {
    agg = await buildPublicAggregates(form.id);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Aggregation failed", 500);
  }

  const assessment = {
    slug: form.slug, title: form.title, description: form.description,
    status: form.status, created_at: form.created_at,
  };

  if (agg.collecting) {
    const collecting = {
      assessment,
      share_token: shareToken,
      license: "Open data — aggregates publish automatically once " + K_ANON_MIN + " verified responses are collected (NDPA 2023 privacy floor).",
      collecting: true,
      needed: K_ANON_MIN,
      total_responses: agg.total_responses,
    };
    await cacheSet(cacheKey, collecting, 300);
    return ok(collecting);
  }

  const payload = {
    assessment,
    share_token: shareToken,
    license: "Open data — k-anonymised aggregates (groups under " + K_ANON_MIN + " responses suppressed). Personal data withheld under NDPA 2023.",
    total_responses: agg.total_responses,
    stats: agg.stats,
    tier_distribution: agg.tier_distribution,
    by_state: agg.by_state,
    by_lga: agg.by_lga,
    lga_income_map: agg.lga_income_map,
  };

  await cacheSet(cacheKey, payload, 600);
  return ok(payload);
}
