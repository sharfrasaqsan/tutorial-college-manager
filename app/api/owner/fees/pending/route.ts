import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { formatColomboPattern } from "@/lib/dates";
import type { FeeRecord, Student } from "@/types";

/**
 * GET /api/owner/fees/pending
 * Pending View: Lists unpaid students for a chosen month AND earlier months (arrears).
 * Includes guardian name and phone as tap-to-call links.
 * Shows unpaid admission fees separately.
 */
export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";
    const currentMonth = formatColomboPattern(new Date(), "yyyy-MM");
    const upToMonth = searchParams.get("upToMonth") || currentMonth;

    // 1. Fetch all permanent student records for contact & guardian info
    const studentsSnap = await adminDb.collection("students").get();
    const studentsMap = new Map<string, Student>();
    studentsSnap.forEach((doc) => {
      studentsMap.set(doc.id, { id: doc.id, ...doc.data() } as Student);
    });

    // 2. Query all unpaid monthly fee records for this academic year
    const feesSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("fees")
      .where("status", "==", "unpaid")
      .get();

    // Group unpaid fees by student
    const studentUnpaidMap = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        school: string;
        guardianName: string;
        guardianPhone: string;
        studentPhone?: string;
        grade: string;
        totalPendingAmount: number;
        unpaidFees: Array<{
          id: string;
          month: string;
          classId: string;
          className: string;
          amount: number;
          teacherShare: number;
        }>;
      }
    >();

    let totalPendingTuition = 0;

    feesSnap.forEach((doc) => {
      const fee = doc.data() as FeeRecord & { className?: string; grade?: string };
      // Include only records where month <= upToMonth
      if (!fee.month || fee.month > upToMonth) return;

      const studentId = fee.studentId;
      const student = studentsMap.get(studentId);

      if (!studentUnpaidMap.has(studentId)) {
        studentUnpaidMap.set(studentId, {
          studentId,
          studentName: fee.studentName || student?.name || "Student",
          school: student?.school || "",
          guardianName: student?.guardianName || "Guardian",
          guardianPhone: student?.guardianPhone || "",
          studentPhone: student?.studentPhone,
          grade: fee.grade || student?.gradesByYear?.[yearId] || "Grade 10",
          totalPendingAmount: 0,
          unpaidFees: [],
        });
      }

      const entry = studentUnpaidMap.get(studentId)!;
      entry.totalPendingAmount += fee.amount || 0;
      totalPendingTuition += fee.amount || 0;
      entry.unpaidFees.push({
        id: doc.id,
        month: fee.month,
        classId: fee.classId,
        className: fee.className || "Class Fee",
        amount: fee.amount,
        teacherShare: fee.teacherShare,
      });
    });

    // Sort unpaid fees inside each student by month ascending
    const pendingStudentsList = Array.from(studentUnpaidMap.values());
    for (const s of pendingStudentsList) {
      s.unpaidFees.sort((a, b) => a.month.localeCompare(b.month));
    }
    // Sort students by total pending amount descending
    pendingStudentsList.sort((a, b) => b.totalPendingAmount - a.totalPendingAmount);

    // 3. Find students with unpaid admission fee
    const unpaidAdmissionStudents: Array<{
      studentId: string;
      studentName: string;
      school: string;
      guardianName: string;
      guardianPhone: string;
      grade: string;
      amount: number;
      joinedAt: string;
    }> = [];

    let totalUnpaidAdmissionAmount = 0;

    for (const [sId, student] of studentsMap.entries()) {
      if (student.active !== false && student.admissionFee?.status === "unpaid") {
        const amt = student.admissionFee.amount || 2500;
        totalUnpaidAdmissionAmount += amt;
        unpaidAdmissionStudents.push({
          studentId: sId,
          studentName: student.name,
          school: student.school || "",
          guardianName: student.guardianName,
          guardianPhone: student.guardianPhone,
          grade: student.gradesByYear?.[yearId] || "Grade 10",
          amount: amt,
          joinedAt: student.joinedAt,
        });
      }
    }

    unpaidAdmissionStudents.sort((a, b) => a.studentName.localeCompare(b.studentName));

    return NextResponse.json({
      upToMonth,
      yearId,
      totalPendingTuition,
      totalUnpaidAdmissionAmount,
      pendingStudentsCount: pendingStudentsList.length,
      unpaidAdmissionsCount: unpaidAdmissionStudents.length,
      pendingStudents: pendingStudentsList,
      unpaidAdmissionStudents,
    });
  } catch (error: any) {
    console.error("GET /api/owner/fees/pending error:", error);
    return NextResponse.json(
      { error: "Failed to load pending fees: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
