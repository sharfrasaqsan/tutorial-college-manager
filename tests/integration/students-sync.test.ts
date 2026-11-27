import { describe, it, expect } from "vitest";
import { CreateStudentSchema, filterStudents, protectStudentJoinedAt } from "@/lib/students";
import type { Student } from "@/types";

describe("Integration: Student Management & Immutability Sync", () => {
  it("validates required student fields and defaults admission fee to unpaid", () => {
    const validStudent = {
      name: "Kasun Jayasuriya",
      grade: "Grade 08",
      school: "Royal College",
      address: "123 Galle Road, Colombo",
      guardianName: "Sunil Jayasuriya",
      guardianPhone: "0779876543",
      yearId: "2027",
    };

    const parsed = CreateStudentSchema.safeParse(validStudent);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.admissionFee.status).toBe("unpaid");
      expect(parsed.data.admissionFee.amount).toBe(0);
    }
  });

  it("fails validation when student name or grade is missing", () => {
    const missingName = {
      grade: "Grade 08",
      school: "Royal College",
      address: "Colombo",
      guardianName: "Sunil",
      guardianPhone: "0771234567",
      yearId: "2027",
    };
    expect(CreateStudentSchema.safeParse(missingName).success).toBe(false);

    const missingGrade = {
      name: "Kasun Jayasuriya",
      school: "Royal College",
      address: "Colombo",
      guardianName: "Sunil",
      guardianPhone: "0771234567",
      yearId: "2027",
    };
    expect(CreateStudentSchema.safeParse(missingGrade).success).toBe(false);
  });

  it("protects student joinedAt timestamp against overwrite tampering", () => {
    const existingStudent = {
      joinedAt: "2027-01-10T08:00:00.000Z",
    };
    const maliciousUpdatePayload = {
      name: "Kasun Jayasuriya (Updated)",
      joinedAt: "2027-06-01T00:00:00.000Z", // Attempted overwrite!
    };

    const preservedJoinedAt = protectStudentJoinedAt(existingStudent, maliciousUpdatePayload);
    expect(preservedJoinedAt).toBe(existingStudent.joinedAt);
  });

  it("filters students across name, school, guardian, and guardian phone", () => {
    const students: Student[] = [
      {
        id: "s1",
        name: "Nimal Perera",
        grade: "Grade 06",
        school: "Ananda College",
        address: "Colombo",
        guardianName: "Sunil Perera",
        guardianPhone: "0771111111",
        joinedAt: "2027-01-01",
        admissionFee: { amount: 0, status: "unpaid" },
        gradesByYear: { "2027": "Grade 06" },
        active: true,
      },
      {
        id: "s2",
        name: "Kamal Fernando",
        grade: "Grade 07",
        school: "Nalanda College",
        address: "Colombo",
        guardianName: "Gamini Fernando",
        guardianPhone: "0772222222",
        joinedAt: "2027-01-01",
        admissionFee: { amount: 0, status: "paid" },
        gradesByYear: { "2027": "Grade 07" },
        active: true,
      },
    ];

    // Search by school
    const bySchool = filterStudents(students, "nalanda");
    expect(bySchool).toHaveLength(1);
    expect(bySchool[0].name).toBe("Kamal Fernando");

    // Search by guardian
    const byGuardian = filterStudents(students, "Sunil");
    expect(byGuardian).toHaveLength(1);
    expect(byGuardian[0].name).toBe("Nimal Perera");

    // Filter by grade
    const grade7 = filterStudents(students, "", "Grade 07");
    expect(grade7).toHaveLength(1);
    expect(grade7[0].name).toBe("Kamal Fernando");
  });
});
