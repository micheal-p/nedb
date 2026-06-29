import { NextRequest } from "next/server";
import { verifyRefresh, signTokenPair } from "@/lib/jwt-server";
import { ok, err } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.refresh_token) return err("refresh_token required", 400);
  try {
    const claims = await verifyRefresh(body.refresh_token);
    const pair = await signTokenPair(claims.username, claims.full_name, claims.role);
    return ok(pair);
  } catch {
    return err("invalid or expired refresh token", 401);
  }
}
