import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

/**
 * POST /api/notifications/fcm-token
 * Registers or updates an FCM web push token for the authenticated user/device.
 */
export async function POST(request: NextRequest) {
  const { user, errorResponse } = await verifyApiAuth(request, ["owner", "teacher"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const token = body.token?.trim();
    const device = body.device || request.headers.get("user-agent") || "unknown";

    if (!token) {
      return NextResponse.json({ error: "FCM token is required." }, { status: 400 });
    }

    const tokenRef = adminDb.collection("fcmTokens").doc(token);
    const existing = await tokenRef.get();
    const now = new Date().toISOString();

    await tokenRef.set(
      {
        token,
        userId: user!.uid,
        role: user!.role,
        device,
        updatedAt: now,
        ...(existing.exists ? {} : { createdAt: now }),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, message: "FCM token registered." });
  } catch (error: any) {
    console.error("POST /api/notifications/fcm-token error:", error);
    return NextResponse.json(
      { error: "Failed to register FCM token: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/fcm-token
 * Unregisters an FCM web push token (e.g. on logout or permission revoke).
 */
export async function DELETE(request: NextRequest) {
  const { user, errorResponse } = await verifyApiAuth(request, ["owner", "teacher"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const token = body.token?.trim();

    if (!token) {
      return NextResponse.json({ error: "FCM token is required." }, { status: 400 });
    }

    const tokenRef = adminDb.collection("fcmTokens").doc(token);
    const doc = await tokenRef.get();

    if (doc.exists && doc.data()?.userId === user!.uid) {
      await tokenRef.delete();
    }

    return NextResponse.json({ success: true, message: "FCM token unregistered." });
  } catch (error: any) {
    console.error("DELETE /api/notifications/fcm-token error:", error);
    return NextResponse.json(
      { error: "Failed to unregister FCM token: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
