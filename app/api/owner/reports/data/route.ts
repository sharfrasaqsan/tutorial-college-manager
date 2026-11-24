import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { formatColomboPattern } from "@/lib/dates";
import {
  getStudentPaymentsReport,
  getPendingFeesReport,
  getTeacherSalaryReport,
  getMonthSummaryReport,
} from "@/lib/reports";

/**
 * GET /api/owner/reports/data
 * Returns report data for the owner preview screen.
 * Query params:
 * - type: "student-payments" | "pending-fees" | "teacher-salary" | "month-summary" | "all"
 * - month: "YYYY-MM"
 * - yearId: string
 */
export async function GET(request: NextRequest) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";
    const currentMonth = formatColomboPattern(new Date(), "yyyy-MM");
    const month = searchParams.get("month") || currentMonth;
    const type = searchParams.get("type") || "month-summary";

    if (type === "student-payments") {
      const data = await getStudentPaymentsReport(yearId, month);
      return NextResponse.json({ type, data });
    }

    if (type === "pending-fees") {
      const data = await getPendingFeesReport(yearId, month);
      return NextResponse.json({ type, data });
    }

    if (type === "teacher-salary") {
      const data = await getTeacherSalaryReport(yearId, month);
      return NextResponse.json({ type, data });
    }

    if (type === "month-summary") {
      const data = await getMonthSummaryReport(yearId, month);
      return NextResponse.json({ type, data });
    }

    // Default or "all"
    const [studentPayments, pendingFees, teacherSalary, monthSummary] = await Promise.all([
      getStudentPaymentsReport(yearId, month),
      getPendingFeesReport(yearId, month),
      getTeacherSalaryReport(yearId, month),
      getMonthSummaryReport(yearId, month),
    ]);

    return NextResponse.json({
      type: "all",
      data: {
        studentPayments,
        pendingFees,
        teacherSalary,
        monthSummary,
      },
    });
  } catch (error: any) {
    console.error("GET /api/owner/reports/data error:", error);
    return NextResponse.json(
      { error: "Failed to load report data: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
