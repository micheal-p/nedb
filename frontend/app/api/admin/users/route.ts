import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase-server";
import { requireAdmin, ok, err } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return err("admin access required", 403);
  const { data } = await db()
    .from("staff_users")
    .select("id, username, full_name, email, role, agency, is_active, created_by, created_at, last_login")
    .order("created_at", { ascending: false });
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return err("admin access required", 403);

  const body = await req.json().catch(() => null);
  const { username, full_name, email, role, agency, password } = body ?? {};
  if (!username || !full_name || !email || !password) return err("username, full_name, email, password required", 400);
  if (password.length < 8) return err("password must be at least 8 characters", 400);

  const hash = await bcrypt.hash(password, 12);

  const { data, error } = await db().from("staff_users").insert({
    username, full_name, email,
    role: role ?? "staff",
    agency: agency ?? null,
    password_hash: hash,
    created_by: admin.full_name,
    is_active: true,
  }).select("id, username, full_name, role").single();

  if (error) {
    if (error.code === "23505") return err("username or email already exists", 409);
    return err(error.message, 500);
  }
  return ok(data, 201);
}
