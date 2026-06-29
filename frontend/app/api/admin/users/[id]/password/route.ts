import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase-server";
import { requireAdmin, ok, err } from "@/lib/api-helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin(req)) return err("admin access required", 403);
  const { id } = await params;

  const body = await req.json().catch(() => null);
  if (!body?.password || body.password.length < 8) return err("password must be at least 8 characters", 400);

  const hash = await bcrypt.hash(body.password, 12);
  const { error } = await db().from("staff_users").update({ password_hash: hash }).eq("id", id);
  if (error) return err(error.message, 500);

  return ok({ reset: true });
}
