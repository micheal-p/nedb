import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { publicStatus } from "@/lib/access-pipeline";

function ok(data: unknown)         { return NextResponse.json(data); }
function err(msg: string, s = 400) { return NextResponse.json({ error: msg }, { status: s }); }

// Public GET — an applicant checks the status of their own access request by
// quoting the reference AND the email it was filed under. Requiring both
// prevents enumeration of other people's requests.
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl = checkRateLimit(`access-status:${ip}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) return err("Too many checks. Try again later.", 429);

  const { searchParams } = new URL(req.url);
  const ref   = searchParams.get("ref")?.trim() ?? "";
  const email = searchParams.get("email")?.trim().toLowerCase() ?? "";
  const m = ref.match(/^NEDB\/AR\/\d{4}\/(\d{1,10})$/);
  if (!m || !email) return err("Provide your reference (NEDB/AR/…) and the email you applied with.");

  const { data } = await db()
    .from("access_requests")
    .select("id, email, status, stage, created_at, reviewed_at")
    .eq("id", Number(m[1]))
    .single();

  if (!data || data.email !== email) return err("No request found for that reference and email.", 404);

  const pub = publicStatus(String(data.stage ?? data.status ?? "submitted"));
  return ok({
    reference: ref,
    status: data.status,
    stage: data.stage ?? null,
    stage_label: pub.label,
    stage_note: pub.note,
    submitted_at: data.created_at,
    reviewed_at: data.reviewed_at ?? null,
  });
}
