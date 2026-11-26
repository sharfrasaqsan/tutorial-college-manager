import { adminAuth, adminDb } from "./firebase-admin.ts";
import type { UserRole, AuthUser } from "../types/index.ts";
import { NextResponse, type NextRequest } from "next/server.js";
import { generateTemporaryPassword } from "./email.ts";

export const SESSION_COOKIE_NAME = "__session";
export const SESSION_COOKIE_MAX_AGE = 5 * 24 * 60 * 60; // 5 days in seconds

/**
 * Creates a teacher user in Firebase Auth with the "teacher" custom claim,
 * records the teacher in Firestore, provisions initial password, and generates a password setup link.
 */
export async function createTeacherAccount(
  email: string,
  name: string,
  initialPassword?: string
): Promise<{ uid: string; email: string; password: string; resetLink: string }> {
  const password = initialPassword?.trim() || generateTemporaryPassword();

  // 1. Create or get user in Firebase Auth with login password
  let user;
  try {
    user = await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(user.uid, {
      password,
      displayName: name,
    });
  } catch {
    user = await adminAuth.createUser({
      email,
      password,
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
    password,
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

// In-memory cache for verified sessions (avoids repetitive Google network calls on concurrent API requests)
interface CachedSession {
  decoded: any;
  cachedAt: number;
}
const sessionCache = new Map<string, CachedSession>();
const SESSION_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// In-memory cache for Firestore fallback role queries
const roleCache = new Map<string, { role: UserRole; expiresAt: number }>();
const ROLE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateSessionCache(cookieValue?: string) {
  if (cookieValue) {
    sessionCache.delete(cookieValue);
  } else {
    sessionCache.clear();
  }
}

/**
 * Strictly verify session cookie using Firebase Admin.
 * Uses local cryptographic signature validation with fast in-memory caching
 * to prevent multi-second roundtrip network delays to Google on every API call.
 */
export async function verifyServerSession(cookieValue?: string) {
  if (!cookieValue) return null;

  const now = Date.now();
  const cached = sessionCache.get(cookieValue);
  if (cached && now - cached.cachedAt < SESSION_CACHE_TTL_MS) {
    const isExpired = cached.decoded?.exp ? now >= cached.decoded.exp * 1000 : false;
    if (!isExpired) {
      return cached.decoded;
    }
    sessionCache.delete(cookieValue);
  }

  try {
    // verifySessionCookie with checkRevoked=false uses fast in-memory RSA crypto
    // against Google's public keys, eliminating 300-1000ms network roundtrips per call
    const decoded = await adminAuth.verifySessionCookie(cookieValue, false);
    if (decoded) {
      sessionCache.set(cookieValue, { decoded, cachedAt: now });
    }
    return decoded;
  } catch {
    sessionCache.delete(cookieValue);
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

  // Read role from verified Firebase claims or Firestore with caching
  let role: UserRole | null = null;
  if (decoded.role === "owner" || decoded.role === "teacher") {
    role = decoded.role as UserRole;
  } else {
    // Check role cache first
    const uid = decoded.uid || decoded.sub;
    const now = Date.now();
    if (uid && roleCache.has(uid) && roleCache.get(uid)!.expiresAt > now) {
      role = roleCache.get(uid)!.role;
    } else if (uid) {
      const userDoc = await adminDb.collection("users").doc(uid).get();
      if (userDoc.exists) {
        const docRole = userDoc.data()?.role;
        if (docRole === "owner" || docRole === "teacher") {
          role = docRole;
          roleCache.set(uid, { role: docRole, expiresAt: now + ROLE_CACHE_TTL_MS });
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
            roleCache.set(uid, { role: docRole, expiresAt: now + ROLE_CACHE_TTL_MS });
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
