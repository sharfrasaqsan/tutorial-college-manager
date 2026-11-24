import { adminAuth, adminDb } from "./firebase-admin.ts";
import type { UserRole, AuthUser } from "../types/index.ts";
import { NextResponse, type NextRequest } from "next/server.js";

export const SESSION_COOKIE_NAME = "__session";
export const SESSION_COOKIE_MAX_AGE = 5 * 24 * 60 * 60; // 5 days in seconds

/**
 * Creates a teacher user in Firebase Auth with the "teacher" custom claim,
 * records the teacher in Firestore, and generates a password setup link.
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

  // 2. Set custom claims for teacher role directly in Firebase Auth
  await adminAuth.setCustomUserClaims(user.uid, {
    role: "teacher",
  });

  // 3. Generate password setup/reset email link
  const resetLink = await adminAuth.generatePasswordResetLink(email);

  // 4. Save teacher and user records in Firestore
  const now = new Date().toISOString();
  await adminDb.collection("teachers").doc(user.uid).set(
    {
      id: user.uid,
      name,
      email,
      active: true,
      createdAt: now,
    },
    { merge: true }
  );

  await adminDb.collection("users").doc(user.uid).set(
    {
      uid: user.uid,
      email,
      name,
      role: "teacher",
      createdAt: now,
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
 * Parses claims from a JWT token safely (used by Edge middleware)
 */
export function parseJwtClaims(token: string): { [key: string]: any } | null {
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
 * Strictly verify session cookie using Firebase Admin.
 * NO fallback token decoding.
 */
export async function verifyServerSession(cookieValue?: string) {
  if (!cookieValue) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(cookieValue, true);
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Authorize an API request strictly via Firebase Admin session cookie and Firestore.
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

  // Strictly verify with Firebase Admin
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

  // Read role from verified Firebase claims or Firestore
  let role: UserRole | null = null;
  if (decoded.role === "owner" || decoded.role === "teacher") {
    role = decoded.role as UserRole;
  } else {
    // Check Firestore
    const uid = decoded.uid || decoded.sub;
    if (uid) {
      const userDoc = await adminDb.collection("users").doc(uid).get();
      if (userDoc.exists) {
        const docRole = userDoc.data()?.role;
        if (docRole === "owner" || docRole === "teacher") {
          role = docRole;
        }
      } else {
        // Fallback: check by uid or email field in case doc ID was auto-generated
        let snap = await adminDb.collection("users").where("uid", "==", uid).limit(1).get();
        if (snap.empty && decoded.email) {
          snap = await adminDb.collection("users").where("email", "==", decoded.email).limit(1).get();
        }
        if (!snap.empty) {
          const docRole = snap.docs[0].data()?.role;
          if (docRole === "owner" || docRole === "teacher") {
            role = docRole;
          }
        }
      }
    }
  }

  if (!role) {
    return {
      user: null,
      errorResponse: NextResponse.json(
        { error: "Access denied. User does not have a valid role in Firebase/Firestore." },
        { status: 403 }
      ),
    };
  }

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
