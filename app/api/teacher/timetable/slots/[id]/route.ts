import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { checkClash } from "@/lib/clash";
import {
  UpdateSlotSchema,
  generateSessionsForSlot,
  slotToTimeInterval,
} from "@/lib/timetable";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { getColomboNow } from "@/lib/dates";
import { format } from "date-fns";
import type { TimetableSlot, TimeInterval } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/teacher/timetable/slots/[id]
 * Teacher updates one of their own timetable slots.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { user, errorResponse } = await verifyApiAuth(request, ["teacher"]);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const body = await request.json();
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = body.yearId || cookieYear || "2026";
    const teacherId = user!.uid;

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

    let updatedSlot: TimetableSlot | null = null;

    await adminDb.runTransaction(async (transaction) => {
      const slotSnap = await transaction.get(slotRef);
      if (!slotSnap.exists) {
        throw new Error("Timetable slot not found.");
      }

      const existingSlot = slotSnap.data() as TimetableSlot;
      // Enforce teacher data isolation
      if (existingSlot.teacherId !== teacherId) {
        throw new Error("Access denied. You can only update your own timetable slots.");
      }

      // Fetch all slots to check clashes
      const allSlotsSnap = await transaction.get(
        adminDb.collection("years").doc(yearId).collection("slots")
      );

      // Fetch existing sessions for this slot before writes (Firestore transaction requirement)
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
        classId: existingSlot.classId,
        className: existingSlot.className,
        grade: existingSlot.grade || "",
        teacherId,
        teacherName: existingSlot.teacherName,
        weekday,
        startTime,
        endTime,
      };

      const clash = checkClash(candidate, existingIntervals);
      if (clash.hasClash) {
        throw new Error(clash.message || "Updated slot conflicts with existing schedule.");
      }

      updatedSlot = {
        id,
        yearId,
        classId: existingSlot.classId,
        className: existingSlot.className,
        grade: existingSlot.grade,
        subject: existingSlot.subject,
        teacherId,
        teacherName: existingSlot.teacherName,
        weekday,
        startTime,
        endTime,
        validFrom,
        validTo,
        createdAt: existingSlot.createdAt || now,
        updatedAt: now,
      };

      transaction.set(slotRef, updatedSlot);

      // Future scheduled sessions only
      const isWeekdayOrRangeChanged =
        existingSlot.weekday !== weekday ||
        existingSlot.validFrom !== validFrom ||
        existingSlot.validTo !== validTo;

      if (isWeekdayOrRangeChanged) {
        sessionsSnap.forEach((sessDoc) => {
          const s = sessDoc.data();
          if (s.date >= todayStr && s.status === "scheduled") {
            transaction.delete(sessDoc.ref);
          }
        });

        const startFrom = validFrom > todayStr ? validFrom : todayStr;
        if (startFrom <= validTo) {
          const newFutureSessions = generateSessionsForSlot({
            slotId: id,
            yearId,
            classId: existingSlot.classId,
            className: existingSlot.className || "Class",
            grade: existingSlot.grade || "",
            subject: existingSlot.subject || "",
            teacherId,
            teacherName: existingSlot.teacherName || "Teacher",
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

    return NextResponse.json({
      slot: updatedSlot,
      message: "Slot and future scheduled sessions updated successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update slot." },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/teacher/timetable/slots/[id]
 * Teacher deletes one of their own timetable slots.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { user, errorResponse } = await verifyApiAuth(request, ["teacher"]);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = new URL(request.url).searchParams.get("yearId") || cookieYear || "2026";
    const teacherId = user!.uid;

    const slotRef = adminDb.collection("years").doc(yearId).collection("slots").doc(id);
    const slotDoc = await slotRef.get();

    if (!slotDoc.exists) {
      return NextResponse.json({ error: "Slot not found." }, { status: 404 });
    }

    const slotData = slotDoc.data() as TimetableSlot;
    if (slotData.teacherId !== teacherId) {
      return NextResponse.json(
        { error: "Access denied. You can only delete your own timetable slots." },
        { status: 403 }
      );
    }

    const todayStr = format(getColomboNow(), "yyyy-MM-dd");

    // Delete slot
    await slotRef.delete();

    // Delete future scheduled sessions only
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
      if (data.date >= todayStr && data.status === "scheduled") {
        batch.delete(doc.ref);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      message: "Slot and future scheduled sessions deleted successfully.",
      deletedSessionsCount: deletedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete slot: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
