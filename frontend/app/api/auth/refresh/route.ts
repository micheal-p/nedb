import { NextRequest } from "next/server";
import { verifyRefresh, signTokenPair } from "@/lib/jwt-server";
import { db } from "@/lib/supabase-server";
import { ok, err } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  // Accept refresh token from body (legacy) OR from httpOnly cookie (preferred)
  const body = await req.json().catch(() => ({}));
  const refreshToken = body?.refresh_token ?? req.cookies.get("nedb_rt")?.value;
  if (!refreshToken) return err("refresh_token required", 400);
  try {
    const claims = await verifyRefresh(refreshToken);
    // Re-read the ACCOUNT, not the old token: a refresh used to copy stale
    // claims forward (losing the dashboard profile entirely) and kept
    // refreshing deactivated accounts for the token's whole seven days.
    // Fresh role, profile and scope come from the row; a deactivated or
    // deleted account stops here.
    const { data: staff } = await db()
      .from("staff_users")
      .select("username, full_name, role, dashboard_profile, admin_scope, is_active")
      .eq("username", claims.username)
      .single();
    if (!staff || !staff.is_active) return err("account is no longer active", 401);
    const profile = staff.dashboard_profile ?? "executive";
    const pair = await signTokenPair(staff.username, staff.full_name, staff.role, profile, staff.admin_scope ?? null);
    return ok({ ...pair, dashboard_profile: profile, admin_scope: staff.admin_scope ?? null });
  } catch {
    return err("invalid or expired refresh token", 401);
  }
}
