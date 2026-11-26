import { NextRequest, NextResponse } from "next/server";
import { invalidateSessionCache, SESSION_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionCookie) {
    invalidateSessionCache(sessionCookie);
  }

  const response = NextResponse.json({
    status: "ok",
    message: "Logged out successfully.",
  });

  // Delete session cookie directly on the response headers (no firebase-admin needed)
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
  });

  return response;
}
