import { NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "__session";

export const dynamic = "force-dynamic";

export async function POST() {
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
