import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/notifications/[id]/read
 * Marks a notification as read.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { user, errorResponse } = await verifyApiAuth(request, ["owner", "teacher"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const notifRef = adminDb.collection("notifications").doc(id);
    const doc = await notifRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Notification not found." }, { status: 404 });
    }

    if (doc.data()?.userId !== user!.uid) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const now = new Date().toISOString();
    await notifRef.update({
      readAt: now,
    });

    return NextResponse.json({ success: true, readAt: now });
  } catch (error: any) {
    console.error("PATCH /api/notifications/[id]/read error:", error);
    return NextResponse.json(
      { error: "Failed to mark notification as read: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
