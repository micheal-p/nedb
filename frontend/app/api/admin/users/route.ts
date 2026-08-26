import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/supabase-server";
import { requireAdmin, ok, err } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

const VALID_ROLES = new Set(["viewer", "editor", "admin", "superadmin"]);
// Legacy name for editor
const normalizeRole = (r: string) => (r === "staff" ? "editor" : r);

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return err("admin access required", 403);
  const { data } = await db()
    .from("staff_users")
    .select("id, username, full_name, email, role, agency, is_active, dashboard_profile, created_by, created_at, last_login")
    .order("created_at", { ascending: false });
  return ok(data ?? []);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return err("admin access required", 403);

  const body = await req.json().catch(() => null);
  const { username, full_name, email, role, agency, password, dashboard_profile } = body ?? {};
  if (!username || !full_name || !email || !password) return err("username, full_name, email, password required", 400);
  if (password.length < 8) return err("password must be at least 8 characters", 400);

  const newRole = normalizeRole(role ?? "editor");
  if (!VALID_ROLES.has(newRole)) return err("invalid role", 400);

  // An administrator may create viewers and editors. Creating another account
  // at admin level or above is granting power, which is a superadmin act — the
  // same rule the edit route applies, so an admin cannot sidestep it by
  // creating a new account instead of promoting an existing one.
  if ((newRole === "admin" || newRole === "superadmin") && admin.role !== "superadmin") {
    return err(
      "Creating an account at administrator level or above requires a super administrator.",
      403
    );
  }

  const hash = await bcrypt.hash(password, 12);

  const { data, error } = await db().from("staff_users").insert({
    username, full_name, email,
    role: newRole,
    agency: agency ?? null,
    password_hash: hash,
    created_by: admin.full_name,
    is_active: true,
    dashboard_profile: dashboard_profile ?? "executive",
  }).select("id, username, full_name, role").single();

  if (error) {
    if (error.code === "23505") return err("username or email already exists", 409);
    return err(error.message, 500);
  }
  await logAudit({
    action: "USER_CREATE",
    performed_by: String(admin.username ?? admin.sub ?? "unknown"),
    notes: `Created account ${username} (${newRole})`,
  });
  return ok(data, 201);
}
