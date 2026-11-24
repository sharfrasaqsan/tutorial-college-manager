import { test, describe } from "node:test";
import assert from "node:assert";
import { protectStudentJoinedAt, filterStudents, CreateStudentSchema, UpdateStudentSchema } from "./students.ts";

describe("Student Domain & Immutability Rules", () => {
  test("protectStudentJoinedAt strictly preserves original joinedAt even with crafted overwrite payload", () => {
    const originalDate = "2024-01-15T08:30:00.000Z";
    const existingStudent = {
      joinedAt: originalDate,
    };

    const maliciousPayload = {
      name: "Updated Name",
      joinedAt: "1999-12-31T23:59:59.000Z", // Attempt to forge joinedAt
    };

    const securedJoinedAt = protectStudentJoinedAt(existingStudent, maliciousPayload);
    assert.strictEqual(securedJoinedAt, originalDate);
    assert.notStrictEqual(securedJoinedAt, maliciousPayload.joinedAt);
  });

  test("CreateStudentSchema validates mandatory fields and defaults admission fee to unpaid", () => {
    const parsed = CreateStudentSchema.safeParse({
      name: "Kasun Perera",
      school: "Ananda College",
      address: "123 Galle Road, Colombo 03",
      guardianName: "Sunil Perera",
      guardianPhone: "0771234567",
      grade: "Grade 10",
      yearId: "2026",
    });

    assert.strictEqual(parsed.success, true);
    if (parsed.success) {
      assert.strictEqual(parsed.data.admissionFee.status, "unpaid");
      assert.strictEqual(parsed.data.admissionFee.amount, 0);
    }
  });

  test("filterStudents filters by search query across name, school, guardian, and phone", () => {
    const students = [
      {
        id: "s1",
        name: "Amal Silva",
        school: "Royal College",
        address: "Colombo",
        guardianName: "Kamal Silva",
        guardianPhone: "0711111111",
        joinedAt: "2026-01-01T00:00:00Z",
        admissionFee: { amount: 2000, status: "paid" as const },
        gradesByYear: { "2026": "Grade 10" },
        grade: "Grade 10",
        active: true,
      },
      {
        id: "s2",
        name: "Nimal Fernando",
        school: "St. Thomas College",
        address: "Mt. Lavinia",
        guardianName: "Sunil Fernando",
        guardianPhone: "0772222222",
        joinedAt: "2026-01-02T00:00:00Z",
        admissionFee: { amount: 2000, status: "unpaid" as const },
        gradesByYear: { "2026": "Grade 11" },
        grade: "Grade 11",
        active: true,
      },
      {
        id: "s3",
        name: "Ruwan Perera",
        school: "Ananda College",
        address: "Maradana",
        guardianName: "Gamini Perera",
        guardianPhone: "0753333333",
        studentPhone: "0764444444",
        joinedAt: "2026-01-03T00:00:00Z",
        admissionFee: { amount: 0, status: "notApplicable" as const },
        gradesByYear: { "2026": "Grade 10" },
        grade: "Grade 10",
        active: true,
      },
    ];

    // Search by name
    const byName = filterStudents(students, "amal");
    assert.strictEqual(byName.length, 1);
    assert.strictEqual(byName[0].id, "s1");

    // Search by school
    const bySchool = filterStudents(students, "ananda");
    assert.strictEqual(bySchool.length, 1);
    assert.strictEqual(bySchool[0].id, "s3");

    // Search by student phone
    const byPhone = filterStudents(students, "0764444444");
    assert.strictEqual(byPhone.length, 1);
    assert.strictEqual(byPhone[0].id, "s3");

    // Grade filter
    const grade10Only = filterStudents(students, "", "Grade 10");
    assert.strictEqual(grade10Only.length, 2);

    const grade11Only = filterStudents(students, "", "Grade 11");
    assert.strictEqual(grade11Only.length, 1);
    assert.strictEqual(grade11Only[0].id, "s2");

    // Both query and grade filter
    const filteredBoth = filterStudents(students, "perera", "Grade 10");
    assert.strictEqual(filteredBoth.length, 1);
    assert.strictEqual(filteredBoth[0].id, "s3");
  });
});
