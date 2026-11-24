import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { getMarkingWindowDetails } from "@/lib/dates";
import { recordAuditLog } from "@/lib/audit";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { recalculateClassSalary } from "@/lib/salary-recalc";
import type { Session } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/teacher/sessions/[id]/mark
 * Marks a session as "held" or "missed".
 * Enforces:
 * 1. Only the assigned teacher can mark their own session.
 * 2. Marking is only permitted within the marking window (session start until end of 3rd day).
 * 3. Records an auditLog entry.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { user, errorResponse } = await verifyApiAuth(request, ["teacher"]);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (status !== "held" && status !== "missed") {
      return NextResponse.json(
        { error: "Invalid status. Must be 'held' or 'missed'." },
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

    const sessionData = sessionDoc.data() as Session;

    // Enforce teacher data isolation
    if (sessionData.teacherId !== teacherId) {
      return NextResponse.json(
        { error: "Access denied. You can only mark sessions for your own classes." },
        { status: 403 }
      );
    }

    // Enforce marking window rule
    const window = getMarkingWindowDetails(sessionData.date, sessionData.startTime);
    if (!window.isOpen) {
      if (window.isBeforeWindow) {
        return NextResponse.json(
          { error: `This session cannot be marked until it starts at ${sessionData.startTime}.` },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error:
            "The marking window for this session has closed. Only an owner-approved correction request can change it.",
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const previousStatus = sessionData.status;

    // Update session record
    await sessionRef.update({
      status,
      markedAt: now,
      markedBy: teacherId,
      locked: false,
      updatedAt: now,
    });

    // Write auditLog entry
    await recordAuditLog({
      who: user!.email || teacherId,
      role: "teacher",
      action: `session_marked_${status}`,
      entity: "session",
      entityId: id,
      before: previousStatus,
      after: status,
      yearId,
      metadata: {
        className: sessionData.className,
        sessionDate: sessionData.date,
        sessionTime: `${sessionData.startTime} - ${sessionData.endTime}`,
      },
    });

    // Recalculate monthly salary for this class and teacher
    try {
      await recalculateClassSalary(
        yearId,
        sessionData.teacherId,
        sessionData.classId,
        sessionData.countsForMonth
      );
    } catch (recalcErr) {
      console.error("Salary recalc error after marking session:", recalcErr);
    }

    return NextResponse.json({
      session: {
        ...sessionData,
        status,
        markedAt: now,
        markedBy: teacherId,
      },
      message: `Session successfully marked as ${status}.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to mark session: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
