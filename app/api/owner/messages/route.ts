import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import type { ContactMessage } from "@/types";

export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const filterStatus = searchParams.get("status") || "all";

    const snap = await adminDb
      .collection("contact_messages")
      .orderBy("createdAt", "desc")
      .get();

    const allMessages: ContactMessage[] = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "Anonymous",
        email: data.email || "",
        phone: data.phone || undefined,
        subject: data.subject || "General Inquiry",
        message: data.message || "",
        status: data.status || "unread",
        createdAt: data.createdAt || new Date().toISOString(),
      };
    });

    const unreadCount = allMessages.filter((m) => m.status === "unread").length;

    let filtered = allMessages;
    if (filterStatus !== "all") {
      filtered = allMessages.filter((m) => m.status === filterStatus);
    }

    return NextResponse.json({
      messages: filtered,
      unreadCount,
      totalCount: allMessages.length,
    });
  } catch (error: any) {
    console.error("[Owner Messages] Failed to query contact messages:", error);
    return NextResponse.json(
      { error: "Failed to load contact messages." },
      { status: 500 }
    );
  }
}
