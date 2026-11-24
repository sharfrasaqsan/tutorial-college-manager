import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import {
  UpdateClassTermsSchema,
  calculateOwnerShare,
  validateClassTerms,
  findEffectiveTermsForMonth,
} from "@/lib/classes";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { getCurrentMonthKey } from "@/lib/dates";
import type { ClassItem, ClassTerms, ClassEnrolment } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/owner/classes/[id]
 * Returns class details, term versioning history, enrolled students list,
 * and current month session progress placeholder.
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

    // 1. Fetch terms history
    const termsSnap = await classRef.collection("terms").get();
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

    // Sort terms by effectiveFromMonth descending for display
    termsHistory.sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth));

    // 2. Fetch enrolled students
    const enrolmentsSnap = await classRef.collection("enrolments").get();
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

    // 3. Current active terms for current month
    const currentMonth = getCurrentMonthKey();
    const effectiveTerms = findEffectiveTermsForMonth(termsHistory, currentMonth);

    // 4. Session progress placeholder for current month (Step 6 will track held sessions)
    const sessionProgress = {
      month: currentMonth,
      heldSessions: 0,
      requiredSessions: effectiveTerms.requiredSessionsPerMonth,
      status: "scheduled",
    };

    const classItem: ClassItem = {
      id: classDoc.id,
      yearId,
      grade: data.grade,
      subject: data.subject,
      teacherId: data.teacherId,
      teacherName: data.teacherName,
      name: data.name,
      currentTerms: effectiveTerms,
      termsHistory,
      enrolledStudentCount: enrolledStudents.length,
      active: data.active !== false,
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
