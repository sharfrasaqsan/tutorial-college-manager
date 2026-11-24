import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import {
  PayTeacherSchema,
  generateSalaryDocId,
  getNextInvoiceNo,
} from "@/lib/salary";
import { formatLKR } from "@/lib/money";
import { notify } from "@/lib/notifications";
import { recordAuditLog } from "@/lib/audit";
import type { ClassSalaryRecord, CollegeProfile, Invoice, SalaryClassSummary } from "@/types";

/**
 * POST /api/owner/salaries/pay
 * Pay teacher for selected ready classes:
 * - Creates ONE combined invoice: SAL-YYYY-MM-NNN
 * - Marks those class salary records as paid with invoiceNo and deposit date
 * - Classes on hold stay on hold and will go into a later invoice
 * - Records auditLog
 */
export async function POST(request: NextRequest) {
  const { errorResponse, user } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const body = await request.json();
    const yearId = body.yearId || searchParams.get("yearId") || cookieYear || "2026";

    const parsed = PayTeacherSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Invalid payment details.";
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const { teacherId, month, classIds, depositDate, paymentMethod } = parsed.data;

    // 1. Fetch teacher record
    const teacherDoc = await adminDb.collection("teachers").doc(teacherId).get();
    const teacherName = teacherDoc.exists ? teacherDoc.data()?.name || "Teacher" : "Teacher";

    // 2. Fetch college profile
    const collegeDoc = await adminDb.collection("settings").doc("college").get();
    const collegeData = (collegeDoc.exists ? collegeDoc.data() : null) as CollegeProfile | null;

    // 3. Fetch and validate each selected class salary record
    const selectedSalaries: ClassSalaryRecord[] = [];
    for (const classId of classIds) {
      const docId = generateSalaryDocId(teacherId, classId, month);
      const salaryDoc = await adminDb
        .collection("years")
        .doc(yearId)
        .collection("salaries")
        .doc(docId)
        .get();

      if (!salaryDoc.exists) {
        return NextResponse.json(
          { error: `Salary record for class ${classId} not found.` },
          { status: 404 }
        );
      }

      const salaryData = salaryDoc.data() as ClassSalaryRecord;

      if (salaryData.isPaid || salaryData.status === "paid") {
        return NextResponse.json(
          { error: `Class "${salaryData.className}" has already been paid (Invoice: ${salaryData.invoiceNo || "N/A"}).` },
          { status: 400 }
        );
      }

      if (salaryData.status !== "ready") {
        return NextResponse.json(
          {
            error: `Class "${salaryData.className}" is on hold (${salaryData.heldSessions} of ${salaryData.requiredSessions} sessions held) and cannot be paid yet.`,
          },
          { status: 400 }
        );
      }

      selectedSalaries.push(salaryData);
    }

    // 4. Generate sequential invoice number transactionally
    const invoiceNo = await getNextInvoiceNo(yearId, month);
    const now = new Date().toISOString();

    // 5. Construct invoice summaries
    const classSummaries: SalaryClassSummary[] = selectedSalaries.map((s) => ({
      classId: s.classId,
      className: s.className,
      grade: s.grade,
      subject: s.subject,
      studentCount: s.studentCount,
      sessionsHeld: s.heldSessions,
      sessionsRequired: s.requiredSessions,
      amount: s.amount,
    }));

    const totalAmount = classSummaries.reduce((acc, c) => acc + c.amount, 0);

    const invoice: Invoice = {
      id: invoiceNo,
      invoiceNo,
      yearId,
      teacherId,
      teacherName,
      month,
      totalAmount,
      classes: classSummaries,
      status: "paid",
      collegeName: collegeData?.name || "Tutorial College",
      collegeLogoUrl: collegeData?.logoUrl,
      collegeAddress: collegeData?.address || "Colombo, Sri Lanka",
      collegePhone: collegeData?.phone || "",
      issuedAt: now,
      paidAt: now,
      depositDate,
      paymentMethod,
    };

    // 6. Write invoice doc and update all selected salary records in a batch
    const batch = adminDb.batch();
    const invoiceRef = adminDb.collection("years").doc(yearId).collection("invoices").doc(invoiceNo);
    batch.set(invoiceRef, invoice);

    for (const salary of selectedSalaries) {
      const salaryRef = adminDb
        .collection("years")
        .doc(yearId)
        .collection("salaries")
        .doc(salary.id);

      batch.update(salaryRef, {
        status: "paid",
        isPaid: true,
        invoiceId: invoiceNo,
        invoiceNo,
        depositDate,
        paymentMethod,
        paidAt: now,
        updatedAt: now,
      });
    }

    await batch.commit();

    // 7. Record audit log
    await recordAuditLog({
      who: user?.email || "owner",
      role: "owner",
      action: "pay_teacher",
      entity: "invoice",
      entityId: invoiceNo,
      before: null,
      after: {
        invoiceNo,
        teacherId,
        teacherName,
        month,
        totalAmount,
        classesCount: classSummaries.length,
        depositDate,
        paymentMethod,
      },
      yearId,
      metadata: {
        classIds,
        teacherId,
        month,
      },
    });

    // Notify teacher of salary payment & invoice availability
    try {
      await notify(
        teacherId,
        "Salary Deposited",
        `Your salary payout of ${formatLKR(totalAmount)} for ${month} (Invoice: ${invoiceNo}) has been deposited.`,
        "/teacher/salary"
      );
    } catch (notifErr) {
      console.error("Salary pay teacher notification error:", notifErr);
    }

    return NextResponse.json({
      success: true,
      invoice,
      message: `Successfully paid ${teacherName} LKR ${totalAmount.toLocaleString()} for ${classSummaries.length} class(es). Invoice ${invoiceNo} generated.`,
    });
  } catch (error: any) {
    console.error("POST /api/owner/salaries/pay error:", error);
    return NextResponse.json(
      { error: "Failed to process teacher payment: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
