import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Forbidden", 403);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return err("Bad request");

  const allowed = ["full_name", "email", "agency", "role", "dashboard_profile", "is_active"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  if (!Object.keys(update).length) return err("No valid fields to update");

  const { error } = await db().from("staff_users").update(update).eq("id", id);
  if (error) return err(error.message, 500);
  return ok({ success: true });
}
