import { test, describe } from "node:test";
import assert from "node:assert";
import {
  generateClassName,
  calculateOwnerShare,
  validateClassTerms,
  checkDuplicateClass,
  findEffectiveTermsForMonth,
  ClassTermsSchema,
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
});
