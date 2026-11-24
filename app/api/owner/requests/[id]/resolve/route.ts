import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { recordAuditLog } from "@/lib/audit";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { recalculateClassSalary } from "@/lib/salary-recalc";
import { notify } from "@/lib/notifications";
import type { CorrectionRequest, Session } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/owner/requests/[id]/resolve
 * Approves or rejects a teacher's session correction request.
 * Approving sets the session status (held/missed) as requested.
 * Both actions write auditLog entries.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { user, errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'." },
        { status: 400 }
      );
    }

    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = body.yearId || cookieYear || "2026";
    const now = new Date().toISOString();

    const requestRef = adminDb
      .collection("years")
      .doc(yearId)
      .collection("correctionRequests")
      .doc(id);

    const requestDoc = await requestRef.get();
    if (!requestDoc.exists) {
      return NextResponse.json({ error: "Correction request not found." }, { status: 404 });
    }

    const reqData = requestDoc.data()!;
    if (reqData.status !== "pending") {
      return NextResponse.json(
        { error: `This request has already been ${reqData.status}.` },
        { status: 400 }
      );
    }

    const sessionId = reqData.sessionId;
    const sessionRef = adminDb
      .collection("years")
      .doc(yearId)
      .collection("sessions")
      .doc(sessionId);

    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) {
      return NextResponse.json({ error: "Associated session not found." }, { status: 404 });
    }

    const sessionData = sessionDoc.data() as Session;
    const previousStatus = sessionData.status;

    if (action === "approve") {
      // 1. Update session status to the requested status
      await sessionRef.update({
        status: reqData.requestedStatus,
        markedAt: now,
        markedBy: "owner_approved",
        updatedAt: now,
      });

      // 2. Mark request as approved
      await requestRef.update({
        status: "approved",
        resolvedAt: now,
        resolvedBy: user!.email || "owner",
        updatedAt: now,
      });

      // 3. Record auditLog
      await recordAuditLog({
        who: user!.email || "owner",
        role: "owner",
        action: "correction_request_approved",
        entity: "session",
        entityId: sessionId,
        before: previousStatus,
        after: reqData.requestedStatus,
        yearId,
        metadata: {
          requestId: id,
          teacherId: reqData.teacherId,
          className: reqData.className,
          reason: reqData.reason,
        },
      });

      // Recalculate salary for this teacher, class, and month
      try {
        await recalculateClassSalary(
          yearId,
          sessionData.teacherId,
          sessionData.classId,
          sessionData.countsForMonth
        );
      } catch (recalcErr) {
        console.error("Salary recalc error after resolving correction:", recalcErr);
      }

      // Notify teacher of approval
      try {
        await notify(
          reqData.teacherId,
          "Correction Request Approved",
          `Your session correction request for ${sessionData.className} was approved by the owner. Session marked as ${reqData.requestedStatus}.`,
          "/teacher/timetable"
        );
      } catch (notifErr) {
        console.error("Correction resolve notify teacher error:", notifErr);
      }

      return NextResponse.json({
        message: `Correction request approved. Session marked as ${reqData.requestedStatus}.`,
        status: "approved",
      });
    } else {
      // Reject request without altering session status
      await requestRef.update({
        status: "rejected",
        resolvedAt: now,
        resolvedBy: user!.email || "owner",
        updatedAt: now,
      });

      // Record auditLog
      await recordAuditLog({
        who: user!.email || "owner",
        role: "owner",
        action: "correction_request_rejected",
        entity: "correctionRequest",
        entityId: id,
        before: "pending",
        after: "rejected",
        yearId,
        metadata: {
          sessionId,
          teacherId: reqData.teacherId,
          reason: reqData.reason,
        },
      });

      // Notify teacher of rejection
      try {
        await notify(
          reqData.teacherId,
          "Correction Request Rejected",
          `Your session correction request for ${sessionData.className} was reviewed and rejected by the owner.`,
          "/teacher/timetable"
        );
      } catch (notifErr) {
        console.error("Correction reject notify teacher error:", notifErr);
      }

      return NextResponse.json({
        message: "Correction request rejected.",
        status: "rejected",
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to resolve correction request: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
