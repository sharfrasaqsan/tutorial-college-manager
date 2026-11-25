import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { getColomboNow } from "@/lib/dates";

export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const queryYear = request.nextUrl.searchParams.get("year");
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const selectedYear =
      (queryYear && /^\d{4}$/.test(queryYear) ? queryYear : null) ||
      cookieYear ||
      "2026";

    const todayWeekday = getColomboNow().getDay();

    const [studentsSnap, classesSnap, teachersSnap, requestsSnap, slotsSnapPrimary] =
      await Promise.all([
        adminDb.collection("students").where("active", "==", true).get(),
        adminDb
          .collection("years")
          .doc(selectedYear)
          .collection("classes")
          .where("active", "==", true)
          .get(),
        adminDb.collection("teachers").where("active", "==", true).get(),
        adminDb.collection("requests").where("status", "==", "pending").get(),
        adminDb
          .collection("years")
          .doc(selectedYear)
          .collection("slots")
          .where("weekday", "==", todayWeekday)
          .get(),
      ]);

    let slotsSnap = slotsSnapPrimary;
    if (slotsSnap.empty) {
      slotsSnap = await adminDb
        .collection("years")
        .doc(selectedYear)
        .collection("timetableSlots")
        .where("weekday", "==", todayWeekday)
        .get();
    }

    const todaySessions = slotsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) =>
        (a.startTime || "").localeCompare(b.startTime || "")
      );

    return NextResponse.json({
      selectedYear,
      studentCount: studentsSnap.size,
      classCount: classesSnap.size,
      teacherCount: teachersSnap.size,
      pendingRequestCount: requestsSnap.size,
      todaySessions,
    });
  } catch (err: any) {
    console.error("Failed to fetch owner dashboard:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load dashboard data." },
      { status: 500 }
    );
  }
}
