import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE } from "@/lib/auth";
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

    // 1. Strictly verify ID token with Firebase Admin
    const decodedIdToken = await adminAuth.verifyIdToken(idToken, true);
    const uid = decodedIdToken.uid;
    const email = decodedIdToken.email || "";

    // 2. Read role strictly from Firebase Auth custom claims or Firestore users collection
    let role: "owner" | "teacher" | null = null;

    if (decodedIdToken.role === "owner" || decodedIdToken.role === "teacher") {
      role = decodedIdToken.role;
    } else {
      // Check Firebase Auth user record directly
      const userRecord = await adminAuth.getUser(uid);
      if (userRecord.customClaims?.role === "owner" || userRecord.customClaims?.role === "teacher") {
        role = userRecord.customClaims.role;
      } else {
        // Check Firestore database
        const userDoc = await adminDb.collection("users").doc(uid).get();
        if (userDoc.exists) {
          const docRole = userDoc.data()?.role;
          if (docRole === "owner" || docRole === "teacher") {
            role = docRole;
            // Sync claim back to Firebase Auth so subsequent tokens contain it
            await adminAuth.setCustomUserClaims(uid, { role });
          }
        } else {
          // Fallback / Self-healing: check if user document was created with an auto-generated ID or matched by uid / email
          let snap = await adminDb.collection("users").where("uid", "==", uid).limit(1).get();
          if (snap.empty && email) {
            snap = await adminDb.collection("users").where("email", "==", email).limit(1).get();
          }
          if (!snap.empty) {
            const matchedDoc = snap.docs[0];
            const docRole = matchedDoc.data()?.role;
            if (docRole === "owner" || docRole === "teacher") {
              role = docRole;
              // Auto-heal: Ensure users/{uid} exists with proper document ID
              await adminDb.collection("users").doc(uid).set(
                {
                  ...matchedDoc.data(),
                  uid,
                  updatedAt: new Date().toISOString(),
                },
                { merge: true }
              );
              await adminAuth.setCustomUserClaims(uid, { role });
            }
          }
        }
      }
    }

    // Strictly reject any user without an authorized role in Firebase / Firestore
    if (!role) {
      return NextResponse.json(
        { error: "Access denied. Your account is not registered as an owner or teacher in Firebase/Firestore." },
        { status: 403 }
      );
    }

    // 3. Exchange ID token for official Firebase session cookie
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_COOKIE_MAX_AGE * 1000,
    });

    // 4. Set HTTP-only secure cookie
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Authentication failed. Unable to verify user session with Firebase." },
      { status: 401 }
    );
  }
}
