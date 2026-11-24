import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function parseJwtClaims(token: string): { [key: string]: any } | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = atob(base64);
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("__session")?.value;

  const isOwnerRoute = pathname.startsWith("/owner");
  const isTeacherRoute = pathname.startsWith("/teacher");
  const isLoginRoute = pathname === "/login";

  // Parse claims from the Firebase session cookie
  const claims = sessionCookie ? parseJwtClaims(sessionCookie) : null;
  const isExpired = claims?.exp ? Date.now() >= claims.exp * 1000 : true;
  const isAuthenticated = Boolean(claims && !isExpired);
  const role = claims?.role;

  // 1. If visiting protected route while logged out -> redirect to /login
  if ((isOwnerRoute || isTeacherRoute) && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Role isolation based strictly on Firebase custom claims:
  // Non-owner opening /owner is redirected to /teacher (or /login if role invalid)
  if (isOwnerRoute && role !== "owner") {
    return NextResponse.redirect(new URL(role === "teacher" ? "/teacher" : "/login", request.url));
  }

  // Non-teacher opening /teacher is redirected to /owner (or /login if role invalid)
  if (isTeacherRoute && role !== "teacher") {
    return NextResponse.redirect(new URL(role === "owner" ? "/owner" : "/login", request.url));
  }

  // 3. If authenticated user visits /login -> redirect to their designated portal
  if (isLoginRoute && isAuthenticated && role) {
    const target = role === "owner" ? "/owner" : "/teacher";
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/owner/:path*", "/teacher/:path*", "/login"],
};
