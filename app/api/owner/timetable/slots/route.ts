import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { checkClash } from "@/lib/clash";
import {
  CreateSlotSchema,
  generateSessionsForSlot,
  slotToTimeInterval,
} from "@/lib/timetable";
import {
  notifyTeacherTimetableChange,
  notifyOwnerConcurrentGradeSchedule,
} from "@/lib/notifications";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { invalidatePublicSiteDataCache } from "@/lib/public-data";
import type { TimetableSlot, TimeInterval, Session } from "@/types";

/**
 * GET /api/owner/timetable/slots
 * Lists all timetable slots for the selected academic year.
 */
export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    let yearId = searchParams.get("yearId") || cookieYear;

    if (!yearId) {
      const activeYearSnap = await adminDb
        .collection("academicYears")
        .where("status", "==", "active")
        .limit(1)
        .get();
      yearId = !activeYearSnap.empty ? activeYearSnap.docs[0].id : "2026";
    }

    // Fetch slots and classes in parallel
    const [slotsSnap, classesSnap] = await Promise.all([
      adminDb
        .collection("years")
        .doc(yearId)
        .collection("slots")
        .get(),
      adminDb
        .collection("years")
        .doc(yearId)
        .collection("classes")
        .where("active", "==", true)
        .get(),
    ]);

    const classColorMap = new Map<string, string>();
    classesSnap.forEach((doc) => {
      const data = doc.data();
      if (data.color) classColorMap.set(doc.id, data.color);
    });

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
        teacherName: data.teacherName || "Unassigned",
        weekday: data.weekday,
        startTime: data.startTime,
        endTime: data.endTime,
        validFrom: data.validFrom,
        validTo: data.validTo,
        color: data.color || classColorMap.get(data.classId) || undefined,
        isTemporary: data.isTemporary || false,
        slotType: data.slotType || (data.isTemporary ? "extra" : "regular"),
        specificDate: data.specificDate,
        countsForMonth: data.countsForMonth,
        note: data.note,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    // Sort by weekday (0-6) then startTime
    slots.sort((a, b) => {
      if (a.weekday !== b.weekday) return a.weekday - b.weekday;
      return a.startTime.localeCompare(b.startTime);
    });

    const classes = classesSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        grade: data.grade,
        subject: data.subject,
        teacherId: data.teacherId,
        teacherName: data.teacherName,
        color: data.color || undefined,
      };
    });

    classes.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ slots, classes, yearId });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to list slots: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * POST /api/owner/timetable/slots
 * Creates a weekly timetable slot and generates dated sessions inside a Firestore transaction.
 * Enforces clash rules (no teacher overlap, max 3 concurrent rooms).
 */
