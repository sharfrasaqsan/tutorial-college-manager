import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { formatColomboPattern } from "@/lib/dates";
import { syncAllSalariesForMonth } from "@/lib/salary-recalc";
import type { ClassSalaryRecord, Invoice } from "@/types";

export interface TeacherSalaryGroup {
  teacherId: string;
  teacherName: string;
  teacherEmail?: string;
  teacherPhone?: string;
  classes: ClassSalaryRecord[];
  totalReadyAmount: number;
  totalPaidAmount: number;
  totalOnHoldAmount: number;
  totalAmount: number;
  readyClassesCount: number;
  onHoldClassesCount: number;
  paidClassesCount: number;
  canPay: boolean;
}

/**
 * GET /api/owner/salaries
 * Month selector driven salary overview for all teachers in an academic year.
 * Per teacher: classes showing 'X of Y sessions' (e.g. 5 of 8 sessions), status chip, and amount;
 * Teacher total for Ready classes.
 * Lists all generated invoices for that month.
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

    // 1. Sync/recalculate salaries and fetch teachers in parallel
    const [salaries, teachersSnap] = await Promise.all([
      syncAllSalariesForMonth(yearId, month),
      adminDb.collection("teachers").get(),
    ]);

    // 2. Map teachers to ensure complete names and roster
    const teachersMap = new Map<string, { name: string; email?: string; phone?: string }>();
    teachersSnap.forEach((doc) => {
      const data = doc.data();
      teachersMap.set(doc.id, {
        name: data.name || "Teacher",
        email: data.email,
        phone: data.phone,
      });
    });

    // 4. Group salaries by teacher
    const groupsMap = new Map<string, TeacherSalaryGroup>();

    salaries.forEach((sal) => {
      let group = groupsMap.get(sal.teacherId);
      if (!group) {
        const teacherMeta = teachersMap.get(sal.teacherId);
        group = {
          teacherId: sal.teacherId,
          teacherName: teacherMeta?.name || sal.teacherName || "Teacher",
          teacherEmail: teacherMeta?.email,
          teacherPhone: teacherMeta?.phone,
          classes: [],
          totalReadyAmount: 0,
          totalPaidAmount: 0,
          totalOnHoldAmount: 0,
          totalAmount: 0,
          readyClassesCount: 0,
          onHoldClassesCount: 0,
          paidClassesCount: 0,
          canPay: false,
        };
        groupsMap.set(sal.teacherId, group);
      }

      group.classes.push(sal);
      group.totalAmount += sal.amount || 0;

      if (sal.status === "paid") {
        group.totalPaidAmount += sal.amount || 0;
        group.paidClassesCount++;
      } else if (sal.status === "ready") {
        group.totalReadyAmount += sal.amount || 0;
        group.readyClassesCount++;
      } else {
        group.totalOnHoldAmount += sal.amount || 0;
        group.onHoldClassesCount++;
      }
    });

    // Determine canPay (has at least 1 ready class)
    const teachersList: TeacherSalaryGroup[] = Array.from(groupsMap.values()).map((g) => {
      g.classes.sort((a, b) => a.className.localeCompare(b.className));
      g.canPay = g.readyClassesCount > 0;
      return g;
    });

    teachersList.sort((a, b) => a.teacherName.localeCompare(b.teacherName));

    // 5. Fetch invoices for this month
    const invoicesSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("invoices")
      .where("month", "==", month)
      .get();

    const invoices: Invoice[] = [];
    invoicesSnap.forEach((doc) => {
      invoices.push(doc.data() as Invoice);
    });
    invoices.sort((a, b) => (b.invoiceNo || "").localeCompare(a.invoiceNo || ""));

    return NextResponse.json({
      yearId,
      month,
      teachers: teachersList,
      invoices,
    });
  } catch (error: any) {
    console.error("GET /api/owner/salaries error:", error);
    return NextResponse.json(
      { error: "Failed to load salaries: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
