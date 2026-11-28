import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import {
  CreateClassSchema,
  generateClassName,
  checkDuplicateClass,
  calculateOwnerShare,
  validateClassTerms,
} from "@/lib/classes";
import { checkClash, doIntervalsOverlap } from "@/lib/clash";
import {
  generateSessionsForSlot,
  slotToTimeInterval,
} from "@/lib/timetable";
import {
  notifyTeacherTimetableChange,
  notifyOwnerConcurrentGradeSchedule,
} from "@/lib/notifications";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { invalidatePublicSiteDataCache } from "@/lib/public-data";
import { getAvailableClassColor, getUsedClassColors } from "@/lib/class-colors";
import type { ClassItem, TimetableSlot, TimeInterval, Session } from "@/types";

/**
 * GET /api/owner/classes
 * Lists all classes for the active academic year with student counts and all timetable slots.
 */
export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    // 1. Fetch all slots and classes for this academic year in parallel
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
        .get(),
    ]);

    const slotsByClassId = new Map<string, TimetableSlot[]>();
    slotsSnap.docs.forEach((doc) => {
      const data = doc.data() as TimetableSlot;
      const item: TimetableSlot = {
        ...data,
        id: doc.id,
      };
      const list = slotsByClassId.get(data.classId) || [];
      list.push(item);
      slotsByClassId.set(data.classId, list);
    });

    // 2. Build class records with enrolment counts in parallel
    const classes: ClassItem[] = await Promise.all(
      classesSnap.docs.map(async (doc) => {
        const data = doc.data();

        // Count enrolled students in parallel
        const enrolmentsSnap = await doc.ref.collection("enrolments").get();
        const studentCount = enrolmentsSnap.size;

        const monthlyFee = data.currentTerms?.monthlyFee ?? 0;
        const teacherShare = data.currentTerms?.teacherSharePerStudent ?? 0;

        const classSlots = slotsByClassId.get(doc.id) || [];
        // Sort slots by Monday-first weekday order (1..6 then 0) then startTime
        classSlots.sort((a, b) => {
          const orderA = a.weekday === 0 ? 7 : a.weekday;
          const orderB = b.weekday === 0 ? 7 : b.weekday;
          if (orderA !== orderB) return orderA - orderB;
          return a.startTime.localeCompare(b.startTime);
        });

        return {
          id: doc.id,
          yearId,
          grade: data.grade || "",
          subject: data.subject || "",
          teacherId: data.teacherId || "",
          teacherName: data.teacherName || "Unassigned",
          isMultiTeacher: Boolean(data.isMultiTeacher),
          teachers: data.teachers || [],
          teacherIds: data.teacherIds || (data.teacherId ? [data.teacherId] : []),
          name: data.name || `${data.grade} ${data.subject}`,
          color: data.color || undefined,
          currentTerms: {
            monthlyFee,
            teacherSharePerStudent: teacherShare,
            ownerShare: calculateOwnerShare(monthlyFee, teacherShare),
            requiredSessionsPerMonth: data.currentTerms?.requiredSessionsPerMonth ?? 8,
            effectiveFromMonth: data.currentTerms?.effectiveFromMonth ?? `${yearId}-01`,
          },
          termsHistory: data.termsHistory || [],
          enrolledStudentCount: studentCount,
          active: data.active !== false,
          slot: classSlots[0],
          slots: classSlots,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt,
        };
      })
    );

    // Sort by name
    classes.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ classes, yearId });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to list classes: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * POST /api/owner/classes
 * Creates a class and optionally one or multiple weekly timetable sessions:
 * 1. Checks duplicate grade + subject in the same year (refuses duplicates)
 * 2. Validates terms (refuses teacher share > monthly fee)
 * 3. Auto-generates class name (e.g. "Grade 10 Maths")
 * 4. Resolves teacher name
 * 5. Saves class and initial terms record
 * 6. If schedule(s) provided: checks timetable clashes for all sessions, creates slots in
 *    years/{yearId}/slots, generates dated sessions in years/{yearId}/sessions, and notifies teacher!
 */
