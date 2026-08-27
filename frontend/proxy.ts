import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// ── Server-side route guard ─────────────────────────────────────────────────
// Next.js only runs middleware from a root middleware.ts. Until this file
// existed the app had page guards in client components only, reading the role
// out of localStorage — which the visitor controls, so setting
// localStorage.nedb_role = "admin" rendered the whole admin console. The API
// layer was the only real boundary. This restores a server-side boundary in
// front of the pages themselves.
//
// Roles: viewer < editor (legacy name "staff") < admin < superadmin.

const RANK: Record<string, number> = { viewer: 0, staff: 1, editor: 1, admin: 2, superadmin: 3 };

/** Minimum role required to load a page path. */
const GUARDS: { prefix: string; min: number }[] = [
  { prefix: "/admin",               min: RANK.admin },
  { prefix: "/upload",              min: RANK.editor },
  { prefix: "/terminal",            min: RANK.editor },
  { prefix: "/data-point/dashboard",min: RANK.viewer },
  { prefix: "/data-point/scenario", min: RANK.viewer },
  { prefix: "/data-point/pena",     min: RANK.viewer },
];

async function getClaims(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
    const { payload } = await jwtVerify(token, secret);
    return payload as { sub?: string; role?: string };
  } catch {
    return null;
  }
}

function toLogin(request: NextRequest, pathname: string) {
  const url = new URL("/data-point/login", request.url);
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const guard = GUARDS.find((g) => pathname.startsWith(g.prefix));
  if (!guard) return NextResponse.next();

  const token = request.cookies.get("nedb_token")?.value;
  if (!token) return toLogin(request, pathname);

  const claims = await getClaims(token);
  if (!claims) return toLogin(request, pathname);

  const rank = RANK[claims.role ?? ""] ?? -1;
  if (rank < guard.min) {
    // Authenticated but under-privileged: send them to the dashboard they can
    // see rather than bouncing them to a login form they already satisfied.
    return NextResponse.redirect(new URL("/data-point/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/upload/:path*", "/terminal/:path*", "/data-point/dashboard/:path*", "/data-point/scenario/:path*", "/data-point/pena/:path*"],
};
