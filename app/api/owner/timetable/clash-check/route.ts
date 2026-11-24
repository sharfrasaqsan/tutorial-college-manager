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
    const yearId = body.yearId || cookieYear || "2026";

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

    // Read existing slots for the academic year
    const slotsSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("slots")
      .get();

    const existingIntervals: TimeInterval[] = [];
    slotsSnap.forEach((doc) => {
      const data = doc.data() as TimetableSlot;
      existingIntervals.push(
        slotToTimeInterval({
          ...data,
          id: doc.id,
        })
      );
    });

    const candidate: TimeInterval = {
      id: slotId || "candidate",
      classId: classId || "",
      className: className || "",
      grade: body.grade || "",
      teacherId: teacherId || "",
      teacherName: teacherName || "",
      weekday: Number(weekday),
      startTime,
      endTime,
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
