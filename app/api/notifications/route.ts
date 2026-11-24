import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { AppNotification } from "@/types";

/**
 * GET /api/notifications
 * Returns in-app notifications for the authenticated user, sorted by createdAt descending.
 * Returns unreadCount.
 */
export async function GET(request: NextRequest) {
  const { user, errorResponse } = await verifyApiAuth(request, ["owner", "teacher"]);
  if (errorResponse) return errorResponse;

  const userId = user!.uid;

  try {
    const notifsSnap = await adminDb
      .collection("notifications")
      .where("userId", "==", userId)
      .get();

    const notifications: AppNotification[] = [];
    let unreadCount = 0;

    notifsSnap.forEach((doc) => {
      const data = doc.data() as AppNotification;
      notifications.push({
        id: doc.id,
        userId: data.userId,
        title: data.title,
        body: data.body,
        link: data.link || "/",
        readAt: data.readAt || null,
        createdAt: data.createdAt,
      });

      if (!data.readAt) {
        unreadCount++;
      }
    });

    notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { error: "Failed to load notifications: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
