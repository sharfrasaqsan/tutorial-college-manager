import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { getColomboNow, getMarkingWindowDetails } from "@/lib/dates";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { format, subDays } from "date-fns";
import type { Session } from "@/types";

/**
 * GET /api/teacher/today
 * Returns today's sessions, unmarked urgent sessions from the last 3 days (with days left),
 * and upcoming sessions. Teachers can ONLY see their own sessions.
 */
export async function GET(request: NextRequest) {
  const { user, errorResponse } = await verifyApiAuth(request, ["teacher"]);
  if (errorResponse) return errorResponse;

  try {
    const teacherId = user!.uid;
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = cookieYear || "2026";

    const now = getColomboNow();
    const todayStr = format(now, "yyyy-MM-dd");
    const threeDaysAgoStr = format(subDays(now, 3), "yyyy-MM-dd");

    // Fetch teacher profile
    const teacherDoc = await adminDb.collection("teachers").doc(teacherId).get();
    const teacherName = teacherDoc.exists ? teacherDoc.data()?.name || "Teacher" : "Teacher";

    // Query teacher sessions for the academic year (single and co-taught)
    const [primarySessionsSnap, multiSessionsSnap] = await Promise.all([
      adminDb
        .collection("years")
        .doc(yearId)
        .collection("sessions")
        .where("teacherId", "==", teacherId)
        .get(),
      adminDb
        .collection("years")
        .doc(yearId)
        .collection("sessions")
        .where("teacherIds", "array-contains", teacherId)
        .get(),
    ]);

    const seenSessionIds = new Set<string>();
    const allTeacherSessions: (Session & { markingDetails?: any })[] = [];

    const addSession = (doc: any) => {
      if (seenSessionIds.has(doc.id)) return;
      seenSessionIds.add(doc.id);
      const data = doc.data();
      allTeacherSessions.push({
        id: doc.id,
        classId: data.classId,
        className: data.className || "Class",
        grade: data.grade || "",
        subject: data.subject || "",
        yearId: data.yearId || yearId,
        teacherId: data.teacherId,
        teacherName: data.teacherName || teacherName,
        isMultiTeacher: data.isMultiTeacher,
        teachers: data.teachers,
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
    };

    primarySessionsSnap.forEach(addSession);
    multiSessionsSnap.forEach(addSession);

    // 1. Unmarked urgent sessions from the last 3 days
    // Appears first with days left warning
    const unmarkedUrgent: (Session & { markingDetails: any })[] = [];
    const todaySessions: (Session & { markingDetails: any })[] = [];
    const upcomingSessions: (Session & { markingDetails: any })[] = [];

    for (const session of allTeacherSessions) {
      const markingDetails = getMarkingWindowDetails(session.date, session.startTime, now);

      if (session.status === "scheduled" && session.date < todayStr && session.date >= threeDaysAgoStr) {
        unmarkedUrgent.push({ ...session, markingDetails });
      } else if (session.date === todayStr) {
        todaySessions.push({ ...session, markingDetails });
      } else if (session.date > todayStr) {
        upcomingSessions.push({ ...session, markingDetails });
      }
    }

    // Sort unmarked urgent by date ascending (most urgent first)
    unmarkedUrgent.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

    // Sort today sessions by startTime
    todaySessions.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Sort upcoming by date ascending, take next 10
    upcomingSessions.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    const nextUpcoming = upcomingSessions.slice(0, 10);

    return NextResponse.json({
      today: todayStr,
      teacherName,
      teacherId,
      unmarkedUrgent,
      todaySessions,
      upcomingSessions: nextUpcoming,
      totalUnmarkedCount: unmarkedUrgent.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to load teacher dashboard: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
