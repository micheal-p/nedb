import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAdmin, ok, err } from "@/lib/api-helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin(req)) return err("admin access required", 403);
  const { id } = await params;

  const { data: user } = await db().from("staff_users").select("is_active").eq("id", id).single();
  if (!user) return err("user not found", 404);

  const { data } = await db()
    .from("staff_users")
    .update({ is_active: !user.is_active })
    .eq("id", id)
    .select("id, is_active")
    .single();

  return ok(data);
}
