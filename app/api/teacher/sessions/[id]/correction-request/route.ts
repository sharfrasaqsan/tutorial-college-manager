import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { recordAuditLog } from "@/lib/audit";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { notify, getOwnerUserId } from "@/lib/notifications";
import type { Session, CorrectionRequest } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/teacher/sessions/[id]/correction-request
 * Teacher submits a correction request for a locked session.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { user, errorResponse } = await verifyApiAuth(request, ["teacher"]);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const body = await request.json();
    const { requestedStatus, reason } = body;

    if (requestedStatus !== "held" && requestedStatus !== "missed") {
      return NextResponse.json(
        { error: "Requested status must be 'held' or 'missed'." },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return NextResponse.json(
        { error: "Please provide a clear reason for the correction request (at least 5 characters)." },
        { status: 400 }
      );
    }

    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = body.yearId || cookieYear || "2026";
    const teacherId = user!.uid;

    const sessionRef = adminDb
      .collection("years")
      .doc(yearId)
      .collection("sessions")
      .doc(id);

    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const session = sessionDoc.data() as Session;

    // Enforce teacher data isolation
    if (session.teacherId !== teacherId) {
      return NextResponse.json(
        { error: "Access denied. You can only request corrections for your own sessions." },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const reqRef = adminDb
      .collection("years")
      .doc(yearId)
      .collection("correctionRequests")
      .doc();

    const correctionData = {
      id: reqRef.id,
      sessionId: id,
      sessionDate: session.date,
      sessionTime: `${session.startTime} - ${session.endTime}`,
      className: session.className || "Class",
      teacherId,
      teacherName: session.teacherName || "Teacher",
      currentStatus: session.status,
      requestedStatus,
      reason: reason.trim(),
      status: "pending",
      createdAt: now,
    };

    await reqRef.set(correctionData);

    // Audit log
    await recordAuditLog({
      who: user!.email || teacherId,
      role: "teacher",
      action: "correction_request_submitted",
      entity: "correctionRequest",
      entityId: reqRef.id,
      before: null,
      after: correctionData,
      yearId,
      metadata: {
        sessionId: id,
        requestedStatus,
      },
    });

    // Notify college owner of new correction request
    try {
      const ownerId = await getOwnerUserId();
      if (ownerId) {
        await notify(
          ownerId,
          "New Session Correction Request",
          `${session.teacherName || "Teacher"} submitted a correction request for ${session.className || "Class"}: "${reason.trim()}".`,
          "/owner/requests"
        );
      }
    } catch (notifErr) {
      console.error("Correction request notification error:", notifErr);
    }

    return NextResponse.json(
      {
        request: correctionData,
        message: "Correction request submitted successfully. The college owner will review it.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to submit correction request: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
