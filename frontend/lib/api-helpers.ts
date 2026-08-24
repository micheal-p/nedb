import { NextRequest, NextResponse } from "next/server";
import { verifyAccess } from "./jwt-server";

export const ok  = <T>(data: T, status = 200) => NextResponse.json(data, { status });
export const err = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function requireAuth(req: NextRequest) {
  // 1. Authorization: Bearer header (used by all current client calls)
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    try { return await verifyAccess(auth.slice(7)); } catch { /* fall through */ }
  }
  // 2. Access token cookie (used when browser sends cookies automatically)
  const cookieToken = req.cookies.get("nedb_token")?.value;
  if (cookieToken) {
    try { return await verifyAccess(cookieToken); } catch { /* fall through */ }
  }
  return null;
}

// ── Role hierarchy (maker checker) ──────────────────────────────────────────
// viewer < editor (maker: uploads, drafts) < admin (checker: commits,
// approves, publishes) < superadmin (accounts, roles, deletions, settings).
// "staff" is the legacy name for editor and stays accepted so existing
// accounts and issued tokens keep working.
const ROLE_RANK: Record<string, number> = { viewer: 0, staff: 1, editor: 1, admin: 2, superadmin: 3 };

export function roleRank(role?: string | null): number {
  return ROLE_RANK[role ?? ""] ?? 0;
}

export async function requireRole(req: NextRequest, minRole: "editor" | "admin" | "superadmin") {
  const claims = await requireAuth(req);
  if (!claims || roleRank(claims.role as string) < ROLE_RANK[minRole]) return null;
  return claims;
}

export async function requireAdmin(req: NextRequest) {
  return requireRole(req, "admin");
}

export async function requireSuperadmin(req: NextRequest) {
  return requireRole(req, "superadmin");
}
