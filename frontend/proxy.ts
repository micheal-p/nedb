import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

async function getClaims(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
    const { payload } = await jwtVerify(token, secret);
    return payload as { sub?: string; role?: string };
  } catch { return null; }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get("nedb_token")?.value;
  if (!token) {
    const loginUrl = new URL("/data-point/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const claims = await getClaims(token);
  if (!claims) {
    const loginUrl = new URL("/data-point/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = claims.role ?? "";

  // /upload — staff and admin only
  if (pathname.startsWith("/upload") && role !== "staff" && role !== "admin") {
    return NextResponse.redirect(new URL("/data-point/login", request.url));
  }

  // /data-point/admin — admin only
  if (pathname.startsWith("/data-point/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/data-point/dashboard", request.url));
  }

  // /data-point/dashboard — viewer and admin only (staff goes to upload)
  if (pathname.startsWith("/data-point/dashboard") && role === "staff") {
    return NextResponse.redirect(new URL("/upload", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/upload/:path*", "/data-point/dashboard/:path*", "/data-point/admin/:path*"],
};
