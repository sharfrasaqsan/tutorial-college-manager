import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function decodeJwtPayload(token: string): { [key: string]: any } | null {
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

  // Decode JWT payload
  const payload = sessionCookie ? decodeJwtPayload(sessionCookie) : null;
  const isExpired = payload?.exp ? Date.now() >= payload.exp * 1000 : true;
  const isAuthenticated = Boolean(payload && !isExpired);
  const ownerEmail = (process.env.OWNER_EMAIL || "sharfrasaqsan@gmail.com").toLowerCase();
  const isOwnerUser = payload?.role === "owner" || (payload?.email && payload.email.toLowerCase() === ownerEmail);
  const role = isOwnerUser ? "owner" : (payload?.role || "teacher");

  // 1. If visiting protected route while logged out -> redirect to /login
  if ((isOwnerRoute || isTeacherRoute) && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Role isolation: A teacher opening /owner is redirected to /teacher
  if (isOwnerRoute && role !== "owner") {
    return NextResponse.redirect(new URL("/teacher", request.url));
  }

  // An owner opening /teacher is redirected to /owner
  if (isTeacherRoute && role !== "teacher") {
    return NextResponse.redirect(new URL("/owner", request.url));
  }

  // 3. If authenticated user visits /login -> redirect to their designated portal
  if (isLoginRoute && isAuthenticated) {
    const target = role === "owner" ? "/owner" : "/teacher";
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/owner/:path*", "/teacher/:path*", "/login"],
};
