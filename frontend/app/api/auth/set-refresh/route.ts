import { NextRequest, NextResponse } from "next/server";

const RT_COOKIE = "nedb_rt";
const MAX_AGE   = 7 * 24 * 60 * 60; // 7 days in seconds

// POST — store refresh token in httpOnly cookie (called client-side after login)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.refresh_token) return NextResponse.json({ error: "refresh_token required" }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(RT_COOKIE, body.refresh_token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    path:     "/",
    maxAge:   MAX_AGE,
  });
  return res;
}

// DELETE — clear the httpOnly refresh cookie on logout
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(RT_COOKIE);
  return res;
}
