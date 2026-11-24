/**
 * Money utilities for Sri Lanka (LKR)
 * Formatting rules:
 * - Currency prefix "LKR "
 * - Thousands separator with commas
 * - No decimals unless fraction is non-zero
 * - Tabular numbers friendly
 */

export function formatLKR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "LKR 0";
  }

  const isWhole = Math.round(amount) === amount;
  const formatted = new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `LKR ${formatted}`;
}

export function parseLKR(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]+/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function calculateClassSalaryTotal(teacherSharePerStudent: number, studentCount: number): number {
  return teacherSharePerStudent * studentCount;
}
