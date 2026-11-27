import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { checkClash } from "@/lib/clash";
import {
  CreateSlotSchema,
  generateSessionsForSlot,
  slotToTimeInterval,
} from "@/lib/timetable";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import type { TimetableSlot, TimeInterval, Session } from "@/types";

/**
 * GET /api/teacher/timetable/slots
 * Lists all timetable slots owned by the authenticated teacher.
 */
export async function GET(request: NextRequest) {
  const { user, errorResponse } = await verifyApiAuth(request, ["teacher"]);
  if (errorResponse) return errorResponse;

  try {
    const teacherId = user!.uid;
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = cookieYear || "2026";

    // 1. Fetch slots for this teacher
    const slotsSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("slots")
      .where("teacherId", "==", teacherId)
      .get();

    const slots: TimetableSlot[] = [];
    slotsSnap.forEach((doc) => {
      const data = doc.data();
      slots.push({
        id: doc.id,
        yearId,
        classId: data.classId,
        className: data.className || "Class",
        grade: data.grade || "",
        subject: data.subject || "",
        teacherId: data.teacherId,
        teacherName: data.teacherName || "Teacher",
        weekday: data.weekday,
        startTime: data.startTime,
        endTime: data.endTime,
        validFrom: data.validFrom,
        validTo: data.validTo,
        color: data.color,
        isTemporary: data.isTemporary || false,
        slotType: data.slotType || (data.isTemporary ? "extra" : "regular"),
        specificDate: data.specificDate,
        countsForMonth: data.countsForMonth,
        note: data.note,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    // Sort by weekday then startTime
    slots.sort((a, b) => {
      if (a.weekday !== b.weekday) return a.weekday - b.weekday;
      return a.startTime.localeCompare(b.startTime);
    });

    // 2. Fetch teacher's own active classes
    const classesSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .where("teacherId", "==", teacherId)
      .where("active", "==", true)
      .get();

    const classes = classesSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        grade: data.grade,
        subject: data.subject,
      };
    });

    return NextResponse.json({ slots, classes, teacherId });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch teacher timetable: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teacher/timetable/slots
 * Teacher creates a slot for one of their own classes.
 * Enforces clash rules inside transaction.
 */
export async function POST(request: NextRequest) {
  const { user, errorResponse } = await verifyApiAuth(request, ["teacher"]);
  if (errorResponse) return errorResponse;

  try {
    const teacherId = user!.uid;
    const body = await request.json();
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = body.yearId || cookieYear || "2026";

    const parsed = CreateSlotSchema.safeParse({ ...body, yearId });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid timetable slot.";
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const { classId, weekday, startTime, endTime } = parsed.data;
    const validFrom = parsed.data.validFrom || `${yearId}-01-01`;
    const validTo = parsed.data.validTo || `${yearId}-12-31`;

    // Verify class belongs to this teacher
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
        { error: "Access denied. You can only create timetable slots for your own classes." },
        { status: 403 }
      );
    }

    const className = classData.name || `${classData.grade} ${classData.subject}`;
    const grade = classData.grade || "";
    const subject = classData.subject || "";
    const teacherName = classData.teacherName || user!.displayName || "Teacher";

    const slotsCol = adminDb.collection("years").doc(yearId).collection("slots");
    const sessionsCol = adminDb.collection("years").doc(yearId).collection("sessions");
    const newSlotRef = slotsCol.doc();
    const now = new Date().toISOString();

    let generatedSessions: Session[] = [];

    // Clash check inside transaction
    await adminDb.runTransaction(async (transaction) => {
      const existingSlotsSnap = await transaction.get(slotsCol);
      const existingIntervals: TimeInterval[] = [];

      existingSlotsSnap.forEach((doc) => {
        const d = doc.data() as TimetableSlot;
        existingIntervals.push(
          slotToTimeInterval({
            ...d,
            id: doc.id,
          })
        );
      });

      const candidate: TimeInterval = {
        id: newSlotRef.id,
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
        throw new Error(clash.message || "Timetable slot conflicts with existing schedule.");
      }

      generatedSessions = generateSessionsForSlot({
        slotId: newSlotRef.id,
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
      });

      const slotRecord: TimetableSlot = {
        id: newSlotRef.id,
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
        createdAt: now,
        updatedAt: now,
      };

      transaction.set(newSlotRef, slotRecord);

      for (const session of generatedSessions) {
        transaction.set(sessionsCol.doc(session.id), session);
      }
    });

    return NextResponse.json(
      {
        slot: {
          id: newSlotRef.id,
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
        },
        sessionsCount: generatedSessions.length,
        message: "Timetable slot and sessions scheduled successfully.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to create timetable slot." },
      { status: 400 }
    );
  }
}
