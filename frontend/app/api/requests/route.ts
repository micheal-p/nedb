import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";

// POST — public, no auth
export async function POST(req: NextRequest) {
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
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, message: "Request received. The NEDB team will contact you within 3 business days." }, { status: 201 });
}
