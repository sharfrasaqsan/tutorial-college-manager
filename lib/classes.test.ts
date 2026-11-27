import { test, describe } from "node:test";
import assert from "node:assert";
import {
  generateClassName,
  calculateOwnerShare,
  validateClassTerms,
  checkDuplicateClass,
  findEffectiveTermsForMonth,
  ClassTermsSchema,
  ClassScheduleSchema,
  CreateClassSchema,
  UpdateClassSchema,
} from "./classes.ts";

describe("Classes Domain & Term Versioning Logic", () => {
  test("generateClassName formats correctly", () => {
    assert.strictEqual(generateClassName("Grade 10", "Maths"), "Grade 10 Maths");
    assert.strictEqual(generateClassName("Grade 12", "Physics"), "Grade 12 Physics");
  });

  test("calculateOwnerShare returns fee minus teacher share", () => {
    assert.strictEqual(calculateOwnerShare(3000, 2000), 1000);
    assert.strictEqual(calculateOwnerShare(4500, 3000), 1500);
    assert.strictEqual(calculateOwnerShare(2000, 2000), 0);
  });

  test("validateClassTerms refuses teacher share greater than monthly fee", () => {
    const valid = validateClassTerms(3000, 2000);
    assert.strictEqual(valid.valid, true);

    const equal = validateClassTerms(2500, 2500);
    assert.strictEqual(equal.valid, true);

    const invalid = validateClassTerms(3000, 3500);
    assert.strictEqual(invalid.valid, false);
    assert.strictEqual(invalid.error?.includes("cannot exceed"), true);

    const zodInvalid = ClassTermsSchema.safeParse({
      monthlyFee: 3000,
      teacherSharePerStudent: 3200,
      requiredSessionsPerMonth: 8,
      effectiveFromMonth: "2026-01",
    });
    assert.strictEqual(zodInvalid.success, false);
  });

  test("checkDuplicateClass refuses duplicate grade and subject in same year", () => {
    const existing = [
      { id: "c1", grade: "Grade 10", subject: "Maths" },
      { id: "c2", grade: "Grade 10", subject: "Science" },
      { id: "c3", grade: "Grade 11", subject: "Maths" },
    ];

    // Duplicate Grade 10 Maths
    const dup = checkDuplicateClass(existing, "Grade 10", "Maths");
    assert.strictEqual(dup.isDuplicate, true);
    assert.strictEqual(dup.error?.includes("already exists"), true);

    // Case-insensitive duplicate
    const dupCase = checkDuplicateClass(existing, "grade 10", "maths");
    assert.strictEqual(dupCase.isDuplicate, true);

    // New combination allowed
    const validNew = checkDuplicateClass(existing, "Grade 11", "Science");
    assert.strictEqual(validNew.isDuplicate, false);

    // Updating existing class with its own id allowed
    const selfUpdate = checkDuplicateClass(existing, "Grade 10", "Maths", "c1");
    assert.strictEqual(selfUpdate.isDuplicate, false);

    // With teacher attribution
    const existingWithTeachers = [
      { id: "c1", grade: "Grade 10", subject: "Maths", teacherId: "t1", teacherName: "Mr. Perera" },
    ];
    const dupWithTeacher = checkDuplicateClass(existingWithTeachers, "Grade 10", "Maths", undefined, "t1");
    assert.strictEqual(dupWithTeacher.isDuplicate, true);
    assert.strictEqual(dupWithTeacher.error?.includes("assigned to Mr. Perera"), true);
    assert.strictEqual(dupWithTeacher.matchedClass?.teacherName, "Mr. Perera");
  });

  test("findEffectiveTermsForMonth correctly versions terms across months", () => {
    const termsHistory = [
      {
        effectiveFromMonth: "2026-01",
        monthlyFee: 3000,
        teacherSharePerStudent: 2000,
        requiredSessionsPerMonth: 8,
      },
      {
        effectiveFromMonth: "2026-04",
        monthlyFee: 3500,
        teacherSharePerStudent: 2400,
        requiredSessionsPerMonth: 8,
      },
      {
        effectiveFromMonth: "2026-09",
        monthlyFee: 4000,
        teacherSharePerStudent: 2800,
        requiredSessionsPerMonth: 10,
      },
    ];

    // Months before April keep the Jan term
    const janTerms = findEffectiveTermsForMonth(termsHistory, "2026-01");
    assert.strictEqual(janTerms.monthlyFee, 3000);
    assert.strictEqual(janTerms.teacherSharePerStudent, 2000);

    const marTerms = findEffectiveTermsForMonth(termsHistory, "2026-03");
    assert.strictEqual(marTerms.monthlyFee, 3000);
    assert.strictEqual(marTerms.teacherSharePerStudent, 2000);

    // From April onwards, the April term takes effect
    const aprTerms = findEffectiveTermsForMonth(termsHistory, "2026-04");
    assert.strictEqual(aprTerms.monthlyFee, 3500);
    assert.strictEqual(aprTerms.teacherSharePerStudent, 2400);

    const julTerms = findEffectiveTermsForMonth(termsHistory, "2026-07");
    assert.strictEqual(julTerms.monthlyFee, 3500);

    // From September onwards, the September term takes effect
    const sepTerms = findEffectiveTermsForMonth(termsHistory, "2026-09");
    assert.strictEqual(sepTerms.monthlyFee, 4000);
    assert.strictEqual(sepTerms.requiredSessionsPerMonth, 10);

    const decTerms = findEffectiveTermsForMonth(termsHistory, "2026-12");
    assert.strictEqual(decTerms.monthlyFee, 4000);
  });

  test("ClassScheduleSchema validates weekday and time range", () => {
    // Valid schedule
    const valid = ClassScheduleSchema.safeParse({
      weekday: 6,
      startTime: "08:30",
      endTime: "10:30",
    });
    assert.strictEqual(valid.success, true);

    // Invalid: end time before start time
    const invalidTimes = ClassScheduleSchema.safeParse({
      weekday: 6,
      startTime: "11:00",
      endTime: "09:00",
    });
    assert.strictEqual(invalidTimes.success, false);

    // Invalid: weekday out of range
    const invalidWeekday = ClassScheduleSchema.safeParse({
      weekday: 7,
      startTime: "08:30",
      endTime: "10:30",
    });
    assert.strictEqual(invalidWeekday.success, false);

    // Invalid: malformed time string
    const invalidFormat = ClassScheduleSchema.safeParse({
      weekday: 2,
      startTime: "8:30",
      endTime: "10:30",
    });
    assert.strictEqual(invalidFormat.success, false);
  });

  test("CreateClassSchema accepts optional schedule and validates input", () => {
    const withSchedule = CreateClassSchema.safeParse({
      yearId: "2026",
      grade: "Grade 11",
      subject: "Science",
      teacherId: "teacher-123",
      terms: {
        monthlyFee: 3500,
        teacherSharePerStudent: 2500,
        requiredSessionsPerMonth: 8,
        effectiveFromMonth: "2026-01",
      },
      schedule: {
        weekday: 5,
        startTime: "14:00",
        endTime: "16:00",
      },
    });
    assert.strictEqual(withSchedule.success, true);

    const withoutSchedule = CreateClassSchema.safeParse({
      yearId: "2026",
      grade: "Grade 11",
      subject: "Commerce",
      teacherId: "teacher-456",
      terms: {
        monthlyFee: 3000,
        teacherSharePerStudent: 2000,
        requiredSessionsPerMonth: 8,
        effectiveFromMonth: "2026-01",
      },
    });
    assert.strictEqual(withoutSchedule.success, true);
  });

  test("UpdateClassSchema validates partial updates including schedule", () => {
    const validUpdate = UpdateClassSchema.safeParse({
      grade: "Grade 12",
      subject: "Combined Maths",
      teacherId: "teacher-789",
      schedule: {
        weekday: 0, // Sunday
        startTime: "08:00",
        endTime: "11:00",
      },
    });
    assert.strictEqual(validUpdate.success, true);
  });

  test("CreateClassSchema accepts multiple weekly sessions (schedules array)", () => {
    const withMultipleSchedules = CreateClassSchema.safeParse({
      yearId: "2026",
      grade: "Grade 10",
      subject: "Science",
      teacherId: "teacher-101",
      terms: {
        monthlyFee: 4000,
        teacherSharePerStudent: 3000,
        requiredSessionsPerMonth: 8,
        effectiveFromMonth: "2026-01",
      },
      schedules: [
        {
          weekday: 1, // Monday
          startTime: "15:00",
          endTime: "17:00",
        },
        {
          weekday: 3, // Wednesday
          startTime: "15:00",
          endTime: "17:00",
        },
      ],
    });
    assert.strictEqual(withMultipleSchedules.success, true);
    if (withMultipleSchedules.success) {
      assert.strictEqual(withMultipleSchedules.data.schedules?.length, 2);
    }
  });

  test("WEEKDAY_ORDER places Monday as 1st day of the week", async () => {
    const { WEEKDAY_ORDER } = await import("./dates.ts");
    assert.strictEqual(WEEKDAY_ORDER[0].name, "Monday");
    assert.strictEqual(WEEKDAY_ORDER[0].index, 1);
    assert.strictEqual(WEEKDAY_ORDER[6].name, "Sunday");
    assert.strictEqual(WEEKDAY_ORDER[6].index, 0);
  });
});