export async function POST(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    let yearId = body.yearId || cookieYear;

    if (!yearId) {
      const activeYearSnap = await adminDb
        .collection("academicYears")
        .where("status", "==", "active")
        .limit(1)
        .get();
      yearId = !activeYearSnap.empty ? activeYearSnap.docs[0].id : "2026";
    }

    // 1. Validate payload
    const parsed = CreateSlotSchema.safeParse({ ...body, yearId });
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid timetable slot data.";
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const { classId, startTime, endTime, isTemporary, slotType, note } = parsed.data;
    let weekday = parsed.data.weekday;
    let validFrom = parsed.data.validFrom || `${yearId}-01-01`;
    let validTo = parsed.data.validTo || `${yearId}-12-31`;
    let specificDate = parsed.data.specificDate;
    let countsForMonth = parsed.data.countsForMonth;

    if (isTemporary || slotType === "extra") {
      if (!specificDate && parsed.data.validFrom) {
        specificDate = parsed.data.validFrom;
      }
      if (specificDate) {
        validFrom = specificDate;
        validTo = specificDate;
        try {
          const parsedD = new Date(specificDate + "T00:00:00");
          weekday = parsedD.getDay();
        } catch {}
        if (!countsForMonth) {
          countsForMonth = specificDate.substring(0, 7);
        }
      }
    }

    // 2. Fetch Class Details
    const classDoc = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .doc(classId)
      .get();

    if (!classDoc.exists) {
      return NextResponse.json({ error: "The selected class does not exist." }, { status: 404 });
    }

    const classData = classDoc.data()!;
    const className = classData.name || `${classData.grade} ${classData.subject}`;
    const grade = classData.grade || "";
    const subject = classData.subject || "";
    const teacherId = classData.teacherId;
    const teacherName = classData.teacherName || "Teacher";

    if (!teacherId) {
      return NextResponse.json(
        { error: "This class has no assigned teacher. Please assign a teacher first." },
        { status: 400 }
      );
    }

    const slotsCol = adminDb.collection("years").doc(yearId).collection("slots");
    const sessionsCol = adminDb.collection("years").doc(yearId).collection("sessions");
    const newSlotRef = slotsCol.doc();
    const now = new Date().toISOString();

    let generatedSessions: Session[] = [];
    let hasGradeWarning = false;
    let gradeConflictClass: string | undefined = undefined;

    // 3. Run clash check and session generation inside a Firestore transaction
    await adminDb.runTransaction(async (transaction) => {
      // Fetch all existing slots to check for clashes
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

      // Construct proposed interval
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
        date: isTemporary || slotType === "extra" ? specificDate : undefined,
      };

      // Check clash rules
      const clash = checkClash(candidate, existingIntervals);
      if (clash.hasClash) {
        throw new Error(clash.message || "Timetable slot conflicts with existing schedule.");
      }

      if (clash.hasGradeWarning) {
        hasGradeWarning = true;
        gradeConflictClass = clash.gradeConflictClass;
      }

      // Generate dated sessions for the entire validity range
      generatedSessions = generateSessionsForSlot({
        slotId: newSlotRef.id,
        yearId,
        classId,
        className,
        grade,
        subject,
        teacherId,
        teacherName,
        color: classData.color,
        weekday,
        startTime,
        endTime,
        validFrom,
        validTo,
        isTemporary: Boolean(isTemporary || slotType === "extra"),
        countsForMonth,
        note,
      });

      // Write slot record
      const slotRecord: TimetableSlot = {
        id: newSlotRef.id,
        yearId,
        classId,
        className,
        grade,
        subject,
        teacherId,
        teacherName,
        color: classData.color,
        weekday,
        startTime,
        endTime,
        validFrom,
        validTo,
        isTemporary: Boolean(isTemporary || slotType === "extra"),
        slotType: isTemporary || slotType === "extra" ? "extra" : "regular",
        specificDate: isTemporary || slotType === "extra" ? specificDate : undefined,
        countsForMonth: isTemporary || slotType === "extra" ? countsForMonth : undefined,
        note,
        createdAt: now,
        updatedAt: now,
      };

      transaction.set(newSlotRef, slotRecord);

      // Write generated sessions
      for (const session of generatedSessions) {
        const sessionRef = sessionsCol.doc(session.id);
        transaction.set(sessionRef, session);
      }
    });

    invalidatePublicSiteDataCache();

    // 4. Trigger teacher notification hook (Step 10 wired)
    await notifyTeacherTimetableChange({
      teacherId,
      slotId: newSlotRef.id,
      action: "created",
      className,
      weekday,
      startTime,
      endTime,
      yearId,
    });

    // 5. Notify owner if same grade scheduled concurrently
    if (hasGradeWarning) {
      try {
        await notifyOwnerConcurrentGradeSchedule({
          grade,
          classNameA: className,
          classNameB: gradeConflictClass || "Another class",
          weekday,
          startTime,
          endTime,
          yearId,
        });
      } catch (err) {
        console.error("Non-fatal owner concurrent grade notification error:", err);
      }
    }

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
          color: classData.color,
          weekday,
          startTime,
          endTime,
          validFrom,
          validTo,
          isTemporary: Boolean(isTemporary || slotType === "extra"),
          slotType: isTemporary || slotType === "extra" ? "extra" : "regular",
          specificDate: isTemporary || slotType === "extra" ? specificDate : undefined,
          countsForMonth: isTemporary || slotType === "extra" ? countsForMonth : undefined,
          note,
          createdAt: now,
        },
        sessionsCount: generatedSessions.length,
        hasGradeWarning,
        message: hasGradeWarning
          ? `Slot added with concurrent ${grade} schedule alert. Owner notified.`
          : "Timetable slot created and sessions scheduled successfully.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    // Return clash conflict or error as plain sentence 400
    return NextResponse.json(
      { error: error?.message || "Failed to create timetable slot." },
      { status: 400 }
    );
  }
}
