import { NextRequest, NextResponse } from "next/server";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import {
  MarkFeePaidSchema,
  UpdateFeeAmountSchema,
  getNextReceiptNo,
  generateReceiptNo,
} from "@/lib/fees";
import { recordAuditLog } from "@/lib/audit";
import { recalculateClassSalary } from "@/lib/salary-recalc";
import type { FeeRecord } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/owner/fees/[id]
 * Retrieves a single fee record.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { errorResponse } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    const feeDocRef = adminDb.collection("years").doc(yearId).collection("fees").doc(id);
    const doc = await feeDocRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Fee record not found." }, { status: 404 });
    }

    return NextResponse.json({ fee: { id: doc.id, ...doc.data() } });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch fee record: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/owner/fees/[id]
 * Updates a fee record:
 * - Mark as paid: sets status, paymentMethod, paidAt, and generates/stores receiptNo
 * - Mark as unpaid: reverts to unpaid and clears payment metadata
 * - Edit amount & teacher share (e.g. for mid-month joiners): validates teacher share <= amount
 * - Records auditLog entry on every modification
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { errorResponse, user } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  const { id } = await params;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    const feeDocRef = adminDb.collection("years").doc(yearId).collection("fees").doc(id);
    const doc = await feeDocRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Fee record not found." }, { status: 404 });
    }

    const beforeData = doc.data() as FeeRecord;
    const body = await request.json();
    const now = new Date().toISOString();

    let updates: Partial<FeeRecord> & { updatedAt: string } = {
      updatedAt: now,
    };
    let auditAction = "updateFee";

    // 1. Marking as Paid
    if (body.status === "paid") {
      const parsed = MarkFeePaidSchema.safeParse(body);
      if (!parsed.success) {
        const msg = parsed.error.issues[0]?.message || "Invalid payment details.";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      let receiptNo = parsed.data.receiptNo?.trim() || beforeData.receiptNo;
      if (!receiptNo) {
        receiptNo = await getNextReceiptNo(yearId);
      }
      const paidAt = parsed.data.paidAt || now;

      updates = {
        ...updates,
        status: "paid",
        paymentMethod: parsed.data.paymentMethod,
        paidAt,
        receiptNo,
      };
      auditAction = "markFeePaid";
    }
    // 2. Reverting to Unpaid
    else if (body.status === "unpaid") {
      updates = {
        ...updates,
        status: "unpaid",
        paymentMethod: undefined,
        paidAt: undefined,
        receiptNo: undefined,
      };
      auditAction = "markFeeUnpaid";
    }

    // 3. Amount / Teacher Share adjustments (Mid-month joiners - requires note)
    if (typeof body.amount === "number" || typeof body.teacherShare === "number") {
      const amount = typeof body.amount === "number" ? body.amount : beforeData.amount;
      const teacherShare = typeof body.teacherShare === "number" ? body.teacherShare : beforeData.teacherShare;
      const note = typeof body.note === "string" ? body.note : beforeData.note || "Fee adjustment";

      const parsedAmounts = UpdateFeeAmountSchema.safeParse({ amount, teacherShare, note });
      if (!parsedAmounts.success) {
        const msg = parsedAmounts.error.issues[0]?.message || "Invalid fee amounts or missing note.";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      updates = {
        ...updates,
        amount,
        teacherShare,
        note,
      };
      if (auditAction === "updateFee") {
        auditAction = "adjustFeeAmount";
      }
    }

    // Write updates to Firestore
    await feeDocRef.update(updates);

    const afterData = { ...beforeData, ...updates };

    // Record audit log entry
    await recordAuditLog({
      who: user?.email || "owner",
      role: "owner",
      action: auditAction,
      entity: "fee",
      entityId: id,
      before: {
        amount: beforeData.amount,
        teacherShare: beforeData.teacherShare,
        status: beforeData.status,
        receiptNo: beforeData.receiptNo,
      },
      after: {
        amount: afterData.amount,
        teacherShare: afterData.teacherShare,
        status: afterData.status,
        receiptNo: afterData.receiptNo,
        note: afterData.note,
      },
      yearId,
      metadata: {
        studentId: beforeData.studentId,
        studentName: beforeData.studentName,
        classId: beforeData.classId,
        month: beforeData.month,
      },
    });

    // Recalculate salary for this teacher and class if fee amount/share changed
    try {
      if (beforeData.teacherId && beforeData.classId && beforeData.month) {
        await recalculateClassSalary(
          yearId,
          beforeData.teacherId,
          beforeData.classId,
          beforeData.month
        );
      }
    } catch (recalcErr) {
      console.error("Salary recalc error after updating fee:", recalcErr);
    }

    return NextResponse.json({
      success: true,
      message: "Fee record updated successfully.",
      fee: afterData,
    });
  } catch (error: any) {
    console.error("PATCH /api/owner/fees/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update fee record: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
