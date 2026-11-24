import { z } from "zod";
import { adminDb } from "./firebase-admin.ts";
import type { SalaryStatus, SalaryClassSummary } from "../types/index.ts";

export const MonthKeyRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Determine salary status based on sessions held and requirements:
 * Status onHold until sessions with status held and countsForMonth = that month reach the required count, then ready.
 * The owner pays and enters a deposit date, then paid. No proportional reduction.
 */
export function getSalaryStatus(
  sessionsHeld: number,
  sessionsRequired: number,
  isPaid = false
): SalaryStatus {
  if (isPaid) return "paid";
  if (sessionsHeld >= sessionsRequired) return "ready";
  return "onHold";
}

/**
 * Formats invoice number: SAL-YYYY-MM-NNN
 */
export function formatInvoiceNumber(
  year: number | string,
  month: number | string,
  sequence: number
): string {
  const yStr = String(year).slice(0, 4);
  const mNum = typeof month === "string" ? parseInt(month.split("-").pop() || "1", 10) : month;
  const mStr = String(mNum).padStart(2, "0");
  const seqStr = String(sequence).padStart(3, "0");
  return `SAL-${yStr}-${mStr}-${seqStr}`;
}

/**
 * Formats canonical salary doc ID: `years/{year}/salaries/{teacherId}_{classId}_{YYYY-MM}`
 */
export function generateSalaryDocId(
  teacherId: string,
  classId: string,
  month: string
): string {
  return `${teacherId}_${classId}_${month}`;
}

/**
 * Formats salary display name: e.g. "2026 November, Grade 10 Maths"
 */
export function generateSalaryDisplayName(month: string, className: string): string {
  const [yStr, mStr] = month.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const date = new Date(y, m - 1, 1);
  const monthName = date.toLocaleDateString("en-US", { month: "long" });
  return `${y} ${monthName}, ${className.trim()}`;
}

/**
 * Calculates salary amount for a class in a given month:
 * Amount = sum of teacherShare of that month fee records for the class,
 * based on ENROLLED students and NOT on who paid.
 */
export function calculateSalaryAmount(
  feeRecords: Array<{ teacherShare: number }>
): number {
  return feeRecords.reduce((acc, f) => acc + (f.teacherShare || 0), 0);
}

/**
 * Transactional counter for salary invoices: SAL-YYYY-MM-NNN
 */
export async function getNextInvoiceNo(yearId: string, month: string): Promise<string> {
  const counterRef = adminDb.collection("years").doc(yearId).collection("counters").doc("invoices");
  return await adminDb.runTransaction(async (t) => {
    const doc = await t.get(counterRef);
    let nextSeq = 1;
    if (doc.exists) {
      nextSeq = (doc.data()?.lastSequence || 0) + 1;
    }
    t.set(counterRef, { lastSequence: nextSeq, updatedAt: new Date().toISOString() }, { merge: true });
    return formatInvoiceNumber(yearId, month, nextSeq);
  });
}

export const PayTeacherSchema = z.object({
  teacherId: z.string().trim().min(1, "Teacher selection is required."),
  month: z.string().regex(MonthKeyRegex, "Month must be in YYYY-MM format."),
  classIds: z.array(z.string().min(1)).min(1, "At least one ready class must be selected."),
  depositDate: z.string().min(1, "Deposit date is required."),
  paymentMethod: z.enum(["bank", "cash", "cheque"]).default("bank"),
});

export type PayTeacherInput = z.infer<typeof PayTeacherSchema>;
