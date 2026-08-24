import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { checkRateLimit } from "@/lib/rate-limit";

// POST — public, no auth
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  const rl  = checkRateLimit(`data-req:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: `Too many submissions. Try again in ${Math.ceil(rl.resetIn / 60)} min.` }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "body required" }, { status: 400 });

  const { full_name, organization, email, purpose, requested_series, date_range } = body;
  if (!full_name?.trim() || !email?.trim() || !purpose?.trim()) {
    return NextResponse.json({ error: "full_name, email and purpose are required" }, { status: 400 });
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) return NextResponse.json({ error: "invalid email" }, { status: 400 });

  const { data, error } = await db().from("data_requests").insert({
    full_name: full_name.trim(),
    organization: organization?.trim() ?? null,
    email: email.trim().toLowerCase(),
    purpose: purpose.trim(),
    requested_series: Array.isArray(requested_series) ? requested_series : [],
    date_range: date_range?.trim() ?? null,
  }).select("id, created_at").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reference derived from the row id, matching the access-request scheme, so
  // an applicant always has something to quote back at us.
  const year = new Date(data.created_at as string).getFullYear();
  const reference = `NEDB/DR/${year}/${String(data.id).padStart(5, "0")}`;
  return NextResponse.json({
    id: data.id,
    reference,
    message: `Request received. Your reference is ${reference}. The NEDB data management unit will respond within 3 working days.`,
  }, { status: 201 });
}