export async function POST(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const body = await request.json();
    const parsed = CreateClassSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid class data.";
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const { yearId, grade, subject, teacherId, terms } = parsed.data;
    const rawSchedules = parsed.data.schedules ?? (parsed.data.schedule ? [parsed.data.schedule] : []);

    // 1. Term validation
    const termValidation = validateClassTerms(terms.monthlyFee, terms.teacherSharePerStudent);
    if (!termValidation.valid) {
      return NextResponse.json({ error: termValidation.error }, { status: 400 });
    }

    // 2. Uniqueness check in current year
    const existingSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .get();

    const existingClasses = existingSnap.docs.map((d) => ({
      id: d.id,
      grade: d.data().grade as string,
      subject: d.data().subject as string,
      teacherId: d.data().teacherId as string,
      teacherName: d.data().teacherName as string,
      color: d.data().color as string | undefined,
    }));

    const classTeacherMap = new Map<string, { teacherId: string; teacherName: string }>();
    existingSnap.forEach((doc) => {
      const d = doc.data();
      classTeacherMap.set(doc.id, {
        teacherId: (d.teacherId || "").trim(),
        teacherName: d.teacherName || "",
      });
    });

    const dupCheck = checkDuplicateClass(existingClasses, grade, subject, undefined, teacherId);
    if (dupCheck.isDuplicate) {
      return NextResponse.json({ error: dupCheck.error }, { status: 400 });
    }

    // 3. Resolve teacher names (handles both single teacher and multi-teacher co-teaching)
    const isMultiTeacher = Boolean(parsed.data.isMultiTeacher && parsed.data.teachers && parsed.data.teachers.length >= 2);
    let teacherName = "Unassigned";
    let resolvedTeachers: Array<{ teacherId: string; teacherName: string; splitPercentage: number; role?: "primary" | "co_teacher" }> = [];
    let resolvedTeacherIds: string[] = [];

    if (isMultiTeacher && parsed.data.teachers) {
      const teacherDocs = await Promise.all(
        parsed.data.teachers.map((t) => adminDb.collection("teachers").doc(t.teacherId).get())
      );
      resolvedTeachers = parsed.data.teachers.map((t, idx) => {
        const doc = teacherDocs[idx];
        const tName = doc.exists ? doc.data()?.name || "Teacher" : t.teacherName || "Teacher";
        return {
          teacherId: t.teacherId,
          teacherName: tName,
          splitPercentage: t.splitPercentage,
          role: idx === 0 || t.role === "primary" ? "primary" : "co_teacher",
        };
      });
      resolvedTeacherIds = resolvedTeachers.map((t) => t.teacherId);
      const primary = resolvedTeachers.find((t) => t.role === "primary") || resolvedTeachers[0];
      teacherName = resolvedTeachers.map((t) => t.teacherName).join(" & ");
    } else {
      const teacherDoc = await adminDb.collection("teachers").doc(teacherId).get();
      if (teacherDoc.exists) {
        teacherName = teacherDoc.data()?.name || "Teacher";
      }
      resolvedTeachers = [
        {
          teacherId,
          teacherName,
          splitPercentage: 100,
          role: "primary",
        },
      ];
      resolvedTeacherIds = [teacherId];
    }

    // 4. Generate name and timestamps
    const name = generateClassName(grade, subject);
    const now = new Date().toISOString();
    const ownerShare = calculateOwnerShare(terms.monthlyFee, terms.teacherSharePerStudent);

    // 4.1 Resolve non-repeating class color theme
    const usedColors = getUsedClassColors(existingClasses);
    let resolvedColor = (parsed.data.color || "").trim().toLowerCase();
    // If color is not specified or already in use, auto-select the next available color
    if (!resolvedColor || (usedColors.has(resolvedColor) && usedColors.size < 12)) {
      resolvedColor = getAvailableClassColor(existingClasses, { grade, subject, name });
    }

    const initialTerm = {
      monthlyFee: terms.monthlyFee,
      teacherSharePerStudent: terms.teacherSharePerStudent,
      ownerShare,
      requiredSessionsPerMonth: terms.requiredSessionsPerMonth,
      effectiveFromMonth: terms.effectiveFromMonth,
      createdAt: now,
    };

    const newClassRef = adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .doc();

    const classId = newClassRef.id;

    // 5. Timetable Schedule validation & clash checking (for all proposed weekly sessions)
    const slotsCol = adminDb.collection("years").doc(yearId).collection("slots");
    const sessionsCol = adminDb.collection("years").doc(yearId).collection("sessions");

    // Intra-schedule overlap check
    for (let i = 0; i < rawSchedules.length; i++) {
      for (let j = i + 1; j < rawSchedules.length; j++) {
        const a = rawSchedules[i];
        const b = rawSchedules[j];
        if (
          Number(a.weekday) === Number(b.weekday) &&
          doIntervalsOverlap(a.startTime, a.endTime, b.startTime, b.endTime)
        ) {
          return NextResponse.json(
            { error: `Proposed schedules have overlapping times on the same day.` },
            { status: 400 }
          );
        }
      }
    }

    const existingSlotsSnap = await slotsCol.get();
    const existingIntervals: TimeInterval[] = [];

    existingSlotsSnap.forEach((doc) => {
      const d = doc.data() as TimetableSlot;
      const classInfo = classTeacherMap.get(d.classId);
      existingIntervals.push(
        slotToTimeInterval({
          ...d,
          id: doc.id,
          teacherId: d.teacherId?.trim() || classInfo?.teacherId || "",
          teacherName: d.teacherName || classInfo?.teacherName || "",
        })
      );
    });

    const accumulatedIntervals = [...existingIntervals];
    const createdSlots: TimetableSlot[] = [];
    const allGeneratedSessions: Session[] = [];
    const gradeWarnings: Array<{
      grade: string;
      classNameA: string;
      classNameB: string;
      weekday: number;
      startTime: string;
      endTime: string;
    }> = [];

    for (const sch of rawSchedules) {
      const validFrom = sch.validFrom || `${yearId}-01-01`;
      const validTo = sch.validTo || `${yearId}-12-31`;
      const slotRef = slotsCol.doc();

      const schTeacherId = sch.teacherId || teacherId;
      const schTeacherIds = sch.teacherIds && sch.teacherIds.length > 0 ? sch.teacherIds : resolvedTeacherIds;

      const candidate: TimeInterval = {
        id: slotRef.id,
        classId,
        className: name,
        grade,
        teacherId: schTeacherId,
        teacherName,
        teacherIds: schTeacherIds,
        teachers: resolvedTeachers,
        color: parsed.data.color || undefined,
        weekday: sch.weekday,
        startTime: sch.startTime,
        endTime: sch.endTime,
      };

      const clash = checkClash(candidate, accumulatedIntervals);
      if (clash.hasClash) {
        return NextResponse.json(
          { error: clash.message || "Timetable schedule conflicts with an existing class." },
          { status: 400 }
        );
      }

      if (clash.hasGradeWarning) {
        gradeWarnings.push({
          grade,
          classNameA: name,
          classNameB: clash.gradeConflictClass || "Another class",
          weekday: sch.weekday,
          startTime: sch.startTime,
          endTime: sch.endTime,
        });
      }

      accumulatedIntervals.push(candidate);

      const slotRecord: TimetableSlot = {
        id: slotRef.id,
        yearId,
        classId,
        className: name,
        grade,
        subject,
        teacherId: schTeacherId,
        teacherName,
        isMultiTeacher,
        teachers: resolvedTeachers,
        teacherIds: schTeacherIds,
        color: resolvedColor || undefined,
        weekday: sch.weekday,
        startTime: sch.startTime,
        endTime: sch.endTime,
        validFrom,
        validTo,
        createdAt: now,
        updatedAt: now,
      };

      createdSlots.push(slotRecord);

      const sessions = generateSessionsForSlot({
        slotId: slotRef.id,
        yearId,
        classId,
        className: name,
        grade,
        subject,
        teacherId: schTeacherId,
        teacherName,
        isMultiTeacher,
        teachers: resolvedTeachers,
        teacherIds: schTeacherIds,
        color: resolvedColor || undefined,
        weekday: sch.weekday,
        startTime: sch.startTime,
        endTime: sch.endTime,
        validFrom,
        validTo,
      });

      allGeneratedSessions.push(...sessions);
    }

    // 6. Write class and initial terms
    const classData = {
      id: classId,
      yearId,
      grade,
      subject,
      teacherId,
      teacherName,
      isMultiTeacher,
      teachers: resolvedTeachers,
      teacherIds: resolvedTeacherIds,
      name,
      color: resolvedColor || undefined,
      currentTerms: initialTerm,
      termsHistory: [initialTerm],
      active: true,
      createdAt: now,
      updatedAt: now,
    };

    await newClassRef.set(classData);
    await newClassRef.collection("terms").add(initialTerm);

    // 7. Write slots and sessions
    if (createdSlots.length > 0) {
      for (const slot of createdSlots) {
        await slotsCol.doc(slot.id).set(slot);
      }

      // Batch save sessions in chunks of up to 450
      const batchSize = 450;
      for (let i = 0; i < allGeneratedSessions.length; i += batchSize) {
        const batch = adminDb.batch();
        const chunk = allGeneratedSessions.slice(i, i + batchSize);
        for (const session of chunk) {
          batch.set(sessionsCol.doc(session.id), session);
        }
        await batch.commit();
      }

      // Notify all assigned teachers for each created slot
      for (const slot of createdSlots) {
        const teachersToNotify = slot.teacherIds && slot.teacherIds.length > 0 ? slot.teacherIds : [slot.teacherId];
        for (const tId of teachersToNotify) {
          try {
            await notifyTeacherTimetableChange({
              teacherId: tId,
              slotId: slot.id,
              action: "created",
              className: name,
              weekday: slot.weekday,
              startTime: slot.startTime,
              endTime: slot.endTime,
              yearId,
            });
          } catch (err) {
            console.error("Non-fatal teacher timetable notification error:", err);
          }
        }
      }

      // Notify owner for any concurrent same-grade class schedules with push notification
      for (const gw of gradeWarnings) {
        try {
          await notifyOwnerConcurrentGradeSchedule({
            grade: gw.grade,
            classNameA: gw.classNameA,
            classNameB: gw.classNameB,
            weekday: gw.weekday,
            startTime: gw.startTime,
            endTime: gw.endTime,
            yearId,
          });
        } catch (err) {
          console.error("Non-fatal owner concurrent grade notification error:", err);
        }
      }
    }

    invalidatePublicSiteDataCache();

    return NextResponse.json(
      {
        classItem: {
          ...classData,
          enrolledStudentCount: 0,
          slot: createdSlots[0],
          slots: createdSlots,
        },
        sessionsCount: allGeneratedSessions.length,
        hasGradeOverlap: gradeWarnings.length > 0,
        gradeWarnings,
        message:
          gradeWarnings.length > 0
            ? `Class created with ${createdSlots.length} session(s). Concurrent ${grade} schedule alert dispatched to owner.`
            : createdSlots.length > 0
            ? `Class created with ${createdSlots.length} weekly session(s) (${allGeneratedSessions.length} total).`
            : "Class created successfully.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create class: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
