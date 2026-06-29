import { NextRequest, NextResponse } from "next/server";
import { verifyAccess } from "./jwt-server";

export const ok  = <T>(data: T, status = 200) => NextResponse.json(data, { status });
export const err = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function requireAuth(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  try { return await verifyAccess(auth.slice(7)); }
  catch { return null; }
}

export async function requireAdmin(req: NextRequest) {
  const claims = await requireAuth(req);
  if (!claims || claims.role !== "admin") return null;
  return claims;
}
