import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

/**
 * POST /api/notifications/read-all
 * Marks all unread notifications for the user as read.
 */
export async function POST(request: NextRequest) {
  const { user, errorResponse } = await verifyApiAuth(request, ["owner", "teacher"]);
  if (errorResponse) return errorResponse;

  const userId = user!.uid;

  try {
    const unreadSnap = await adminDb
      .collection("notifications")
      .where("userId", "==", userId)
      .where("readAt", "==", null)
      .get();

    const now = new Date().toISOString();
    const batch = adminDb.batch();

    unreadSnap.forEach((doc) => {
      batch.update(doc.ref, { readAt: now });
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      markedCount: unreadSnap.size,
    });
  } catch (error: any) {
    console.error("POST /api/notifications/read-all error:", error);
    return NextResponse.json(
      { error: "Failed to mark all as read: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
