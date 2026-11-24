import { z } from "zod";
import { adminDb } from "./firebase-admin.ts";
import type { FeeRecord, FeeStatus, PaymentMethod, StudentAdmissionFee } from "../types/index.ts";

export const MonthKeyRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Transactional receipt counter: generates receiptNo format FEE-YYYY-NNNNN
 * from Firestore counter at `years/{yearId}/counters/receipts`.
 */
export async function getNextReceiptNo(yearId: string): Promise<string> {
  const counterRef = adminDb.collection("years").doc(yearId).collection("counters").doc("receipts");
  return await adminDb.runTransaction(async (t) => {
    const doc = await t.get(counterRef);
    let nextNum = 1;
    if (doc.exists) {
      nextNum = (doc.data()?.lastNumber || 0) + 1;
    }
    t.set(counterRef, { lastNumber: nextNum, updatedAt: new Date().toISOString() }, { merge: true });
    const padded = String(nextNum).padStart(5, "0");
    return `FEE-${yearId}-${padded}`;
  });
}

/**
 * Fallback / pure generator for standardized receipt numbers when offline or in unit tests.
 */
export function generateReceiptNo(prefix = "FEE", yearOrMonth?: string, sequenceNumber?: number): string {
  const year = yearOrMonth && yearOrMonth.length >= 4 ? yearOrMonth.slice(0, 4) : new Date().getFullYear().toString();
  if (typeof sequenceNumber === "number") {
    return `${prefix}-${year}-${String(sequenceNumber).padStart(5, "0")}`;
  }
  
  // 5 random uppercase alphanumeric characters (excluding ambiguous chars)
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let randomPart = "";
  for (let i = 0; i < 5; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${year}-${randomPart}`;
}

export const MarkFeePaidSchema = z.object({
  paymentMethod: z.enum(["cash", "bank"], {
    error: "Payment method must be either 'cash' or 'bank'.",
  }),
  paidAt: z.string().optional(),
  receiptNo: z.string().trim().optional(),
});

export const UpdateFeeAmountSchema = z
  .object({
    amount: z.number().min(0, "Fee amount must be 0 or greater."),
    teacherShare: z.number().min(0, "Teacher share must be 0 or greater."),
    note: z.string().trim().min(3, "A short note explaining the fee adjustment is required."),
  })
  .refine((data) => data.teacherShare <= data.amount, {
    message: "Teacher share cannot exceed the fee amount.",
    path: ["teacherShare"],
  });

export const MarkAdmissionFeeSchema = z
  .object({
    status: z.enum(["unpaid", "paid", "notApplicable"]),
    amount: z.number().min(0, "Admission fee amount must be 0 or greater.").optional(),
    method: z.enum(["cash", "bank"]).optional(),
    paidDate: z.string().optional(),
    receiptNo: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      if (data.status === "paid" && !data.method) {
        return false;
      }
      return true;
    },
    {
      message: "Payment method is required when marking admission fee as paid.",
      path: ["method"],
    }
  );

export type MarkFeePaidInput = z.infer<typeof MarkFeePaidSchema>;
export type UpdateFeeAmountInput = z.infer<typeof UpdateFeeAmountSchema>;
export type MarkAdmissionFeeInput = z.infer<typeof MarkAdmissionFeeSchema>;

/**
 * Generates deterministic fee doc ID: `years/{year}/fees/{studentId}_{classId}_{YYYY-MM}`
 */
export function generateFeeDocId(studentId: string, classId: string, month: string): string {
  return `${studentId}_${classId}_${month}`;
}

/**
 * Checks if a student enrolled in `joinedMonth` should be billed for `targetMonth`.
 */
export function shouldGenerateFeeForStudent(joinedMonth: string, targetMonth: string): boolean {
  if (!joinedMonth || !targetMonth) return false;
  return joinedMonth <= targetMonth;
}

export interface FeeSummary {
  totalExpected: number;
  totalCollected: number;
  totalUnpaid: number;
  totalTeacherShare: number;
  paidCount: number;
  unpaidCount: number;
  totalCount: number;
}

/**
 * Calculates financial summary totals for monthly fee records.
 */
export function calculateFeeSummary(fees: FeeRecord[]): FeeSummary {
  let totalExpected = 0;
  let totalCollected = 0;
  let totalUnpaid = 0;
  let totalTeacherShare = 0;
  let paidCount = 0;
  let unpaidCount = 0;

  for (const fee of fees) {
    totalExpected += fee.amount || 0;
    totalTeacherShare += fee.teacherShare || 0;

    if (fee.status === "paid") {
      totalCollected += fee.amount || 0;
      paidCount++;
    } else {
      totalUnpaid += fee.amount || 0;
      unpaidCount++;
    }
  }

  return {
    totalExpected,
    totalCollected,
    totalUnpaid,
    totalTeacherShare,
    paidCount,
    unpaidCount,
    totalCount: fees.length,
  };
}

export interface AdmissionFeeSummary {
  paidCount: number;
  unpaidCount: number;
  notApplicableCount: number;
  totalCollected: number;
  totalCount: number;
}

/**
 * Calculates summary for admission fee collection across students.
 */
export function calculateAdmissionFeeSummary(
  students: Array<{ admissionFee?: StudentAdmissionFee }>
): AdmissionFeeSummary {
  let paidCount = 0;
  let unpaidCount = 0;
  let notApplicableCount = 0;
  let totalCollected = 0;

  for (const s of students) {
    const fee = s.admissionFee;
    const status = fee?.status || "unpaid";

    if (status === "paid") {
      paidCount++;
      totalCollected += fee?.amount || 0;
    } else if (status === "notApplicable") {
      notApplicableCount++;
    } else {
      unpaidCount++;
    }
  }

  return {
    paidCount,
    unpaidCount,
    notApplicableCount,
    totalCollected,
    totalCount: students.length,
  };
}

/**
 * Pure filter function for fee records in the UI or export.
 */
export function filterFees(
  fees: FeeRecord[],
  filters: {
    classId?: string;
    grade?: string;
    status?: "all" | "unpaid" | "paid";
    search?: string;
  }
): FeeRecord[] {
  const normSearch = (filters.search || "").trim().toLowerCase();

  return fees.filter((fee) => {
    if (filters.classId && filters.classId !== "all" && fee.classId !== filters.classId) {
      return false;
    }

    if (filters.grade && filters.grade !== "all") {
      const g = fee.grade || "";
      if (g !== filters.grade && !fee.className?.includes(filters.grade)) {
        return false;
      }
    }

    if (filters.status && filters.status !== "all" && fee.status !== filters.status) {
      return false;
    }

    if (normSearch) {
      const matchName = (fee.studentName || "").toLowerCase().includes(normSearch);
      const matchReceipt = (fee.receiptNo || "").toLowerCase().includes(normSearch);
      const matchClass = (fee.className || "").toLowerCase().includes(normSearch);
      if (!matchName && !matchReceipt && !matchClass) {
        return false;
      }
    }

    return true;
  });
}
