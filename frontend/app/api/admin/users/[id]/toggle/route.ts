import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { requireAdmin, ok, err } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth) return err("admin access required", 403);
  const { id } = await params;

  const { data: user } = await db().from("staff_users").select("username, role, is_active").eq("id", id).single();
  if (!user) return err("user not found", 404);
  // Only a superadmin may deactivate a superadmin account
  if (user.role === "superadmin" && auth.role !== "superadmin") {
    return err("only a super administrator can change superadmin accounts", 403);
  }

  const { data } = await db()
    .from("staff_users")
    .update({ is_active: !user.is_active })
    .eq("id", id)
    .select("id, is_active")
    .single();

  await logAudit({
    action: "USER_TOGGLE",
    performed_by: String(auth.username ?? auth.sub ?? "unknown"),
    notes: `${user.is_active ? "Deactivated" : "Reactivated"} account ${user.username}`,
  });
  return ok(data);
}
