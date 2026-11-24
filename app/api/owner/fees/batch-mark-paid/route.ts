import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyApiAuth } from "@/lib/auth";
import { adminDb } from "@/lib/firebase-admin";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";
import { getNextReceiptNo } from "@/lib/fees";
import { recordAuditLog } from "@/lib/audit";
import type { FeeRecord } from "@/types";

const BatchMarkPaidSchema = z.object({
  feeIds: z.array(z.string().min(1)).min(1, "At least one fee record must be selected."),
  paymentMethod: z.enum(["cash", "bank"], {
    error: "Payment method must be either 'cash' or 'bank'.",
  }),
  paidAt: z.string().optional(),
});

/**
 * POST /api/owner/fees/batch-mark-paid
 * Marks all selected fee records for a student as paid in one operation:
 * - Generates official sequential receipt numbers (FEE-YYYY-NNNNN)
 * - Updates status, method, paid date, and receipt
 * - Records auditLog entry for each updated fee
 */
export async function POST(request: NextRequest) {
  const { errorResponse, user } = await verifyApiAuth(request, ["owner"]);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(request.url);
    const cookieYear = request.cookies.get(YEAR_COOKIE_NAME)?.value;
    const yearId = searchParams.get("yearId") || cookieYear || "2026";

    const body = await request.json();
    const parsed = BatchMarkPaidSchema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || "Invalid batch payment data.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { feeIds, paymentMethod, paidAt } = parsed.data;
    const now = new Date().toISOString();
    const paymentTimestamp = paidAt || now;

    const feesCollection = adminDb.collection("years").doc(yearId).collection("fees");
    const updatedFees: FeeRecord[] = [];

    for (const feeId of feeIds) {
      const feeDocRef = feesCollection.doc(feeId);
      const doc = await feeDocRef.get();

      if (!doc.exists) continue;
      const beforeData = doc.data() as FeeRecord;

      if (beforeData.status === "paid") {
        updatedFees.push(beforeData);
        continue;
      }

      const receiptNo = await getNextReceiptNo(yearId);

      const updates: Partial<FeeRecord> & { updatedAt: string } = {
        status: "paid",
        paymentMethod,
        paidAt: paymentTimestamp,
        receiptNo,
        updatedAt: now,
      };

      await feeDocRef.update(updates);
      const afterData = { ...beforeData, ...updates };
      updatedFees.push(afterData);

      await recordAuditLog({
        who: user?.email || "owner",
        role: "owner",
        action: "batchMarkPaid",
        entity: "fee",
        entityId: feeId,
        before: { status: "unpaid" },
        after: { status: "paid", receiptNo, paymentMethod },
        yearId,
        metadata: {
          studentId: beforeData.studentId,
          classId: beforeData.classId,
          month: beforeData.month,
        },
      });
    }

    return NextResponse.json({
      success: true,
      updatedCount: updatedFees.length,
      fees: updatedFees,
      message: `Marked ${updatedFees.length} fee(s) as paid successfully.`,
    });
  } catch (error: any) {
    console.error("POST /api/owner/fees/batch-mark-paid error:", error);
    return NextResponse.json(
      { error: "Failed to mark fees paid: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
