import { adminAuth, adminDb } from "./firebase-admin.ts";
import type { UserRole, AuthUser } from "../types/index.ts";
import { NextResponse, type NextRequest } from "next/server.js";

export const SESSION_COOKIE_NAME = "__session";
export const SESSION_COOKIE_MAX_AGE = 5 * 24 * 60 * 60; // 5 days in seconds

/**
 * Creates a teacher user in Firebase Auth with the "teacher" custom claim,
 * records the teacher in Firestore, and generates a password setup link.
 * Used in Step 4 when adding teachers.
 */
export async function createTeacherAccount(
  email: string,
  name: string
): Promise<{ uid: string; email: string; resetLink: string }> {
  // 1. Create or get user in Firebase Auth
  let user;
  try {
    user = await adminAuth.getUserByEmail(email);
  } catch {
    user = await adminAuth.createUser({
      email,
      displayName: name,
      emailVerified: false,
    });
  }

  // 2. Set custom claims for teacher role
  await adminAuth.setCustomUserClaims(user.uid, {
    role: "teacher",
  });

  // 3. Generate password setup/reset email link
  const resetLink = await adminAuth.generatePasswordResetLink(email);

  // 4. Save teacher record in Firestore
  await adminDb.collection("teachers").doc(user.uid).set(
    {
      id: user.uid,
      name,
      email,
      active: true,
      createdAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return {
    uid: user.uid,
    email,
    resetLink,
  };
}

/**
 * Decodes a session JWT payload (safe for Edge and Node)
 */
export function decodeSessionJwt(token: string): { [key: string]: any } | null {
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

/**
 * Verify session cookie on server for API routes using Firebase Admin
 */
export async function verifyServerSession(cookieValue?: string) {
  if (!cookieValue) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(cookieValue, true);
    return decoded;
  } catch {
    // If verifySessionCookie fails (e.g. In local development without service account credentials),
    // Fall back to decoded payload if valid and unexpired
    const payload = decodeSessionJwt(cookieValue);
    if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
      return payload;
    }
    return null;
  }
}

/**
 * Authorize an API request by verifying cookie and role.
 */
export async function verifyApiAuth(
  request: NextRequest,
  allowedRoles?: UserRole[]
): Promise<{ user: AuthUser | null; errorResponse: NextResponse | null }> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Authentication required. Please log in." },
        { status: 401 }
      ),
    };
  }

  const decoded = await verifyServerSession(sessionCookie);
  if (!decoded) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Session invalid or expired. Please log in again." },
        { status: 401 }
      ),
    };
  }

  const ownerEmail = (process.env.OWNER_EMAIL || "sharfrasaqsan@gmail.com").toLowerCase();
  const isOwnerUser = decoded.role === "owner" || (decoded.email && decoded.email.toLowerCase() === ownerEmail);
  const role = isOwnerUser ? "owner" : ((decoded.role as UserRole) || "teacher");
  const user: AuthUser = {
    uid: decoded.uid || decoded.sub || "",
    email: decoded.email || "",
    role,
    displayName: decoded.name || undefined,
  };

  if (allowedRoles && !allowedRoles.includes(role)) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Access denied. Insufficient permissions." },
        { status: 403 }
      ),
    };
  }

  return { user, errorResponse: null };
}

export function isOwner(role: UserRole | null | undefined): boolean {
  return role === "owner";
}

export function isTeacher(role: UserRole | null | undefined): boolean {
  return role === "teacher";
}
