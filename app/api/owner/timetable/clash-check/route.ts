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
      { teacherId: string; teacherName: string; grade: string; name: string }
    >();
    classesSnap.forEach((doc) => {
      const d = doc.data();
      classInfoMap.set(doc.id, {
        teacherId: (d.teacherId || "").trim(),
        teacherName: d.teacherName || "",
        grade: d.grade || "",
        name: d.name || "",
      });
    });

    const existingIntervals: TimeInterval[] = [];
    slotsSnap.forEach((doc) => {
      const data = doc.data() as TimetableSlot;
      const classInfo = classInfoMap.get(data.classId);
      existingIntervals.push(
        slotToTimeInterval({
          ...data,
          id: doc.id,
          grade: data.grade || classInfo?.grade || "",
          className: data.className || classInfo?.name || "",
          teacherId: data.teacherId?.trim() || classInfo?.teacherId || "",
          teacherName: data.teacherName || classInfo?.teacherName || "",
        })
      );
    });

    const targetGrade =
      body.grade || (classId ? classInfoMap.get(classId)?.grade : "") || "";

    const candidate: TimeInterval = {
      id: slotId || "candidate",
      classId: classId || "",
      className: className || (classId ? classInfoMap.get(classId)?.name : "") || "",
      grade: targetGrade,
      teacherId: teacherId || (classId ? classInfoMap.get(classId)?.teacherId : "") || "",
      teacherName: teacherName || (classId ? classInfoMap.get(classId)?.teacherName : "") || "",
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
