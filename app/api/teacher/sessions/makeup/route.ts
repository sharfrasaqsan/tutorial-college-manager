import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { checkClash } from "@/lib/clash";
import { slotToTimeInterval, sessionToTimeInterval } from "@/lib/timetable";
import { validateMakeupMonth } from "@/lib/dates";
import { parseISO } from "date-fns";
import { recordAuditLog } from "@/lib/audit";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { recalculateClassSalary } from "@/lib/salary-recalc";
import { notify, getOwnerUserId } from "@/lib/notifications";
import type { Session, TimeInterval, TimetableSlot } from "@/types";

/**
 * POST /api/teacher/sessions/makeup
 * Creates a make-up class session for one of the teacher's own classes.
 * Enforces:
 * 1. Only assigned teacher can schedule a make-up for their own class.
 * 2. Month selection rules: can count for previous month only up to the 5th of the current month.
 * 3. Shared clash check executed inside transaction.
 * 4. AuditLog recorded.
 */
export async function POST(request: NextRequest) {
  const { user, errorResponse } = await verifyApiAuth(request, ["teacher"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const { classId, date, startTime, endTime, countsForMonth } = body;
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = body.yearId || cookieYear || "2026";
    const teacherId = user!.uid;

    if (!classId || !date || !startTime || !endTime || !countsForMonth) {
      return NextResponse.json(
        { error: "Class, date, start time, end time, and target month are all required." },
        { status: 400 }
      );
    }

    if (startTime >= endTime) {
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 }
      );
    }

    // 1. Verify class belongs to authenticated teacher
    const classDoc = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .doc(classId)
      .get();

    if (!classDoc.exists) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    const classData = classDoc.data()!;
    if (classData.teacherId !== teacherId) {
      return NextResponse.json(
        { error: "Access denied. You can only schedule make-up sessions for your own classes." },
        { status: 403 }
      );
    }

    const className = classData.name || `${classData.grade} ${classData.subject}`;
    const grade = classData.grade || "";
    const subject = classData.subject || "";
    const teacherName = classData.teacherName || "Teacher";

    // 2. Validate make-up month rule (up to 5th for previous month)
    const monthVal = validateMakeupMonth(countsForMonth);
    if (!monthVal.valid) {
      return NextResponse.json({ error: monthVal.error }, { status: 400 });
    }

    const targetDate = parseISO(date);
    const weekday = targetDate.getDay();
    const now = new Date().toISOString();

    const sessionsCol = adminDb.collection("years").doc(yearId).collection("sessions");
    const slotsCol = adminDb.collection("years").doc(yearId).collection("slots");
    const newSessionRef = sessionsCol.doc();

    let createdSession: Session | null = null;

    // 3. Execute clash check and creation inside Firestore transaction
    await adminDb.runTransaction(async (transaction) => {
      // Fetch all slots
      const slotsSnap = await transaction.get(slotsCol);
      // Fetch existing sessions on that specific date
      const sessionsSnap = await transaction.get(sessionsCol.where("date", "==", date));

      const existingIntervals: TimeInterval[] = [];

      // Slots active on that weekday
      slotsSnap.forEach((d) => {
        const slot = d.data() as TimetableSlot;
        if (slot.weekday === weekday) {
          // If validFrom / validTo specified, ensure date is in range
          if (
            (!slot.validFrom || slot.validFrom <= date) &&
            (!slot.validTo || slot.validTo >= date)
          ) {
            existingIntervals.push({
              ...slotToTimeInterval({ ...slot, id: d.id }),
              date,
            });
          }
        }
      });

      // Specific sessions on that date (including other makeups)
      sessionsSnap.forEach((d) => {
        const s = d.data() as Session;
        if (s.status !== "missed") {
          existingIntervals.push(sessionToTimeInterval({ ...s, id: d.id }));
        }
      });

      const candidate: TimeInterval = {
        id: newSessionRef.id,
        classId,
        className,
        grade,
        teacherId,
        teacherName,
        date,
        weekday,
        startTime,
        endTime,
      };

      const clash = checkClash(candidate, existingIntervals);
      if (clash.hasClash) {
        throw new Error(clash.message || "Make-up session conflicts with existing schedule.");
      }

      createdSession = {
        id: newSessionRef.id,
        classId,
        className,
        grade,
        subject,
        yearId,
        teacherId,
        teacherName,
        date,
        startTime,
        endTime,
        type: "makeup",
        status: "scheduled",
        countsForMonth,
        locked: false,
      };

      transaction.set(newSessionRef, {
        ...createdSession,
        createdAt: now,
      });

      // Write auditLog entry inside transaction
      recordAuditLog(
        {
          who: user!.email || teacherId,
          role: "teacher",
          action: "session_makeup_created",
          entity: "session",
          entityId: newSessionRef.id,
          before: null,
          after: createdSession,
          yearId,
          metadata: {
            className,
            date,
            countsForMonth,
          },
        },
        transaction
      );
    });

    // Recalculate salary for this class and month
    try {
      await recalculateClassSalary(
        yearId,
        teacherId,
        classId,
        countsForMonth
      );
    } catch (recalcErr) {
      console.error("Salary recalc error after scheduling makeup:", recalcErr);
    }

    // Notify owner of newly scheduled make-up class
    try {
      const ownerId = await getOwnerUserId();
      if (ownerId) {
        await notify(
          ownerId,
          "Make-up Class Scheduled",
          `${teacherName} scheduled a make-up class for ${className} on ${date} (${startTime} - ${endTime}).`,
          "/owner/timetable"
        );
      }
    } catch (notifErr) {
      console.error("Makeup owner notification error:", notifErr);
    }

    return NextResponse.json(
      {
        session: createdSession,
        message: "Make-up session scheduled successfully.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to schedule make-up class." },
      { status: 400 }
    );
  }
}
