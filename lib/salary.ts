import type { SalaryStatus } from "../types/index.ts";

/**
 * Determine salary status based on sessions held and requirements:
 * Status onHold until sessions with status held and countsForMonth = that month reach the required count, then ready.
 * The owner pays and enters a deposit date, then paid. No proportional reduction.
 */
export function getSalaryStatus(
  sessionsHeld: number,
  sessionsRequired: number,
  isPaid: boolean
): SalaryStatus {
  if (isPaid) return "paid";
  if (sessionsHeld >= sessionsRequired) return "ready";
  return "onHold";
}

/**
 * One invoice per teacher per month (year + month), format SAL-YYYY-MM-NNN
 */
export function formatInvoiceNumber(
  year: number | string,
  month: number | string,
  sequence: number
): string {
  const yStr = String(year);
  const mNum = typeof month === "string" ? parseInt(month.split("-").pop() || "1", 10) : month;
  const mStr = String(mNum).padStart(2, "0");
  const seqStr = String(sequence).padStart(3, "0");
  return `SAL-${yStr}-${mStr}-${seqStr}`;
}
