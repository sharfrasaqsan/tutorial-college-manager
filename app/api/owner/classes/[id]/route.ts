import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import {
  UpdateClassSchema,
  generateClassName,
  checkDuplicateClass,
  calculateOwnerShare,
  validateClassTerms,
  findEffectiveTermsForMonth,
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
import { getCurrentMonthKey, getColomboNow } from "@/lib/dates";
import { invalidatePublicSiteDataCache } from "@/lib/public-data";
import { format } from "date-fns";
import type { ClassItem, ClassTerms, ClassEnrolment, TimetableSlot, TimeInterval, Session } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/owner/classes/[id]
 * Returns class details, terms history, enrolled students list,
 * all timetable slots, and current month session progress.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    const classRef = adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .doc(id);

    const classDoc = await classRef.get();
    if (!classDoc.exists) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    const data = classDoc.data()!;

    // Fetch terms, enrolments, current month sessions, and slots in parallel
    const currentMonth = getCurrentMonthKey();
    const [termsSnap, enrolmentsSnap, currentMonthSessionsSnap, slotsSnap] = await Promise.all([
      classRef.collection("terms").get(),
      classRef.collection("enrolments").get(),
      adminDb
        .collection("years")
        .doc(yearId)
        .collection("sessions")
        .where("classId", "==", id)
        .where("countsForMonth", "==", currentMonth)
        .get(),
      adminDb
        .collection("years")
        .doc(yearId)
        .collection("slots")
        .where("classId", "==", id)
        .get(),
    ]);

    // 1. Process terms history
    let termsHistory: ClassTerms[] = [];
    if (!termsSnap.empty) {
      termsSnap.forEach((d) => {
        const t = d.data();
        termsHistory.push({
          id: d.id,
          effectiveFromMonth: t.effectiveFromMonth,
          monthlyFee: t.monthlyFee,
          teacherSharePerStudent: t.teacherSharePerStudent,
          ownerShare: calculateOwnerShare(t.monthlyFee, t.teacherSharePerStudent),
          requiredSessionsPerMonth: t.requiredSessionsPerMonth ?? 8,
          createdAt: t.createdAt,
        });
      });
    } else if (Array.isArray(data.termsHistory) && data.termsHistory.length > 0) {
      termsHistory = data.termsHistory;
    } else {
      termsHistory = [data.currentTerms];
    }
    termsHistory.sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth));

    // 2. Process enrolled students
    const enrolledStudents: ClassEnrolment[] = [];
    enrolmentsSnap.forEach((d) => {
      const e = d.data();
      enrolledStudents.push({
        id: d.id,
        studentId: e.studentId || d.id,
        classId: classDoc.id,
        yearId,
        studentName: e.studentName || "",
        studentSchool: e.studentSchool || "",
        studentGrade: e.studentGrade || "",
        joinedMonth: e.joinedMonth || `${yearId}-01`,
        enrolledAt: e.enrolledAt || new Date().toISOString(),
      });
    });
    enrolledStudents.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || ""));

    // 3. Current active terms
    const effectiveTerms = findEffectiveTermsForMonth(termsHistory, currentMonth);

    // 4. Session progress for current month
    let heldSessionsCount = 0;
    currentMonthSessionsSnap.forEach((s) => {
      if (s.data().status === "held") heldSessionsCount++;
    });

    const sessionProgress = {
      month: currentMonth,
      heldSessions: heldSessionsCount,
      requiredSessions: effectiveTerms.requiredSessionsPerMonth,
      status: heldSessionsCount >= effectiveTerms.requiredSessionsPerMonth ? "completed" : "in_progress",
    };

    // 5. Associated timetable slots
    const slots: TimetableSlot[] = [];
    slotsSnap.forEach((doc) => {
      slots.push({
        ...(doc.data() as TimetableSlot),
        id: doc.id,
      });
    });

    // Sort by Monday-first weekday order (1..6 then 0)
    slots.sort((a, b) => {
      const orderA = a.weekday === 0 ? 7 : a.weekday;
      const orderB = b.weekday === 0 ? 7 : b.weekday;
      if (orderA !== orderB) return orderA - orderB;
      return a.startTime.localeCompare(b.startTime);
    });

    const classItem: ClassItem = {
      id: classDoc.id,
      yearId,
      grade: data.grade,
      subject: data.subject,
      teacherId: data.teacherId,
      teacherName: data.teacherName,
      isMultiTeacher: Boolean(data.isMultiTeacher),
      teachers: data.teachers || [],
      teacherIds: data.teacherIds || (data.teacherId ? [data.teacherId] : []),
      name: data.name,
      color: data.color || undefined,
      currentTerms: effectiveTerms,
      termsHistory,
      enrolledStudentCount: enrolledStudents.length,
      active: data.active !== false,
      slot: slots[0],
      slots,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };

    return NextResponse.json({
      classItem,
      enrolledStudents,
      sessionProgress,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch class details: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/owner/classes/[id]
 * Updates class information, terms, and/or weekly timetable schedules.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const body = await request.json();
    const yearId = body.yearId || searchParams.get("yearId") || cookieYear || "2026";

    const parsed = UpdateClassSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid update data.";
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const classRef = adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .doc(id);

    const classDoc = await classRef.get();
    if (!classDoc.exists) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    const existingClass = classDoc.data()!;
    const now = new Date().toISOString();
    const todayStr = format(getColomboNow(), "yyyy-MM-dd");

    const newGrade = parsed.data.grade ?? existingClass.grade;
    const newSubject = parsed.data.subject ?? existingClass.subject;
    let newTeacherId = parsed.data.teacherId ?? existingClass.teacherId;
    let newTeacherName = existingClass.teacherName || "Unassigned";

    // 1. If grade or subject changed, verify uniqueness
    if (newGrade !== existingClass.grade || newSubject !== existingClass.subject) {
      const allOtherClassesSnap = await adminDb
        .collection("years")
        .doc(yearId)
        .collection("classes")
        .get();

      const existingClasses = allOtherClassesSnap.docs
        .filter((d) => d.id !== id)
        .map((d) => ({
          id: d.id,
          grade: d.data().grade as string,
          subject: d.data().subject as string,
          teacherId: d.data().teacherId as string,
          teacherName: d.data().teacherName as string,
        }));

      const dupCheck = checkDuplicateClass(existingClasses, newGrade, newSubject, id, newTeacherId);
      if (dupCheck.isDuplicate) {
        return NextResponse.json({ error: dupCheck.error }, { status: 400 });
      }
    }

    // 2. Resolve teacher(s) and multi-teacher settings
    let isMultiTeacher = existingClass.isMultiTeacher;
    if (parsed.data.isMultiTeacher !== undefined) {
      isMultiTeacher = parsed.data.isMultiTeacher;
    }

    let resolvedTeachers = existingClass.teachers || [];
    let resolvedTeacherIds = existingClass.teacherIds || (existingClass.teacherId ? [existingClass.teacherId] : []);

    if (isMultiTeacher && parsed.data.teachers && parsed.data.teachers.length >= 2) {
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
      resolvedTeacherIds = resolvedTeachers.map((t: any) => t.teacherId);
      const primary = resolvedTeachers.find((t: any) => t.role === "primary") || resolvedTeachers[0];
      newTeacherId = primary.teacherId;
      newTeacherName = resolvedTeachers.map((t: any) => t.teacherName).join(" & ");
    } else if (newTeacherId !== existingClass.teacherId || !isMultiTeacher) {
      if (newTeacherId) {
        const teacherDoc = await adminDb.collection("teachers").doc(newTeacherId).get();
        newTeacherName = teacherDoc.exists ? teacherDoc.data()?.name || "Teacher" : "Unassigned";
      } else {
        newTeacherName = "Unassigned";
      }
      resolvedTeachers = [
        {
          teacherId: newTeacherId,
          teacherName: newTeacherName,
          splitPercentage: 100,
          role: "primary",
        },
      ];
      resolvedTeacherIds = [newTeacherId];
    }

    const newClassName = generateClassName(newGrade, newSubject);

    // 3. Handle Terms update if provided
    let updatedTerms = existingClass.currentTerms;
    if (parsed.data.terms) {
      const termValidation = validateClassTerms(
        parsed.data.terms.monthlyFee,
        parsed.data.terms.teacherSharePerStudent
      );
      if (!termValidation.valid) {
        return NextResponse.json({ error: termValidation.error }, { status: 400 });
      }

      const ownerShare = calculateOwnerShare(
        parsed.data.terms.monthlyFee,
        parsed.data.terms.teacherSharePerStudent
      );

      updatedTerms = {
        monthlyFee: parsed.data.terms.monthlyFee,
        teacherSharePerStudent: parsed.data.terms.teacherSharePerStudent,
        ownerShare,
        requiredSessionsPerMonth: parsed.data.terms.requiredSessionsPerMonth,
        effectiveFromMonth: parsed.data.terms.effectiveFromMonth,
        createdAt: now,
      };

      await classRef.collection("terms").add(updatedTerms);
    }

    // 4. Update class document
    const updatedClassFields: Record<string, any> = {
      grade: newGrade,
      subject: newSubject,
      name: newClassName,
      teacherId: newTeacherId,
      teacherName: newTeacherName,
      isMultiTeacher: Boolean(isMultiTeacher),
      teachers: resolvedTeachers,
      teacherIds: resolvedTeacherIds,
      updatedAt: now,
    };

    if (parsed.data.active !== undefined) {
      updatedClassFields.active = parsed.data.active;
    }

    if (parsed.data.color !== undefined) {
      updatedClassFields.color = parsed.data.color;
    }

    if (parsed.data.terms) {
      updatedClassFields.currentTerms = updatedTerms;
      const history = Array.isArray(existingClass.termsHistory) ? existingClass.termsHistory : [];
      updatedClassFields.termsHistory = [updatedTerms, ...history];
    }

    await classRef.update(updatedClassFields);

    // 5. Timetable Slots and Sessions Synchronization
    const slotsCol = adminDb.collection("years").doc(yearId).collection("slots");
    const sessionsCol = adminDb.collection("years").doc(yearId).collection("sessions");

    const existingSlotsSnap = await slotsCol.where("classId", "==", id).get();
    const existingSlotMap = new Map<string, TimetableSlot>();
    existingSlotsSnap.forEach((doc) => {
      existingSlotMap.set(doc.id, {
        ...(doc.data() as TimetableSlot),
        id: doc.id,
      });
    });

    const rawSchedules = parsed.data.schedules ?? (parsed.data.schedule ? [parsed.data.schedule] : undefined);
    const finalSlots: TimetableSlot[] = [];
    const gradeWarnings: Array<{
      grade: string;
      classNameA: string;
      classNameB: string;
      weekday: number;
      startTime: string;
      endTime: string;
    }> = [];

    if (rawSchedules !== undefined) {
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

      // Fetch all classes to build teacher map for accurate clash detection
      const allClassesSnap = await adminDb
        .collection("years")
        .doc(yearId)
        .collection("classes")
        .get();

      const classTeacherMap = new Map<string, { teacherId: string; teacherName: string }>();
      allClassesSnap.forEach((doc) => {
        const d = doc.data();
        classTeacherMap.set(doc.id, {
          teacherId: (d.teacherId || "").trim(),
          teacherName: d.teacherName || "",
        });
      });

      // Fetch all slots from other classes for clash detection
      const allSlotsSnap = await slotsCol.get();
      const otherIntervals: TimeInterval[] = [];

      allSlotsSnap.forEach((doc) => {
        if (!existingSlotMap.has(doc.id)) {
          const d = doc.data() as TimetableSlot;
          const classInfo = classTeacherMap.get(d.classId);
          otherIntervals.push(
            slotToTimeInterval({
              ...d,
              id: doc.id,
              teacherId: d.teacherId?.trim() || classInfo?.teacherId || "",
              teacherName: d.teacherName || classInfo?.teacherName || "",
            })
          );
        }
      });

      const accumulatedIntervals = [...otherIntervals];

      // Validate each proposed schedule
      for (const sch of rawSchedules) {
        const slotId = sch.id || slotsCol.doc().id;
        const schTeacherId = sch.teacherId || newTeacherId;
        const schTeacherIds = sch.teacherIds && sch.teacherIds.length > 0 ? sch.teacherIds : resolvedTeacherIds;

        const candidate: TimeInterval = {
          id: slotId,
          classId: id,
          className: newClassName,
          grade: newGrade,
          teacherId: schTeacherId,
          teacherName: newTeacherName,
          teacherIds: schTeacherIds,
          teachers: resolvedTeachers,
          color: updatedClassFields.color ?? existingClass.color ?? undefined,
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
            grade: newGrade,
            classNameA: newClassName,
            classNameB: clash.gradeConflictClass || "Another class",
            weekday: sch.weekday,
            startTime: sch.startTime,
            endTime: sch.endTime,
          });
        }

        accumulatedIntervals.push(candidate);
      }

      // Track kept slot IDs
      const keptSlotIds = new Set<string>();

      // Apply updates and creations
      for (const sch of rawSchedules) {
        const validFrom = sch.validFrom || `${yearId}-01-01`;
        const validTo = sch.validTo || `${yearId}-12-31`;
        const existingSlot = sch.id ? existingSlotMap.get(sch.id) : undefined;
        const slotId = existingSlot ? existingSlot.id : slotsCol.doc().id;
        keptSlotIds.add(slotId);

        const schTeacherId = sch.teacherId || newTeacherId;
        const schTeacherIds = sch.teacherIds && sch.teacherIds.length > 0 ? sch.teacherIds : resolvedTeacherIds;

        const slotRecord: TimetableSlot = {
          id: slotId,
          yearId,
          classId: id,
          className: newClassName,
          grade: newGrade,
          subject: newSubject,
          teacherId: schTeacherId,
          teacherName: newTeacherName,
          isMultiTeacher,
          teachers: resolvedTeachers,
          teacherIds: schTeacherIds,
          color: updatedClassFields.color ?? existingClass.color ?? undefined,
          weekday: sch.weekday,
          startTime: sch.startTime,
          endTime: sch.endTime,
          validFrom,
          validTo,
          createdAt: existingSlot?.createdAt || now,
          updatedAt: now,
        };

        await slotsCol.doc(slotId).set(slotRecord);
        finalSlots.push(slotRecord);

        // Update or generate sessions for this slot
        if (existingSlot) {
          const isDayOrRangeChanged =
            existingSlot.weekday !== sch.weekday ||
            existingSlot.validFrom !== validFrom ||
            existingSlot.validTo !== validTo;

          const existingSessionsSnap = await sessionsCol.where("slotId", "==", slotId).get();

          if (isDayOrRangeChanged) {
            // Delete future scheduled sessions
            const batch = adminDb.batch();
            existingSessionsSnap.forEach((sDoc) => {
              const s = sDoc.data();
              if (s.date >= todayStr && s.status === "scheduled") {
                batch.delete(sDoc.ref);
              }
            });
            await batch.commit();

            // Regenerate future sessions
            const startFrom = validFrom > todayStr ? validFrom : todayStr;
            if (startFrom <= validTo) {
              const newSessions = generateSessionsForSlot({
                slotId,
                yearId,
                classId: id,
                className: newClassName,
                grade: newGrade,
                subject: newSubject,
                teacherId: schTeacherId,
                teacherName: newTeacherName,
                isMultiTeacher,
                teachers: resolvedTeachers,
                teacherIds: schTeacherIds,
                weekday: sch.weekday,
                startTime: sch.startTime,
                endTime: sch.endTime,
                validFrom: startFrom,
                validTo,
              });

              const batchSize = 450;
              for (let i = 0; i < newSessions.length; i += batchSize) {
                const sessBatch = adminDb.batch();
                const chunk = newSessions.slice(i, i + batchSize);
                for (const session of chunk) {
                  sessBatch.set(sessionsCol.doc(session.id), session);
                }
                await sessBatch.commit();
              }
            }
          } else {
            // Only times or teacher changed: update future scheduled sessions
            const batch = adminDb.batch();
            existingSessionsSnap.forEach((sDoc) => {
              const s = sDoc.data();
              if (s.date >= todayStr && s.status === "scheduled") {
                batch.update(sDoc.ref, {
                  startTime: sch.startTime,
                  endTime: sch.endTime,
                  teacherId: schTeacherId,
                  teacherName: newTeacherName,
                  isMultiTeacher,
                  teachers: resolvedTeachers,
                  teacherIds: schTeacherIds,
                  className: newClassName,
                  grade: newGrade,
                  subject: newSubject,
                  updatedAt: now,
                });
              }
            });
            await batch.commit();
          }

          for (const tId of schTeacherIds) {
            try {
              await notifyTeacherTimetableChange({
                teacherId: tId,
                slotId,
                action: "updated",
                className: newClassName,
                weekday: sch.weekday,
                startTime: sch.startTime,
                endTime: sch.endTime,
                yearId,
              });
            } catch {}
          }
        } else {
          // Brand new slot added: generate sessions
          const startFrom = validFrom > todayStr ? validFrom : todayStr;
          if (startFrom <= validTo) {
            const newSessions = generateSessionsForSlot({
              slotId,
              yearId,
              classId: id,
              className: newClassName,
              grade: newGrade,
              subject: newSubject,
              teacherId: schTeacherId,
              teacherName: newTeacherName,
              isMultiTeacher,
              teachers: resolvedTeachers,
              teacherIds: schTeacherIds,
              weekday: sch.weekday,
              startTime: sch.startTime,
              endTime: sch.endTime,
              validFrom: startFrom,
              validTo,
            });

            const batchSize = 450;
            for (let i = 0; i < newSessions.length; i += batchSize) {
              const sessBatch = adminDb.batch();
              const chunk = newSessions.slice(i, i + batchSize);
              for (const session of chunk) {
                sessBatch.set(sessionsCol.doc(session.id), session);
              }
              await sessBatch.commit();
            }
          }

          for (const tId of schTeacherIds) {
            try {
              await notifyTeacherTimetableChange({
                teacherId: tId,
                slotId,
                action: "created",
                className: newClassName,
                weekday: sch.weekday,
                startTime: sch.startTime,
                endTime: sch.endTime,
                yearId,
              });
            } catch {}
          }
        }
      }

      // Remove any existing slots that were omitted by the user
      for (const [oldId, oldSlot] of existingSlotMap.entries()) {
        if (!keptSlotIds.has(oldId)) {
          await slotsCol.doc(oldId).delete();

          const oldSessionsSnap = await sessionsCol.where("slotId", "==", oldId).get();
          const batch = adminDb.batch();
          oldSessionsSnap.forEach((sDoc) => {
            const s = sDoc.data();
            if (s.date >= todayStr && s.status === "scheduled") {
              batch.delete(sDoc.ref);
            }
          });
          await batch.commit();

          if (oldSlot.teacherId) {
            try {
              await notifyTeacherTimetableChange({
                teacherId: oldSlot.teacherId,
                slotId: oldId,
                action: "deleted",
                className: oldSlot.className || newClassName,
                weekday: oldSlot.weekday,
                startTime: oldSlot.startTime,
                endTime: oldSlot.endTime,
                yearId,
              });
            } catch {}
          }
        }
      }
    } else {
      // Schedules were not modified in request, but class name/teacher/grade may have changed
      for (const [slotId, slot] of existingSlotMap.entries()) {
        const slotUpdate = {
          className: newClassName,
          grade: newGrade,
          subject: newSubject,
          teacherId: newTeacherId,
          teacherName: newTeacherName,
          color: updatedClassFields.color ?? existingClass.color ?? undefined,
          updatedAt: now,
        };
        await slotsCol.doc(slotId).update(slotUpdate);
        finalSlots.push({ ...slot, ...slotUpdate });

        const futureSessionsSnap = await sessionsCol
          .where("slotId", "==", slotId)
          .where("status", "==", "scheduled")
          .get();

        if (!futureSessionsSnap.empty) {
          const batch = adminDb.batch();
          futureSessionsSnap.forEach((sDoc) => {
            if (sDoc.data().date >= todayStr) {
              batch.update(sDoc.ref, {
                className: newClassName,
                grade: newGrade,
                subject: newSubject,
                teacherId: newTeacherId,
                teacherName: newTeacherName,
                updatedAt: now,
              });
            }
          });
          await batch.commit();
        }
      }
    }

    // Sort final slots by Monday-first weekday order
    finalSlots.sort((a, b) => {
      const orderA = a.weekday === 0 ? 7 : a.weekday;
      const orderB = b.weekday === 0 ? 7 : b.weekday;
      if (orderA !== orderB) return orderA - orderB;
      return a.startTime.localeCompare(b.startTime);
    });

    // Notify owner for any concurrent same-grade class schedules
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

    invalidatePublicSiteDataCache();
    return NextResponse.json({
      classItem: {
        ...existingClass,
        ...updatedClassFields,
        slot: finalSlots[0],
        slots: finalSlots,
      },
      hasGradeOverlap: gradeWarnings.length > 0,
      gradeWarnings,
      message:
        gradeWarnings.length > 0
          ? `Class updated. Concurrent ${newGrade} schedule alert dispatched to owner.`
          : "Class updated successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update class: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/owner/classes/[id]
 * Deletes or safely archives a class and all its timetable slots:
 * - If class has historical held sessions or paid fees: archives (active: false), deletes
 *   active slots from timetable, and deletes future scheduled sessions. Historical records remain frozen.
 * - If class has no history (clean): completely removes class, terms, enrolments, slots, and scheduled sessions.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    const classRef = adminDb
      .collection("years")
      .doc(yearId)
      .collection("classes")
      .doc(id);

    const classDoc = await classRef.get();
    if (!classDoc.exists) {
      return NextResponse.json({ error: "Class not found." }, { status: 404 });
    }

    const classData = classDoc.data()!;
    const todayStr = format(getColomboNow(), "yyyy-MM-dd");

    // 1. Check for historical held sessions
    const heldSessionsSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("sessions")
      .where("classId", "==", id)
      .where("status", "==", "held")
      .limit(1)
      .get();

    const hasHeldSessions = !heldSessionsSnap.empty;

    // 2. Check for paid fees
    const paidFeesSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("fees")
      .where("classId", "==", id)
      .where("status", "==", "paid")
      .limit(1)
      .get();

    const hasPaidFees = !paidFeesSnap.empty;

    // 3. Find all associated timetable slots
    const slotsCol = adminDb.collection("years").doc(yearId).collection("slots");
    const sessionsCol = adminDb.collection("years").doc(yearId).collection("sessions");
    const slotSnap = await slotsCol.where("classId", "==", id).get();

    const hasHistory = hasHeldSessions || hasPaidFees;

    if (hasHistory) {
      // Historical safety: Archive class and remove from active timetable
      await classRef.update({
        active: false,
        archivedAt: new Date().toISOString(),
      });

      // Remove all active timetable slots
      const batch = adminDb.batch();
      slotSnap.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Delete future scheduled sessions only
      const sessionsSnap = await sessionsCol.where("classId", "==", id).get();
      sessionsSnap.forEach((doc) => {
        const data = doc.data();
        if (data.date >= todayStr && data.status === "scheduled") {
          batch.delete(doc.ref);
        }
      });

      await batch.commit();

      // Notify teacher for each removed slot
      slotSnap.forEach((doc) => {
        const slotData = doc.data();
        if (slotData.teacherId) {
          try {
            notifyTeacherTimetableChange({
              teacherId: slotData.teacherId,
              slotId: doc.id,
              action: "deleted",
              className: classData.name || "Class",
              weekday: slotData.weekday,
              startTime: slotData.startTime,
              endTime: slotData.endTime,
              yearId,
            });
          } catch {}
        }
      });

      return NextResponse.json({
        archived: true,
        message:
          "Class has past held sessions or paid student fees. It has been deactivated and removed from the active timetable to preserve financial history.",
      });
    }

    // Zero historical activity: Clean purge
    // A. Delete enrolments subcollection
    const enrolmentsSnap = await classRef.collection("enrolments").get();
    const batch = adminDb.batch();
    enrolmentsSnap.forEach((d) => batch.delete(d.ref));

    // B. Delete terms subcollection
    const termsSnap = await classRef.collection("terms").get();
    termsSnap.forEach((d) => batch.delete(d.ref));

    // C. Delete class doc
    batch.delete(classRef);

    // D. Delete all timetable slots
    slotSnap.forEach((d) => batch.delete(d.ref));

    // E. Delete all sessions for this class
    const allSessionsSnap = await sessionsCol.where("classId", "==", id).get();
    allSessionsSnap.forEach((d) => batch.delete(d.ref));

    // F. Delete any draft/unpaid fees for this class
    const unpaidFeesSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("fees")
      .where("classId", "==", id)
      .get();
    unpaidFeesSnap.forEach((d) => batch.delete(d.ref));

    await batch.commit();

    // Notify teacher for each deleted slot
    slotSnap.forEach((doc) => {
      const slotData = doc.data();
      if (slotData.teacherId) {
        try {
          notifyTeacherTimetableChange({
            teacherId: slotData.teacherId,
            slotId: doc.id,
            action: "deleted",
            className: classData.name || "Class",
            weekday: slotData.weekday,
            startTime: slotData.startTime,
            endTime: slotData.endTime,
            yearId,
          });
        } catch {}
      }
    });

    invalidatePublicSiteDataCache();

    return NextResponse.json({
      deleted: true,
      message: "Class and all its timetable schedules have been permanently deleted.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete class: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
