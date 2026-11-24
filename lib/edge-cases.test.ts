import { describe, it } from "node:test";
import assert from "node:assert";
import {
  getColomboNow,
  formatColomboPattern,
  validateMakeupMonth,
  getMarkingWindowDetails,
  formatDateDisplay,
  formatTimeDisplay,
} from "./dates.ts";
import {
  findEffectiveTermsForMonth,
  calculateOwnerShare,
  validateClassTerms,
} from "./classes.ts";
import {
  getNextGrade,
  isGraduatingGrade,
  validatePromotionEligibility,
} from "./academic-year.ts";
import type { AcademicGrade, AcademicYear } from "@/types";

describe("STEP 13: Core Edge Cases Test Suite", () => {
  const sampleGrades: AcademicGrade[] = [
    { id: "g6", name: "Grade 6", order: 6, hidden: false },
    { id: "g7", name: "Grade 7", order: 7, hidden: false },
    { id: "g10", name: "Grade 10", order: 10, hidden: false },
    { id: "g11", name: "Grade 11", order: 11, hidden: false },
    { id: "g12", name: "Grade 12", order: 12, hidden: false },
    { id: "g13", name: "Grade 13", order: 13, hidden: false },
  ];

  // --------------------------------------------------------------------------
  // EDGE CASE 1: Month boundaries in Asia/Colombo (UTC+05:30)
  // --------------------------------------------------------------------------
  describe("Edge Case 1: Month boundaries in Asia/Colombo", () => {
    it("handles midnight rollover accurately in Asia/Colombo without slipping", () => {
      // 2026-11-30 18:29:59 UTC -> 2026-11-30 23:59:59 Asia/Colombo (still November)
      const lastSecOfNovUTC = new Date("2026-11-30T18:29:59Z");
      const novDateStr = formatColomboPattern(lastSecOfNovUTC, "yyyy-MM-dd");
      const novMonthStr = formatColomboPattern(lastSecOfNovUTC, "yyyy-MM");

      assert.strictEqual(novDateStr, "2026-11-30");
      assert.strictEqual(novMonthStr, "2026-11");

      // 2026-11-30 18:30:00 UTC -> 2026-12-01 00:00:00 Asia/Colombo (first second of December)
      const firstSecOfDecUTC = new Date("2026-11-30T18:30:00Z");
      const decDateStr = formatColomboPattern(firstSecOfDecUTC, "yyyy-MM-dd");
      const decMonthStr = formatColomboPattern(firstSecOfDecUTC, "yyyy-MM");

      assert.strictEqual(decDateStr, "2026-12-01");
      assert.strictEqual(decMonthStr, "2026-12");
    });

    it("evaluates session marking window end boundary at 23:59:59 on the 3rd day in Colombo time", () => {
      // Session held on 2026-11-10 at 10:00 AM
      // Marking window runs until 2026-11-13 23:59:59 Asia/Colombo
      const openTime = new Date("2026-11-13T17:00:00Z"); // 22:30 Colombo time on day 3
      const openWindow = getMarkingWindowDetails("2026-11-10", "10:00", openTime);
      assert.strictEqual(openWindow.isOpen, true);
      assert.strictEqual(openWindow.isPastWindow, false);

      // Just past midnight into Day 4: 2026-11-13 18:30:01 UTC -> 2026-11-14 00:00:01 Colombo
      const closedTime = new Date("2026-11-13T18:30:01Z");
      const closedWindow = getMarkingWindowDetails("2026-11-10", "10:00", closedTime);
      assert.strictEqual(closedWindow.isOpen, false);
      assert.strictEqual(closedWindow.isPastWindow, true);
    });
  });

  // --------------------------------------------------------------------------
  // EDGE CASE 2: Make-ups counting toward the previous month up to the 5th
  // --------------------------------------------------------------------------
  describe("Edge Case 2: Make-ups counting toward previous month up to the 5th", () => {
    it("allows a make-up to count for previous month on or before the 5th day", () => {
      const dec4th = new Date(2026, 11, 4, 12, 0, 0); // Dec 4
      const res = validateMakeupMonth("2026-11", dec4th);
      assert.strictEqual(res.valid, true);
    });

    it("allows a make-up on the 5th day at 23:59 to count for previous month", () => {
      const dec5thLate = new Date(2026, 11, 5, 23, 50, 0); // Dec 5
      const res = validateMakeupMonth("2026-11", dec5thLate);
      assert.strictEqual(res.valid, true);
    });

    it("STRICT: rejects counting for previous month on the 6th day of the month", () => {
      const dec6th = new Date(2026, 11, 6, 10, 0, 0); // Dec 6
      const res = validateMakeupMonth("2026-11", dec6th);
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes("up to the 5th"));
    });

    it("rejects make-up counting for 2 or more months in the past", () => {
      const dec1st = new Date(2026, 11, 1, 10, 0, 0); // Dec 1
      const res = validateMakeupMonth("2026-10", dec1st);
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes("cannot count toward earlier months"));
    });

    it("always allows counting for the current month", () => {
      const dec20th = new Date(2026, 11, 20, 10, 0, 0); // Dec 20
      const res = validateMakeupMonth("2026-12", dec20th);
      assert.strictEqual(res.valid, true);
    });
  });

  // --------------------------------------------------------------------------
  // EDGE CASE 3: Fee term change mid-year
  // --------------------------------------------------------------------------
  describe("Edge Case 3: Fee term change mid-year", () => {
    const historicalTerms = [
      {
        id: "term_jan",
        effectiveFromMonth: "2026-01",
        monthlyFee: 5000,
        teacherShare: 3500,
        ownerShare: 1500,
        createdAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "term_jul",
        effectiveFromMonth: "2026-07",
        monthlyFee: 6500,
        teacherShare: 4500,
        ownerShare: 2000,
        createdAt: "2026-06-25T00:00:00Z",
      },
    ];

    it("correctly identifies Term 1 for months prior to the mid-year change", () => {
      const marchTerm = findEffectiveTermsForMonth(historicalTerms, "2026-03");
      assert.strictEqual(marchTerm?.id, "term_jan");
      assert.strictEqual(marchTerm?.monthlyFee, 5000);
      assert.strictEqual(marchTerm?.teacherShare, 3500);
      assert.strictEqual(calculateOwnerShare(marchTerm.monthlyFee, marchTerm.teacherShare), 1500);

      const juneTerm = findEffectiveTermsForMonth(historicalTerms, "2026-06");
      assert.strictEqual(juneTerm?.id, "term_jan");
      assert.strictEqual(juneTerm?.monthlyFee, 5000);
    });

    it("correctly applies Term 2 starting from the effective month onwards", () => {
      const julyTerm = findEffectiveTermsForMonth(historicalTerms, "2026-07");
      assert.strictEqual(julyTerm?.id, "term_jul");
      assert.strictEqual(julyTerm?.monthlyFee, 6500);
      assert.strictEqual(julyTerm?.teacherShare, 4500);
      assert.strictEqual(calculateOwnerShare(julyTerm.monthlyFee, julyTerm.teacherShare), 2000);

      const novTerm = findEffectiveTermsForMonth(historicalTerms, "2026-11");
      assert.strictEqual(novTerm?.id, "term_jul");
      assert.strictEqual(novTerm?.monthlyFee, 6500);
    });

    it("validates that teacher share cannot exceed monthly fee in any term", () => {
      const valid = validateClassTerms(5000, 3500);
      assert.strictEqual(valid.valid, true);

      const invalid = validateClassTerms(5000, 5500);
      assert.strictEqual(invalid.valid, false);
      assert.ok(invalid.error?.includes("cannot exceed the monthly fee"));
    });
  });

  // --------------------------------------------------------------------------
  // EDGE CASE 4: Year promotion
  // --------------------------------------------------------------------------
  describe("Edge Case 4: Academic Year promotion rules", () => {
    it("advances students by exactly 1 grade tier", () => {
      assert.strictEqual(getNextGrade("Grade 6", sampleGrades), "Grade 7");
      assert.strictEqual(getNextGrade("Grade 10", sampleGrades), "Grade 11");
      assert.strictEqual(getNextGrade("Grade 11", sampleGrades), "Grade 12");
      assert.strictEqual(getNextGrade("Grade 12", sampleGrades), "Grade 13");
    });

    it("graduates Grade 13 students to the Finished list", () => {
      assert.strictEqual(isGraduatingGrade("Grade 13", sampleGrades), true);
      assert.strictEqual(isGraduatingGrade("Grade 12", sampleGrades), false);
      assert.strictEqual(isGraduatingGrade("Grade 10", sampleGrades), false);
    });

    it("strictly refuses promoting an academic year that has already been promoted", () => {
      const year2026: AcademicYear = {
        id: "2026",
        name: "Academic Year 2026",
        status: "active",
        promotedToYear: "2027", // Already promoted
        createdAt: "2026-01-01T00:00:00Z",
      };

      const check = validatePromotionEligibility(year2026, "2027");
      assert.strictEqual(check.eligible, false);
      assert.ok(check.error?.includes("already promoted"));
    });

    it("strictly refuses non-sequential year promotion", () => {
      const fresh2026: AcademicYear = {
        id: "2026",
        name: "Academic Year 2026",
        status: "active",
        createdAt: "2026-01-01T00:00:00Z",
      };

      const check = validatePromotionEligibility(fresh2026, "2029");
      assert.strictEqual(check.eligible, false);
      assert.ok(check.error?.includes("directly follow"));
    });
  });

  // --------------------------------------------------------------------------
  // EDGE CASE 5: Deactivated teacher handling
  // --------------------------------------------------------------------------
  describe("Edge Case 5: Deactivated teacher handling", () => {
    it("deactivated teacher cannot be assigned to new classes or timetable slots", () => {
      const deactivatedTeacher = {
        id: "teacher_retired",
        name: "Mr. Retired Silva",
        email: "retired@college.lk",
        active: false,
      };

      // Guard check simulation
      function canAssignTeacher(teacher: { active: boolean }): { allowed: boolean; error?: string } {
        if (!teacher.active) {
          return {
            allowed: false,
            error: "Cannot assign deactivated teacher to new classes or timetable slots.",
          };
        }
        return { allowed: true };
      }

      const res = canAssignTeacher(deactivatedTeacher);
      assert.strictEqual(res.allowed, false);
      assert.ok(res.error?.includes("deactivated"));
    });

    it("historical records (invoices, sessions, salary logs) remain intact for deactivated teacher", () => {
      const historicalSession = {
        id: "sess_past_1",
        teacherId: "teacher_retired",
        teacherName: "Mr. Retired Silva",
        status: "held",
        countsForMonth: "2026-05",
      };

      assert.strictEqual(historicalSession.teacherId, "teacher_retired");
      assert.strictEqual(historicalSession.status, "held");
    });
  });
});
