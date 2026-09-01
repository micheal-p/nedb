import { NextRequest } from "next/server";
import { db } from "@/lib/supabase-server";
import { ok, err, requireAdmin } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

const VALID_ROLES = new Set(["viewer", "editor", "admin", "superadmin"]);

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth) return err("Forbidden", 403);

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return err("Bad request");

  const allowed = ["full_name", "email", "agency", "role", "dashboard_profile", "is_active", "admin_scope"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }
  if (!Object.keys(update).length) return err("No valid fields to update");

  const { data: target } = await db().from("staff_users").select("username, role").eq("id", id).single();
  if (!target) return err("user not found", 404);

  if (update.admin_scope !== undefined) {
    const scopeVal = update.admin_scope === "" || update.admin_scope === null ? null : String(update.admin_scope);
    const VALID_SCOPES = new Set(["software", "business", "technical", "research", "data_entry", "accounting", "audit"]);
    if (scopeVal !== null && !VALID_SCOPES.has(scopeVal)) return err("invalid admin scope", 400);
    update.admin_scope = scopeVal;
    // Deciding WHERE an administrator works is the same class of act as
    // deciding their role: a superadmin decision.
    if (auth.role !== "superadmin") {
      return err("Assigning an administration scope requires a super administrator.", 403);
    }
  }

  if (update.role !== undefined) {
    const newRole = update.role === "staff" ? "editor" : String(update.role);
    if (!VALID_ROLES.has(newRole)) return err("invalid role", 400);

    // ANY role change is a superadmin act, not just one touching a superadmin.
    // Previously an admin could promote an account to admin, which meant the
    // admin tier could expand itself and the superadmin tier drew a line only
    // around its own membership. Separation of duties needs the line drawn
    // around the power to grant power.
    if (newRole !== target.role && auth.role !== "superadmin") {
      return err(
        "Changing a role requires a super administrator. Administrators manage accounts; only a super administrator grants or withdraws access levels.",
        403
      );
    }
    update.role = newRole;
  }

  const { error } = await db().from("staff_users").update(update).eq("id", id);
  if (error) return err(error.message, 500);

  await logAudit({
    action: update.role !== undefined && update.role !== target.role ? "ROLE_CHANGE" : "USER_EDIT",
    performed_by: String(auth.username ?? auth.sub ?? "unknown"),
    notes: `Updated account ${target.username}: ${Object.keys(update).join(", ")}${update.role !== undefined && update.role !== target.role ? ` (role ${target.role} → ${update.role})` : ""}`,
  });
  return ok({ success: true });
}
