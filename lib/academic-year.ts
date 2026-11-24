import type { AcademicGrade, AcademicYear } from "@/types";

export const YEAR_COOKIE_NAME = "tcm_year";

/**
 * Determine if a student in the specified grade graduates into the Finished list
 */
export function isGraduatingGrade(gradeName: string, grades: AcademicGrade[]): boolean {
  if (!gradeName) return false;
  if (gradeName.toLowerCase().includes("13") || gradeName.toLowerCase().includes("finished")) {
    return true;
  }
  const sorted = [...grades].sort((a, b) => a.order - b.order);
  const highestGrade = sorted[sorted.length - 1];
  return Boolean(highestGrade && highestGrade.name.toLowerCase() === gradeName.toLowerCase());
}

/**
 * Compute next grade level (previous grade + 1)
 */
export function getNextGrade(currentGradeName: string, grades: AcademicGrade[]): string {
  const sorted = [...grades].sort((a, b) => a.order - b.order);
  const currentIdx = sorted.findIndex(
    (g) => g.name.toLowerCase() === currentGradeName.toLowerCase()
  );

  if (currentIdx !== -1 && currentIdx + 1 < sorted.length) {
    return sorted[currentIdx + 1].name;
  }

  // Fallback to numeric increment
  const numMatch = currentGradeName.match(/\d+/);
  if (numMatch) {
    const nextNum = parseInt(numMatch[0], 10) + 1;
    return `Grade ${nextNum}`;
  }

  return `${currentGradeName} (Advanced)`;
}

/**
 * Validates whether promotion can be run for a year
 */
export function validatePromotionEligibility(
  fromYear: AcademicYear | null | undefined,
  toYearId: string
): { eligible: boolean; error?: string } {
  if (!fromYear) {
    return { eligible: false, error: "Source academic year does not exist." };
  }

  if (fromYear.promotedToYear) {
    return {
      eligible: false,
      error: `Academic year ${fromYear.id} has already promoted to ${fromYear.promotedToYear}. Promotion cannot run twice.`,
    };
  }

  const fromNum = parseInt(fromYear.id, 10);
  const toNum = parseInt(toYearId, 10);
  if (toNum !== fromNum + 1) {
    return {
      eligible: false,
      error: `Target year (${toYearId}) must directly follow source year (${fromYear.id}).`,
    };
  }

  return { eligible: true };
}
