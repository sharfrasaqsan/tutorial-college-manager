import { z } from "zod";
import type { ClassTerms } from "../types/index.ts";

export const MonthKeyRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

export const ClassTermsSchema = z
  .object({
    monthlyFee: z.number().min(0, "Monthly fee must be 0 or greater."),
    teacherSharePerStudent: z.number().min(0, "Teacher share must be 0 or greater."),
    requiredSessionsPerMonth: z.number().int().min(1, "Required sessions must be at least 1.").default(8),
    effectiveFromMonth: z.string().regex(MonthKeyRegex, "Effective month must be in YYYY-MM format."),
  })
  .refine((data) => data.teacherSharePerStudent <= data.monthlyFee, {
    message: "Teacher share per student cannot exceed the monthly class fee.",
    path: ["teacherSharePerStudent"],
  });

export const CreateClassSchema = z.object({
  yearId: z.string().min(4, "Academic year is required."),
  grade: z.string().trim().min(1, "Grade is required."),
  subject: z.string().trim().min(1, "Subject is required."),
  teacherId: z.string().trim().min(1, "Teacher assignment is required."),
  terms: ClassTermsSchema,
});

export const UpdateClassTermsSchema = z.object({
  monthlyFee: z.number().min(0, "Monthly fee must be 0 or greater."),
  teacherSharePerStudent: z.number().min(0, "Teacher share must be 0 or greater."),
  requiredSessionsPerMonth: z.number().int().min(1, "Required sessions must be at least 1.").default(8),
  effectiveFromMonth: z.string().regex(MonthKeyRegex, "Effective month must be in YYYY-MM format."),
}).refine((data) => data.teacherSharePerStudent <= data.monthlyFee, {
  message: "Teacher share per student cannot exceed the monthly class fee.",
  path: ["teacherSharePerStudent"],
});

export const BatchEnrollSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1, "At least one student must be selected."),
  joinedMonth: z.string().regex(MonthKeyRegex, "Joined month must be in YYYY-MM format."),
});

export type CreateClassInput = z.infer<typeof CreateClassSchema>;
export type UpdateClassTermsInput = z.infer<typeof UpdateClassTermsSchema>;
export type BatchEnrollInput = z.infer<typeof BatchEnrollSchema>;

/**
 * Generates official class name: e.g. "Grade 10 Maths"
 */
export function generateClassName(grade: string, subject: string): string {
  return `${grade.trim()} ${subject.trim()}`;
}

/**
 * Calculates owner share per student: monthlyFee - teacherSharePerStudent
 */
export function calculateOwnerShare(monthlyFee: number, teacherSharePerStudent: number): number {
  return Math.max(0, monthlyFee - teacherSharePerStudent);
}

/**
 * Validates that teacher share does not exceed monthly fee.
 */
export function validateClassTerms(
  monthlyFee: number,
  teacherSharePerStudent: number
): { valid: boolean; error?: string } {
  if (teacherSharePerStudent > monthlyFee) {
    return {
      valid: false,
      error: `Teacher share (LKR ${teacherSharePerStudent.toLocaleString()}) cannot exceed the monthly fee (LKR ${monthlyFee.toLocaleString()}).`,
    };
  }
  return { valid: true };
}

/**
 * Checks if a class with the same grade and subject already exists in the given year.
 */
export function checkDuplicateClass(
  existingClasses: Array<{ id: string; grade: string; subject: string }>,
  grade: string,
  subject: string,
  excludeClassId?: string
): { isDuplicate: boolean; error?: string } {
  const normGrade = grade.trim().toLowerCase();
  const normSubject = subject.trim().toLowerCase();

  const found = existingClasses.find(
    (c) =>
      c.id !== excludeClassId &&
      c.grade.trim().toLowerCase() === normGrade &&
      c.subject.trim().toLowerCase() === normSubject
  );

  if (found) {
    return {
      isDuplicate: true,
      error: `A class for ${grade} ${subject} already exists for this academic year.`,
    };
  }

  return { isDuplicate: false };
}

/**
 * Finds the effective class terms applicable for a given month (YYYY-MM).
 * Sorts terms by effectiveFromMonth ascending and picks the latest term whose
 * effectiveFromMonth is <= targetMonth. If all terms are after targetMonth,
 * returns the earliest available term.
 */
export function findEffectiveTermsForMonth<T extends { effectiveFromMonth: string }>(
  termsHistory: T[],
  targetMonth: string
): T {
  if (!termsHistory || termsHistory.length === 0) {
    throw new Error("No class terms available.");
  }

  const sorted = [...termsHistory].sort((a, b) =>
    a.effectiveFromMonth.localeCompare(b.effectiveFromMonth)
  );

  let effective = sorted[0];
  for (const term of sorted) {
    if (term.effectiveFromMonth <= targetMonth) {
      effective = term;
    } else {
      break;
    }
  }

  return effective;
}
