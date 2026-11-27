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
  enrolledClassIds: z.array(z.string()).optional().default([]),
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
  enrolledClassIds: z.array(z.string()).optional(),
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

/**
 * Short letter abbreviation for curriculum subjects (e.g. English -> Eng, Maths -> Mat).
 * Handles common school subjects, strips optional grade prefixes, and formats fallback abbreviations.
 */
export function formatSubjectShort(subject: string): string {
  if (!subject) return "";
  // Strip leading grade prefix if present (e.g. "Grade 06 English" -> "English")
  const s = subject.replace(/^Grade\s+\d+\s*[-–—:]*\s*/i, "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();

  // Primary curriculum mappings
  if (lower.startsWith("math") || lower.includes("mathematics") || lower === "combined maths" || lower === "pure maths") return "Mat";
  if (lower.startsWith("eng")) return "Eng";
  if (lower.startsWith("sci") && !lower.startsWith("soc")) return "Sci";
  if (lower.includes("ict") || lower.includes("information tech") || lower.includes("computer")) return "ICT";
  if (lower.startsWith("sinh")) return "Sin";
  if (lower.startsWith("tami")) return "Tam";
  if (lower.startsWith("hist")) return "His";
  if (lower.startsWith("geog")) return "Geo";
  if (lower.startsWith("comm")) return "Com";
  if (lower.startsWith("econ")) return "Eco";
  if (lower.startsWith("acc")) return "Acc";
  if (lower.startsWith("bus") || lower === "bs") return "BS";
  if (lower.startsWith("phys")) return "Phy";
  if (lower.startsWith("chem")) return "Che";
  if (lower.startsWith("bio")) return "Bio";
  if (lower.startsWith("budd")) return "Bud";
  if (lower.startsWith("chri")) return "Chr";
  if (lower.startsWith("isla")) return "Isl";
  if (lower.startsWith("hind")) return "Hin";
  if (lower.startsWith("art")) return "Art";
  if (lower.startsWith("musi")) return "Mus";
  if (lower.startsWith("dram")) return "Dra";
  if (lower.startsWith("danc")) return "Dan";
  if (lower.startsWith("heal") || lower.includes("hpe")) return "HPE";
  if (lower.startsWith("civi")) return "Civ";
  if (lower.startsWith("medi")) return "Med";
  if (lower.startsWith("agri")) return "Agr";
  if (lower.startsWith("logi")) return "Log";
  if (lower.startsWith("poli")) return "Pol";
  if (lower.startsWith("fren")) return "Fre";
  if (lower.startsWith("japa")) return "Jap";
  if (lower.startsWith("germ")) return "Ger";

  // If already short (e.g. "IT", "PE", "BS")
  if (s.length <= 3) return s.toUpperCase();
  // Standard fallback: Title-cased first 3 letters
  return s.slice(0, 1).toUpperCase() + s.slice(1, 3).toLowerCase();
}

/**
 * Returns a deduplicated, clean list of short subject abbreviations for a student's enrolled subjects.
 * Strictly prevents duplicates even if multiple classes share a subject (e.g. Maths A and Maths B)
 * or if differing subject strings map to the same abbreviation (e.g. "Mathematics" and "Maths").
 */
export function getDeduplicatedSubjectAbbreviations(subjects?: string[]): string[] {
  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const subj of subjects) {
    const abbr = formatSubjectShort(subj);
    if (abbr && !seen.has(abbr)) {
      seen.add(abbr);
      result.push(abbr);
    }
  }

  return result;
}
