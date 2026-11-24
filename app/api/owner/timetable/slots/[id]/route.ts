import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { checkClash } from "@/lib/clash";
import {
  UpdateSlotSchema,
  generateSessionsForSlot,
  slotToTimeInterval,
} from "@/lib/timetable";
import { notifyTeacherTimetableChange } from "@/lib/notifications";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { getColomboNow } from "@/lib/dates";
import { format } from "date-fns";
import type { TimetableSlot, TimeInterval, Session } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/owner/timetable/slots/[id]
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = new URL(request.url).searchParams.get("yearId") || cookieYear || "2026";

    const slotDoc = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("slots")
      .doc(id)
      .get();

    if (!slotDoc.exists) {
      return NextResponse.json({ error: "Timetable slot not found." }, { status: 404 });
    }

    return NextResponse.json({ slot: { ...slotDoc.data(), id: slotDoc.id } });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch timetable slot: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/owner/timetable/slots/[id]
 * Updates a timetable slot inside a Firestore transaction.
 * Runs clash detection and updates future scheduled sessions ONLY.
 * Past sessions are never touched.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const body = await request.json();
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = body.yearId || cookieYear || "2026";

    // 1. Validate payload
    const parsed = UpdateSlotSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid timetable slot update.";
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const { weekday, startTime, endTime } = parsed.data;
    const validFrom = parsed.data.validFrom || `${yearId}-01-01`;
    const validTo = parsed.data.validTo || `${yearId}-12-31`;

    const slotRef = adminDb.collection("years").doc(yearId).collection("slots").doc(id);
    const sessionsCol = adminDb.collection("years").doc(yearId).collection("sessions");
    const now = new Date().toISOString();
    const todayStr = format(getColomboNow(), "yyyy-MM-dd");

    let teacherId = "";
    let className = "";
    let updatedSlot: TimetableSlot | null = null;

    // 2. Execute clash check and updates inside transaction
    await adminDb.runTransaction(async (transaction) => {
      const slotSnap = await transaction.get(slotRef);
      if (!slotSnap.exists) {
        throw new Error("Timetable slot not found.");
      }

      const existingSlot = slotSnap.data() as TimetableSlot;
      teacherId = existingSlot.teacherId;
      className = existingSlot.className || "Class";
      const grade = existingSlot.grade || "";
      const classId = existingSlot.classId;
      const subject = existingSlot.subject || "";
      const teacherName = existingSlot.teacherName || "Teacher";

      // Fetch all slots to check clashes
      const allSlotsSnap = await transaction.get(
        adminDb.collection("years").doc(yearId).collection("slots")
      );

      // Fetch existing sessions for this slot BEFORE any writes (Firestore transaction requirement)
      const sessionsSnap = await transaction.get(
        sessionsCol.where("slotId", "==", id)
      );

      const existingIntervals: TimeInterval[] = [];
      allSlotsSnap.forEach((doc) => {
        if (doc.id !== id) {
          const d = doc.data() as TimetableSlot;
          existingIntervals.push(
            slotToTimeInterval({
              ...d,
              id: doc.id,
            })
          );
        }
      });

      const candidate: TimeInterval = {
        id,
        classId,
        className,
        grade,
        teacherId,
        teacherName,
        weekday,
        startTime,
        endTime,
      };

      const clash = checkClash(candidate, existingIntervals);
      if (clash.hasClash) {
        throw new Error(clash.message || "Updated slot conflicts with existing schedule.");
      }

      // 3. Update slot document
      updatedSlot = {
        id,
        yearId,
        classId,
        className,
        grade,
        subject,
        teacherId,
        teacherName,
        weekday,
        startTime,
        endTime,
        validFrom,
        validTo,
        createdAt: existingSlot.createdAt || now,
        updatedAt: now,
      };

      transaction.set(slotRef, updatedSlot);

      // 4. Update FUTURE scheduled sessions only
      // Past sessions and marked sessions (held, missed, notCompleted) are strictly preserved!
      const isWeekdayOrRangeChanged =
        existingSlot.weekday !== weekday ||
        existingSlot.validFrom !== validFrom ||
        existingSlot.validTo !== validTo;

      if (isWeekdayOrRangeChanged) {
        // Delete future scheduled sessions
        sessionsSnap.forEach((sessDoc) => {
          const s = sessDoc.data();
          if (s.date >= todayStr && s.status === "scheduled") {
            transaction.delete(sessDoc.ref);
          }
        });

        // Generate new future sessions from max(todayStr, validFrom) to validTo
        const startFrom = validFrom > todayStr ? validFrom : todayStr;
        if (startFrom <= validTo) {
          const newFutureSessions = generateSessionsForSlot({
            slotId: id,
            yearId,
            classId,
            className,
            grade,
            subject,
            teacherId,
            teacherName,
            weekday,
            startTime,
            endTime,
            validFrom: startFrom,
            validTo,
          });

          for (const s of newFutureSessions) {
            transaction.set(sessionsCol.doc(s.id), s);
          }
        }
      } else {
        // Only times changed: update startTime & endTime for future scheduled sessions
        sessionsSnap.forEach((sessDoc) => {
          const s = sessDoc.data();
          if (s.date >= todayStr && s.status === "scheduled") {
            transaction.update(sessDoc.ref, {
              startTime,
              endTime,
              updatedAt: now,
            });
          }
        });
      }
    });

    // 5. Notify teacher of the update
    if (teacherId) {
      await notifyTeacherTimetableChange({
        teacherId,
        slotId: id,
        action: "updated",
        className,
        weekday,
        startTime,
        endTime,
        yearId,
      });
    }

    return NextResponse.json({
      slot: updatedSlot,
      message: "Timetable slot and future scheduled sessions updated successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update timetable slot." },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/owner/timetable/slots/[id]
 * Deletes a slot and future scheduled sessions.
 * Past sessions and marked records remain preserved in history.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = new URL(request.url).searchParams.get("yearId") || cookieYear || "2026";

    const slotRef = adminDb.collection("years").doc(yearId).collection("slots").doc(id);
    const slotDoc = await slotRef.get();

    if (!slotDoc.exists) {
      return NextResponse.json({ error: "Timetable slot not found." }, { status: 404 });
    }

    const slotData = slotDoc.data() as TimetableSlot;
    const todayStr = format(getColomboNow(), "yyyy-MM-dd");

    // 1. Delete slot record
    await slotRef.delete();

    // 2. Delete future scheduled sessions only
    const sessionsSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("sessions")
      .where("slotId", "==", id)
      .get();

    const batch = adminDb.batch();
    let deletedCount = 0;

    sessionsSnap.forEach((doc) => {
      const data = doc.data();
      // Only delete if scheduled and on or after today
      if (data.date >= todayStr && data.status === "scheduled") {
        batch.delete(doc.ref);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      await batch.commit();
    }

    // 3. Notify teacher of deletion
    if (slotData.teacherId) {
      await notifyTeacherTimetableChange({
        teacherId: slotData.teacherId,
        slotId: id,
        action: "deleted",
        className: slotData.className || "Class",
        weekday: slotData.weekday,
        startTime: slotData.startTime,
        endTime: slotData.endTime,
        yearId,
      });
    }

    return NextResponse.json({
      message: "Timetable slot and future scheduled sessions deleted successfully.",
      deletedSessionsCount: deletedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete timetable slot: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
