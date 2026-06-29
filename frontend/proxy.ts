import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED = ["/upload", "/data-point/dashboard", "/data-point/admin"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get("nedb_token")?.value;
  if (!token) {
    const loginUrl = new URL("/data-point/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/upload/:path*", "/data-point/dashboard/:path*", "/data-point/admin/:path*"],
};
