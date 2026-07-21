import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";
import { checkRateLimitDurable } from "@/lib/rate-limit";
import { cacheDel } from "@/lib/redis";
import { VERIFY_TTL_HOURS } from "@/lib/pena";

// POST /api/pena/verify/:vtoken — magic-link confirmation. One-shot: on
// success the token is burned so the link cannot be replayed. A pending
// response older than VERIFY_TTL_HOURS is expired and cannot be confirmed.

export async function POST(req: NextRequest, { params }: { params: Promise<{ vtoken: string }> }) {
  const { vtoken } = await params;
  if (!/^[a-f0-9]{48}$/.test(vtoken)) return err("Invalid link", 404);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = await checkRateLimitDurable(`pena-verify:${ip}`, 20, 3600);
  if (!rl.allowed) return err("Too many attempts — try again later.", 429);

  const { data: r } = await db()
    .from("pena_responses")
    .select("id, form_id, verify_status, created_at")
    .eq("verify_token", vtoken)
    .single();
  if (!r) return err("This confirmation link is invalid or has already been used.", 404);
  if (r.verify_status === "verified") return ok({ status: "already" });

  const ageHours = (Date.now() - new Date(r.created_at).getTime()) / 3_600_000;
  if (ageHours > VERIFY_TTL_HOURS)
    return ok({ status: "expired", ttl_hours: VERIFY_TTL_HOURS });

  const { error } = await db()
    .from("pena_responses")
    .update({ verify_status: "verified", verified_at: new Date().toISOString(), verify_token: null })
    .eq("id", r.id);
  if (error) return err("Verification failed — please try the link again.");

  // Freshly verified responses change the public aggregates
  const { data: form } = await db().from("pena_forms").select("slug, title").eq("id", r.form_id).single();
  if (form?.slug) await cacheDel(`pena:pub:${form.slug}`);

  return ok({ status: "verified", title: form?.title ?? null });
}
