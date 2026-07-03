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

export async function requireAdmin(req: NextRequest) {
  const claims = await requireAuth(req);
  if (!claims || claims.role !== "admin") return null;
  return claims;
}
