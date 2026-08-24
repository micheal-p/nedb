import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/api-helpers";
import { checkRateLimit } from "@/lib/rate-limit";

function ok(data: unknown)           { return NextResponse.json(data); }
function err(msg: string, s = 400)   { return NextResponse.json({ error: msg }, { status: s }); }

// Public POST — anyone can submit an access request
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl  = checkRateLimit(`access-req:${ip}`, 3, 60 * 60 * 1000);
  if (!rl.allowed) return err(`Too many submissions. Try again in ${Math.ceil(rl.resetIn / 60)} min.`, 429);

  const body = await req.json().catch(() => null);
  if (!body) return err("Bad request");
  const { full_name, email, organisation, position, profile_key, justification } = body;
  if (!full_name?.trim() || !email?.trim() || !organisation?.trim() || !profile_key?.trim())
    return err("full_name, email, organisation, profile_key are required");

  const { data: inserted, error } = await db()
    .from("access_requests")
    .insert({ full_name: full_name.trim(), email: email.trim().toLowerCase(), organisation: organisation.trim(), position: position?.trim() ?? null, profile_key, justification: justification?.trim() ?? null })
    .select("id, created_at")
    .single();

  if (error) {
    if (error.code === "23505") return err("An access request from this email address already exists.");
    return err("Failed to submit request. Please try again.");
  }

  // Reference number is derived from the row id — stable, sequential, no
  // schema change. Applicants quote it to check status.
  const year = new Date(inserted.created_at as string).getFullYear();
  const reference = `NEDB/AR/${year}/${String(inserted.id).padStart(5, "0")}`;
  return ok({
    success: true,
    reference,
    message: `Access request submitted. Your reference is ${reference}. Requests are reviewed within 5 working days.`,
  });
}

// Admin-only GET — list all requests
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Forbidden", 403);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";

  const query = db().from("access_requests").select("*").order("created_at", { ascending: false });
  if (status !== "all") query.eq("status", status);
  const { data, error } = await query;
  if (error) return err("Failed to fetch requests");
  return ok(data ?? []);
}
