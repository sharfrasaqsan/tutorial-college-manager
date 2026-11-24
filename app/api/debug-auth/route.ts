import { NextResponse } from "next/server";

export async function GET() {
  const envCheck: Record<string, any> = {
    NODE_ENV: process.env.NODE_ENV,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || null,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
    FIREBASE_CLIENT_EMAIL_EXISTS: !!process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_CLIENT_EMAIL_PREFIX: process.env.FIREBASE_CLIENT_EMAIL
      ? process.env.FIREBASE_CLIENT_EMAIL.slice(0, 15) + "..."
      : null,
    FIREBASE_PRIVATE_KEY_EXISTS: !!process.env.FIREBASE_PRIVATE_KEY,
    FIREBASE_PRIVATE_KEY_LENGTH: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.length
      : 0,
    FIREBASE_PRIVATE_KEY_HAS_BEGIN: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.includes("BEGIN PRIVATE KEY")
      : false,
    FIREBASE_PRIVATE_KEY_HAS_LITERAL_SLASH_N: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.includes("\\n")
      : false,
    FIREBASE_PRIVATE_KEY_HAS_REAL_NEWLINE: process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.includes("\n")
      : false,
  };

  let initError: string | null = null;
  try {
    const { getAdminApp } = await import("@/lib/firebase-admin");
    const app = getAdminApp();
    envCheck.APP_INITIALIZED = !!app;
    envCheck.APP_NAME = app.name;

    const { adminAuth } = await import("@/lib/firebase-admin");
    envCheck.AUTH_PROXY_LOADED = !!adminAuth;
  } catch (err: any) {
    initError = err?.stack || err?.message || String(err);
  }

  return NextResponse.json({
    status: initError ? "error" : "ok",
    envCheck,
    initError,
  });
}
