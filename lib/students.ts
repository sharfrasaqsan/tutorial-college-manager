import { z } from "zod";
import type { Student, StudentAdmissionFee } from "../types/index.ts";

export const AdmissionFeeSchema = z.object({
  amount: z.number().min(0, "Admission fee amount must be 0 or greater.").default(0),
  status: z.enum(["unpaid", "paid", "notApplicable"]).default("unpaid"),
  method: z.enum(["cash", "bank"]).optional(),
  paidDate: z.string().optional().or(z.literal("")),
  receiptNo: z.string().trim().optional().or(z.literal("")),
});

export const CreateStudentSchema = z.object({
  name: z.string().trim().min(2, "Full name must be at least 2 characters."),
  school: z.string().trim().min(1, "School name is required."),
  address: z.string().trim().min(1, "Address is required."),
  guardianName: z.string().trim().min(2, "Guardian name is required."),
  guardianPhone: z.string().trim().min(7, "Valid guardian phone number is required."),
  studentPhone: z.string().trim().optional().or(z.literal("")),
  grade: z.string().trim().min(1, "Grade for the selected year is required."),
  yearId: z.string().trim().min(4, "Academic year is required."),
  admissionFee: AdmissionFeeSchema.default({
    amount: 0,
    status: "unpaid",
  }),
});

export const UpdateStudentSchema = z.object({
  name: z.string().trim().min(2, "Full name must be at least 2 characters."),
  school: z.string().trim().min(1, "School name is required."),
  address: z.string().trim().min(1, "Address is required."),
  guardianName: z.string().trim().min(2, "Guardian name is required."),
  guardianPhone: z.string().trim().min(7, "Valid guardian phone number is required."),
  studentPhone: z.string().trim().optional().or(z.literal("")),
  grade: z.string().trim().min(1, "Grade for the selected year is required."),
  yearId: z.string().trim().min(4, "Academic year is required."),
  admissionFee: AdmissionFeeSchema,
  // If the client attempts to send joinedAt in the request, Zod may receive it,
  // but protectStudentJoinedAt MUST guarantee it is never overwritten!
  joinedAt: z.string().optional(),
});

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;
export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;

/**
 * Server-side guard to guarantee student's joinedAt is permanent and immutable.
 * Even if an attacker or crafted request includes a modified joinedAt, this function
 * ensures the original joinedAt date is strictly preserved.
 */
export function protectStudentJoinedAt(
  existingStudent: Pick<Student, "joinedAt">,
  incomingData: Partial<Student>
): string {
  if (!existingStudent || !existingStudent.joinedAt) {
    throw new Error("Existing student record must possess an immutable joinedAt timestamp.");
  }
  return existingStudent.joinedAt;
}

/**
 * Client/server search and filter helper for students list.
 */
export function filterStudents(
  students: Array<Student & { grade?: string }>,
  query: string,
  gradeFilter?: string
): Array<Student & { grade?: string }> {
  const normalizedQuery = query.trim().toLowerCase();

  return students.filter((s) => {
    // Grade filter
    if (gradeFilter && gradeFilter !== "all") {
      if (s.grade !== gradeFilter) {
        return false;
      }
    }

    // Search query: match student name, school, guardian name, or phone
    if (!normalizedQuery) return true;

    const matchesName = s.name.toLowerCase().includes(normalizedQuery);
    const matchesSchool = s.school.toLowerCase().includes(normalizedQuery);
    const matchesGuardian = s.guardianName.toLowerCase().includes(normalizedQuery);
    const matchesPhone =
      (s.guardianPhone && s.guardianPhone.toLowerCase().includes(normalizedQuery)) ||
      (s.studentPhone && s.studentPhone.toLowerCase().includes(normalizedQuery));

    return matchesName || matchesSchool || matchesGuardian || matchesPhone;
  });
}
