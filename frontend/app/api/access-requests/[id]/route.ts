import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/api-helpers";
import bcrypt from "bcryptjs";

function ok(data: unknown)         { return NextResponse.json(data); }
function err(msg: string, s = 400) { return NextResponse.json({ error: msg }, { status: s }); }

// Admin-only PUT — approve or reject a request
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Forbidden", 403);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return err("Bad request");
  const { action, password } = body; // action: "approve" | "reject"

  if (action === "reject") {
    const { error } = await db()
      .from("access_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: auth.username })
      .eq("id", id);
    if (error) return err("Failed to update request");
    return ok({ success: true });
  }

  if (action === "approve") {
    if (!password || password.length < 6) return err("Password must be at least 6 characters");

    // Fetch the request
    const { data: request, error: fetchErr } = await db()
      .from("access_requests")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !request) return err("Request not found");

    // Derive a username from email prefix
    const baseUsername = request.email.split("@")[0].replace(/[^a-z0-9_]/gi, "").toLowerCase().slice(0, 20);
    const username = `${baseUsername}_${Math.floor(Math.random() * 900 + 100)}`;

    // Hash password
    const hash = await bcrypt.hash(password, 12);

    // Create staff account
    const { error: createErr } = await db()
      .from("staff_users")
      .insert({
        username,
        full_name:        request.full_name,
        email:            request.email,
        role:             "viewer",
        agency:           request.organisation,
        password_hash:    hash,
        dashboard_profile: request.profile_key,
        is_active:        true,
      });

    if (createErr) {
      if (createErr.code === "23505") return err("A user with this email or username already exists.");
      return err("Failed to create account");
    }

    // Mark request approved + store username
    await db()
      .from("access_requests")
      .update({ status: "approved", temp_username: username, reviewed_at: new Date().toISOString(), reviewed_by: auth.username })
      .eq("id", id);

    return ok({ success: true, username });
  }

  return err("Unknown action");
}
