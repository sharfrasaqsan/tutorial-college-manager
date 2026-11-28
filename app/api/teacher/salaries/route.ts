import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { formatColomboPattern } from "@/lib/dates";
import { recalculateClassSalary } from "@/lib/salary-recalc";
import type { ClassSalaryRecord, Invoice } from "@/types";

/**
 * GET /api/teacher/salaries
 * Teacher's view of their monthly salaries, session progress, earnings, and paid invoices.
 * SECURITY: Student fee records and payment statuses are NEVER returned.
 */
export async function GET(request: NextRequest) {
  const { errorResponse, user } = await verifyApiAuth(request, ["teacher"]);
  if (errorResponse) return errorResponse;

  const teacherId = user!.uid;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";
    const currentMonth = formatColomboPattern(new Date(), "yyyy-MM");
    const month = searchParams.get("month") || currentMonth;

    // 1. Recalculate this teacher's active classes for this month (single and co-taught)
    const [primaryClassesSnap, multiClassesSnap] = await Promise.all([
      adminDb
        .collection("years")
        .doc(yearId)
        .collection("classes")
        .where("teacherId", "==", teacherId)
        .get(),
      adminDb
        .collection("years")
        .doc(yearId)
        .collection("classes")
        .where("teacherIds", "array-contains", teacherId)
        .get(),
    ]);

    const seenRecalcIds = new Set<string>();
    const recalcPromises: Promise<ClassSalaryRecord | null>[] = [];
    primaryClassesSnap.docs.forEach((doc) => {
      if (!seenRecalcIds.has(doc.id)) {
        seenRecalcIds.add(doc.id);
        recalcPromises.push(recalculateClassSalary(yearId, teacherId, doc.id, month));
      }
    });
    multiClassesSnap.docs.forEach((doc) => {
      if (!seenRecalcIds.has(doc.id)) {
        seenRecalcIds.add(doc.id);
        recalcPromises.push(recalculateClassSalary(yearId, teacherId, doc.id, month));
      }
    });
    await Promise.all(recalcPromises);

    // 2. Fetch salary records for this teacher and month
    const salariesSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("salaries")
      .where("teacherId", "==", teacherId)
      .where("month", "==", month)
      .get();

    const classes: ClassSalaryRecord[] = [];
    let totalAmount = 0;
    let totalReady = 0;
    let totalPaid = 0;
    let totalOnHold = 0;

    salariesSnap.forEach((doc) => {
      const data = doc.data() as ClassSalaryRecord;
      // Sanitize: ensure no student specific records leak
      const safeRecord: ClassSalaryRecord = {
        id: data.id,
        yearId: data.yearId,
        teacherId: data.teacherId,
        teacherName: data.teacherName,
        classId: data.classId,
        className: data.className,
        grade: data.grade,
        subject: data.subject,
        month: data.month,
        displayName: data.displayName,
        studentCount: data.studentCount,
        amount: data.amount,
        requiredSessions: data.requiredSessions,
        heldSessions: data.heldSessions,
        status: data.status,
        isPaid: data.isPaid,
        depositDate: data.depositDate,
        paymentMethod: data.paymentMethod,
        invoiceId: data.invoiceId,
        invoiceNo: data.invoiceNo,
        paidAt: data.paidAt,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };

      classes.push(safeRecord);
      totalAmount += data.amount || 0;

      if (data.status === "paid") {
        totalPaid += data.amount || 0;
      } else if (data.status === "ready") {
        totalReady += data.amount || 0;
      } else {
        totalOnHold += data.amount || 0;
      }
    });

    classes.sort((a, b) => a.className.localeCompare(b.className));

    // 3. Fetch paid invoices for this teacher
    const invoicesSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("invoices")
      .where("teacherId", "==", teacherId)
      .get();

    const invoices: Invoice[] = [];
    invoicesSnap.forEach((doc) => {
      invoices.push(doc.data() as Invoice);
    });
    invoices.sort((a, b) => (b.invoiceNo || "").localeCompare(a.invoiceNo || ""));

    return NextResponse.json({
      yearId,
      month,
      classes,
      invoices,
      totals: {
        totalAmount,
        totalReady,
        totalPaid,
        totalOnHold,
      },
    });
  } catch (error: any) {
    console.error("GET /api/teacher/salaries error:", error);
    return NextResponse.json(
      { error: "Failed to load teacher salary overview: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
