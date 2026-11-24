import { test, describe } from "node:test";
import assert from "node:assert";
import {
  isGraduatingGrade,
  getNextGrade,
  validatePromotionEligibility,
} from "./academic-year.ts";
import type { AcademicGrade, AcademicYear } from "../types/index.ts";

describe("Academic Year & Student Promotion Logic", () => {
  const grades: AcademicGrade[] = [
    { id: "g9", name: "Grade 9", order: 9, hidden: false },
    { id: "g10", name: "Grade 10", order: 10, hidden: false },
    { id: "g11", name: "Grade 11", order: 11, hidden: false },
    { id: "g12", name: "Grade 12", order: 12, hidden: false },
    { id: "g13", name: "Grade 13", order: 13, hidden: false },
  ];

  test("getNextGrade advances student by exactly 1 grade tier", () => {
    assert.strictEqual(getNextGrade("Grade 10", grades), "Grade 11");
    assert.strictEqual(getNextGrade("Grade 11", grades), "Grade 12");
    assert.strictEqual(getNextGrade("Grade 9", grades), "Grade 10");
  });

  test("isGraduatingGrade identifies Grade 13 students for the Finished list", () => {
    assert.strictEqual(isGraduatingGrade("Grade 13", grades), true);
    assert.strictEqual(isGraduatingGrade("Grade 13 Maths", grades), true);
    assert.strictEqual(isGraduatingGrade("Grade 10", grades), false);
    assert.strictEqual(isGraduatingGrade("Grade 12", grades), false);
  });

  test("validatePromotionEligibility allows promotion to direct sequential year", () => {
    const year2026: AcademicYear = {
      id: "2026",
      name: "2026",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const result = validatePromotionEligibility(year2026, "2027");
    assert.strictEqual(result.eligible, true);
    assert.strictEqual(result.error, undefined);
  });

  test("validatePromotionEligibility refuses a second run for the same year", () => {
    const year2026AlreadyPromoted: AcademicYear = {
      id: "2026",
      name: "2026",
      status: "active",
      promotedToYear: "2027",
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const result = validatePromotionEligibility(year2026AlreadyPromoted, "2027");
    assert.strictEqual(result.eligible, false);
    assert.match(result.error || "", /cannot run twice/);
  });

  test("validatePromotionEligibility rejects non-sequential target years", () => {
    const year2026: AcademicYear = {
      id: "2026",
      name: "2026",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const result = validatePromotionEligibility(year2026, "2029");
    assert.strictEqual(result.eligible, false);
    assert.match(result.error || "", /must directly follow/);
  });
});
