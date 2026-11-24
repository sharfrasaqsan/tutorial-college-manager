import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import type { Session } from "@/types";

/**
 * GET /api/owner/timetable/sessions
 * Returns dated sessions within a date range for the owner timetable views.
 */
export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const classId = searchParams.get("classId");
    const teacherId = searchParams.get("teacherId");
    const grade = searchParams.get("grade");

    let query: FirebaseFirestore.Query = adminDb
      .collection("years")
      .doc(yearId)
      .collection("sessions");

    if (from) {
      query = query.where("date", ">=", from);
    }
    if (to) {
      query = query.where("date", "<=", to);
    }
    if (classId) {
      query = query.where("classId", "==", classId);
    }
    if (teacherId) {
      query = query.where("teacherId", "==", teacherId);
    }

    const snap = await query.get();
    const sessions: Session[] = [];

    snap.forEach((doc) => {
      const data = doc.data();
      if (!grade || data.grade === grade) {
        sessions.push({
          id: doc.id,
          classId: data.classId,
          className: data.className || "Class",
          grade: data.grade || "",
          subject: data.subject || "",
          yearId: data.yearId || yearId,
          teacherId: data.teacherId,
          teacherName: data.teacherName || "Teacher",
          slotId: data.slotId,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          type: data.type || "regular",
          status: data.status || "scheduled",
          countsForMonth: data.countsForMonth || data.date?.substring(0, 7),
          markedAt: data.markedAt,
          markedBy: data.markedBy,
          locked: data.locked || false,
        });
      }
    });

    // Sort by date then startTime
    sessions.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

    return NextResponse.json({ sessions, count: sessions.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch sessions: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
