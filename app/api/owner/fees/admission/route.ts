import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { calculateAdmissionFeeSummary } from "@/lib/fees";
import type { Student, AdmissionFeeStatus } from "@/types";

/**
 * GET /api/owner/fees/admission
 * Lists students and their one-time admission fee status for the selected year.
 */
export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";
    const statusFilter = searchParams.get("status") || "all";
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    // 1. Fetch roster for the year
    const rosterSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("roster")
      .get();

    const rosterMap = new Map<string, { grade: string; status: string }>();
    rosterSnap.forEach((doc) => {
      const data = doc.data();
      rosterMap.set(doc.id, {
        grade: data.grade || "",
        status: data.status || "enrolled",
      });
    });

    // 2. Fetch all permanent student records
    const studentsSnap = await adminDb.collection("students").get();
    const studentsList: Array<Student & { grade: string }> = [];

    studentsSnap.forEach((doc) => {
      const data = doc.data();
      const rosterEntry = rosterMap.get(doc.id);
      const studentGrade = rosterEntry?.grade || data.gradesByYear?.[yearId] || "Grade 10";

      studentsList.push({
        id: doc.id,
        name: data.name || "",
        school: data.school || "",
        address: data.address || "",
        guardianName: data.guardianName || "",
        guardianPhone: data.guardianPhone || "",
        studentPhone: data.studentPhone || undefined,
        joinedAt: data.joinedAt || data.createdAt || new Date().toISOString(),
        admissionFee: {
          amount: data.admissionFee?.amount ?? 0,
          status: data.admissionFee?.status ?? "unpaid",
          method: data.admissionFee?.method || undefined,
          paidDate: data.admissionFee?.paidDate || undefined,
          receiptNo: data.admissionFee?.receiptNo || undefined,
        },
        gradesByYear: data.gradesByYear || {},
        grade: studentGrade,
        active: data.active !== false,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
    });

    // 3. Compute summary across all students
    const summary = calculateAdmissionFeeSummary(studentsList);

    // 4. Apply status and search filters
    const filtered = studentsList.filter((s) => {
      const sFeeStatus = s.admissionFee?.status || "unpaid";
      if (statusFilter !== "all" && sFeeStatus !== statusFilter) {
        return false;
      }

      if (search) {
        const matchName = s.name.toLowerCase().includes(search);
        const matchSchool = s.school.toLowerCase().includes(search);
        const matchGuardian = s.guardianName.toLowerCase().includes(search);
        const matchPhone = s.guardianPhone.toLowerCase().includes(search);
        const matchReceipt = (s.admissionFee?.receiptNo || "").toLowerCase().includes(search);
        if (!matchName && !matchSchool && !matchGuardian && !matchPhone && !matchReceipt) {
          return false;
        }
      }

      return true;
    });

    filtered.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      students: filtered,
      summary,
      yearId,
    });
  } catch (error: any) {
    console.error("GET /api/owner/fees/admission error:", error);
    return NextResponse.json(
      { error: "Failed to list admission fees: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
