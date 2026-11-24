import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { MarkAdmissionFeeSchema, generateReceiptNo } from "@/lib/fees";
import { protectStudentJoinedAt } from "@/lib/students";
import { recordAuditLog } from "@/lib/audit";
import { formatColomboPattern } from "@/lib/dates";
import type { Student, StudentAdmissionFee } from "@/types";

interface RouteParams {
  params: Promise<{ studentId: string }>;
}

/**
 * PATCH /api/owner/fees/admission/[studentId]
 * Updates a student's admission fee status (paid, unpaid, or notApplicable).
 * Ensures joinedAt is immutable and records an auditLog.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { errorResponse, user } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { studentId } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    const studentRef = adminDb.collection("students").doc(studentId);
    const studentDoc = await studentRef.get();

    if (!studentDoc.exists) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    const currentStudent = studentDoc.data() as Student;
    const beforeAdmissionFee = currentStudent.admissionFee || {
      amount: 0,
      status: "unpaid",
    };

    const body = await request.json();
    const parsed = MarkAdmissionFeeSchema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Invalid admission fee payload.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { status, amount, method, paidDate, receiptNo } = parsed.data;
    const now = new Date().toISOString();

    let updatedAdmissionFee: StudentAdmissionFee;

    if (status === "paid") {
      const todayDate = formatColomboPattern(new Date(), "yyyy-MM-dd");
      const generatedReceipt = receiptNo?.trim() || beforeAdmissionFee.receiptNo || generateReceiptNo("ADM", yearId);

      updatedAdmissionFee = {
        amount: typeof amount === "number" ? amount : beforeAdmissionFee.amount || 2500,
        status: "paid",
        method: method || "cash",
        paidDate: paidDate || todayDate,
        receiptNo: generatedReceipt,
      };
    } else if (status === "notApplicable") {
      updatedAdmissionFee = {
        amount: 0,
        status: "notApplicable",
        method: undefined,
        paidDate: undefined,
        receiptNo: undefined,
      };
    } else {
      // unpaid
      updatedAdmissionFee = {
        amount: typeof amount === "number" ? amount : beforeAdmissionFee.amount || 0,
        status: "unpaid",
        method: undefined,
        paidDate: undefined,
        receiptNo: undefined,
      };
    }

    // Verify joinedAt immutability
    const protectedJoinedAt = protectStudentJoinedAt(currentStudent, body);

    await studentRef.update({
      admissionFee: updatedAdmissionFee,
      joinedAt: protectedJoinedAt,
      updatedAt: now,
    });

    // Record auditLog
    await recordAuditLog({
      who: user?.email || "owner",
      role: "owner",
      action: `updateAdmissionFee_${status}`,
      entity: "admissionFee",
      entityId: studentId,
      before: beforeAdmissionFee,
      after: updatedAdmissionFee,
      yearId,
      metadata: {
        studentName: currentStudent.name,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Admission fee updated to ${status}.`,
      admissionFee: updatedAdmissionFee,
    });
  } catch (error: any) {
    console.error("PATCH /api/owner/fees/admission/[studentId] error:", error);
    return NextResponse.json(
      { error: "Failed to update admission fee: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
