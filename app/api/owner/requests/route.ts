import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import type { CorrectionRequest } from "@/types";

/**
 * GET /api/owner/requests
 * Lists all teacher session correction requests for the owner's review.
 */
export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";
    const status = searchParams.get("status");

    let query: FirebaseFirestore.Query = adminDb
      .collection("years")
      .doc(yearId)
      .collection("correctionRequests");

    if (status && (status === "pending" || status === "approved" || status === "rejected")) {
      query = query.where("status", "==", status);
    }

    const snap = await query.get();
    const requests: CorrectionRequest[] = [];

    snap.forEach((doc) => {
      const data = doc.data();
      requests.push({
        id: doc.id,
        sessionId: data.sessionId,
        teacherId: data.teacherId,
        teacherName: data.teacherName || "Teacher",
        requestedStatus: data.requestedStatus,
        reason: data.reason || "",
        status: data.status || "pending",
        createdAt: data.createdAt,
        resolvedAt: data.resolvedAt,
        sessionDate: data.sessionDate,
        sessionTime: data.sessionTime,
        className: data.className,
        currentStatus: data.currentStatus,
      } as any);
    });

    // Sort by createdAt descending (newest first)
    requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const pendingCount = requests.filter((r) => r.status === "pending").length;

    return NextResponse.json({ requests, pendingCount });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch correction requests: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
