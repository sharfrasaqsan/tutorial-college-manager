import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { checkClash } from "@/lib/clash";
import { slotToTimeInterval } from "@/lib/timetable";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import type { TimeInterval, TimetableSlot } from "@/types";

/**
 * POST /api/owner/timetable/clash-check
 * Pre-flight check endpoint for live UI feedback before saving a slot.
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

    const { slotId, classId, teacherId, teacherName, className, weekday, startTime, endTime } = body;

    if (weekday === undefined || !startTime || !endTime) {
      return NextResponse.json(
        { hasClash: false, message: "" },
        { status: 200 }
      );
    }

    if (startTime >= endTime) {
      return NextResponse.json({
        hasClash: true,
        message: "End time must be after start time.",
      });
    }

    // Read existing classes and slots in parallel
    const [classesSnap, slotsSnap] = await Promise.all([
      adminDb
        .collection("years")
        .doc(yearId)
        .collection("classes")
        .get(),
      adminDb
        .collection("years")
        .doc(yearId)
        .collection("slots")
        .get(),
    ]);

    const classInfoMap = new Map<
      string,
      {
        teacherId: string;
        teacherName: string;
        grade: string;
        name: string;
        isMultiTeacher?: boolean;
        teacherIds?: string[];
        teachers?: any[];
      }
    >();
    classesSnap.forEach((doc) => {
      const d = doc.data();
      const tIds: string[] = [];
      if (d.teacherId) tIds.push(d.teacherId.trim());
      if (Array.isArray(d.teacherIds)) d.teacherIds.forEach((t: string) => t && tIds.push(t.trim()));
      if (Array.isArray(d.teachers)) d.teachers.forEach((t: any) => t.teacherId && tIds.push(t.teacherId.trim()));

      classInfoMap.set(doc.id, {
        teacherId: (d.teacherId || "").trim(),
        teacherName: d.teacherName || "",
        grade: d.grade || "",
        name: d.name || "",
        isMultiTeacher: Boolean(d.isMultiTeacher),
        teacherIds: Array.from(new Set(tIds)),
        teachers: d.teachers || [],
      });
    });

    const existingIntervals: TimeInterval[] = [];
    slotsSnap.forEach((doc) => {
      const data = doc.data() as TimetableSlot;
      const classInfo = classInfoMap.get(data.classId);
      const slotTeacherIds = new Set<string>();
      if (data.teacherId) slotTeacherIds.add(data.teacherId.trim());
      if (data.teacherIds) data.teacherIds.forEach((t) => t && slotTeacherIds.add(t.trim()));
      if (classInfo?.teacherIds && slotTeacherIds.size === 0) {
        classInfo.teacherIds.forEach((t) => slotTeacherIds.add(t));
      }

      existingIntervals.push(
        slotToTimeInterval({
          ...data,
          id: doc.id,
          grade: data.grade || classInfo?.grade || "",
          className: data.className || classInfo?.name || "",
          teacherId: data.teacherId?.trim() || classInfo?.teacherId || "",
          teacherName: data.teacherName || classInfo?.teacherName || "",
          teacherIds: Array.from(slotTeacherIds),
          teachers: classInfo?.teachers,
        })
      );
    });

    const targetGrade =
      body.grade || (classId ? classInfoMap.get(classId)?.grade : "") || "";

    const candidateClassInfo = classId ? classInfoMap.get(classId) : undefined;
    const candTeacherIds = new Set<string>();
    if (body.teacherId) candTeacherIds.add(body.teacherId.trim());
    if (body.teacherIds && Array.isArray(body.teacherIds)) {
      body.teacherIds.forEach((t: string) => t && candTeacherIds.add(t.trim()));
    }
    if (candidateClassInfo?.teacherIds && candTeacherIds.size === 0) {
      candidateClassInfo.teacherIds.forEach((t) => candTeacherIds.add(t));
    }

    const candidate: TimeInterval = {
      id: slotId || "candidate",
      classId: classId || "",
      className: className || candidateClassInfo?.name || "",
      grade: targetGrade,
      teacherId: teacherId || candidateClassInfo?.teacherId || "",
      teacherName: teacherName || candidateClassInfo?.teacherName || "",
      teacherIds: Array.from(candTeacherIds),
      teachers: candidateClassInfo?.teachers,
      weekday: Number(weekday),
      startTime,
      endTime,
      date: body.specificDate || body.date || undefined,
    };

    const clashResult = checkClash(candidate, existingIntervals);
    return NextResponse.json(clashResult);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to perform clash check: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
