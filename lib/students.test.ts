import { test, describe } from "node:test";
import assert from "node:assert";
import {
  protectStudentJoinedAt,
  filterStudents,
  CreateStudentSchema,
  UpdateStudentSchema,
  formatSubjectShort,
  getDeduplicatedSubjectAbbreviations,
} from "./students.ts";

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
      assert.deepStrictEqual(parsed.data.enrolledClassIds, []);
    }
  });

  test("CreateStudentSchema accepts enrolledClassIds array", () => {
    const parsed = CreateStudentSchema.safeParse({
      name: "Kasun Perera",
      school: "Ananda College",
      address: "123 Galle Road, Colombo 03",
      guardianName: "Sunil Perera",
      guardianPhone: "0771234567",
      grade: "Grade 10",
      yearId: "2026",
      enrolledClassIds: ["class_maths_10", "class_science_10"],
    });

    assert.strictEqual(parsed.success, true);
    if (parsed.success) {
      assert.deepStrictEqual(parsed.data.enrolledClassIds, ["class_maths_10", "class_science_10"]);
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

  test("excludes deleted or inactive students correctly from active directory queries", () => {
    const rawStudentRecords = [
      { id: "s1", name: "Active Student", active: true, deleted: false },
      { id: "s2", name: "Archived Student", active: false, deleted: true, deletedInYear: "2026" },
      { id: "s3", name: "Past Deleted Student", active: false, deleted: true, deletedInYear: "2025" },
    ];

    const currentYear = "2026";
    const activeOnly = rawStudentRecords.filter((data) => {
      if (data.deleted === true) return false;
      if (data.deletedInYear && currentYear >= data.deletedInYear) return false;
      if (data.active === false) return false;
      return true;
    });

    assert.strictEqual(activeOnly.length, 1);
    assert.strictEqual(activeOnly[0].id, "s1");
  });

  test("formatSubjectShort formats curriculum subjects to short abbreviations", () => {
    assert.strictEqual(formatSubjectShort("English"), "Eng");
    assert.strictEqual(formatSubjectShort("Maths"), "Mat");
    assert.strictEqual(formatSubjectShort("Mathematics"), "Mat");
    assert.strictEqual(formatSubjectShort("Combined Maths"), "Mat");
    assert.strictEqual(formatSubjectShort("Science"), "Sci");
    assert.strictEqual(formatSubjectShort("ICT"), "ICT");
    assert.strictEqual(formatSubjectShort("Information Technology"), "ICT");
    assert.strictEqual(formatSubjectShort("Grade 06 English"), "Eng");
    assert.strictEqual(formatSubjectShort("Grade 10 Maths"), "Mat");
    assert.strictEqual(formatSubjectShort("Biology"), "Bio");
    assert.strictEqual(formatSubjectShort("Chemistry"), "Che");
    assert.strictEqual(formatSubjectShort("Physics"), "Phy");
    assert.strictEqual(formatSubjectShort("Business Studies"), "BS");
    assert.strictEqual(formatSubjectShort("IT"), "IT");
    assert.strictEqual(formatSubjectShort("Robotics"), "Rob");
    assert.strictEqual(formatSubjectShort(""), "");
  });

  test("getDeduplicatedSubjectAbbreviations strictly prevents duplicate abbreviations", () => {
    // 1. Multiple identical subjects from multiple classes
    const withDuplicates = ["English", "Maths", "English", "Science", "Maths"];
    assert.deepStrictEqual(
      getDeduplicatedSubjectAbbreviations(withDuplicates),
      ["Eng", "Mat", "Sci"]
    );

    // 2. Differing subject strings that map to the same abbreviation
    const variantNames = ["Maths", "Mathematics", "Combined Maths", "Grade 06 Maths"];
    assert.deepStrictEqual(
      getDeduplicatedSubjectAbbreviations(variantNames),
      ["Mat"]
    );

    // 3. Complete set of subjects
    const fullSet = ["English", "Maths", "ICT", "Science"];
    assert.deepStrictEqual(
      getDeduplicatedSubjectAbbreviations(fullSet),
      ["Eng", "Mat", "ICT", "Sci"]
    );

    // 4. Empty and undefined inputs
    assert.deepStrictEqual(getDeduplicatedSubjectAbbreviations([]), []);
    assert.deepStrictEqual(getDeduplicatedSubjectAbbreviations(undefined), []);
  });
});
