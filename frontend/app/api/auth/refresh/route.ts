import { NextRequest } from "next/server";
import { verifyRefresh, signTokenPair } from "@/lib/jwt-server";
import { ok, err } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  // Accept refresh token from body (legacy) OR from httpOnly cookie (preferred)
  const body = await req.json().catch(() => ({}));
  const refreshToken = body?.refresh_token ?? req.cookies.get("nedb_rt")?.value;
  if (!refreshToken) return err("refresh_token required", 400);
  try {
    const claims = await verifyRefresh(refreshToken);
    const pair   = await signTokenPair(claims.username, claims.full_name, claims.role);
    return ok(pair);
  } catch {
    return err("invalid or expired refresh token", 401);
  }
}
