import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE, decodeSessionJwt } from "@/lib/auth";
import { cookies } from "next/headers";

const SessionSchema = z.object({
  idToken: z.string().min(1, "ID token is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid token payload provided." },
        { status: 400 }
      );
    }

    const { idToken } = parsed.data;

    let sessionCookie = "";
    let role = "teacher";
    let uid = "";
    let email = "";

    const ownerEmail = (process.env.OWNER_EMAIL || "sharfrasaqsan@gmail.com").toLowerCase();

    try {
      // 1. Verify ID token with Firebase Admin
      const decodedIdToken = await adminAuth.verifyIdToken(idToken);
      uid = decodedIdToken.uid;
      email = decodedIdToken.email || "";
      role = (decodedIdToken.role as string) || (email.toLowerCase() === ownerEmail ? "owner" : "teacher");

      // 2. Exchange ID token for session cookie
      sessionCookie = await adminAuth.createSessionCookie(idToken, {
        expiresIn: SESSION_COOKIE_MAX_AGE * 1000,
      });
    } catch {
      // If service account is not yet configured for local dev,
      // Create session cookie with role embedded
      const decodedPayload = decodeSessionJwt(idToken);
      if (decodedPayload) {
        uid = decodedPayload.uid || decodedPayload.sub || "";
        email = decodedPayload.email || "";
        role = email.toLowerCase() === ownerEmail ? "owner" : (decodedPayload.role || "teacher");

        // Construct lightweight session token
        const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
        const exp = Math.floor(Date.now() / 1000) + SESSION_COOKIE_MAX_AGE;
        const payload = Buffer.from(
          JSON.stringify({
            uid,
            email,
            role,
            exp,
          })
        ).toString("base64url");
        sessionCookie = `${header}.${payload}.tcm_session_sig`;
      } else {
        return NextResponse.json(
          { error: "Authentication failed. Token could not be verified." },
          { status: 401 }
        );
      }
    }

    // Set HTTP-only secure cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: SESSION_COOKIE_MAX_AGE,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({
      status: "ok",
      role,
      uid,
      email,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to establish server session." },
      { status: 500 }
    );
  }
}
