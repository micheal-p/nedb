import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase-server";
import { signTokenPair } from "@/lib/jwt-server";
import { ok, err } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.username || !body?.password) return err("username and password are required", 400);

  const { username, password } = body as { username: string; password: string };

  const { data: staff } = await db()
    .from("staff_users")
    .select("username, full_name, role, password_hash, is_active")
    .eq("username", username)
    .single();

  if (!staff) return err("invalid credentials", 401);
  if (!staff.is_active) return err("account is deactivated", 401);

  const valid = await bcrypt.compare(password, staff.password_hash);
  if (!valid) return err("invalid credentials", 401);

  await db()
    .from("staff_users")
    .update({ last_login: new Date().toISOString() })
    .eq("username", username);

  return ok(await signTokenPair(username, staff.full_name, staff.role));
}
