import { describe, it, expect } from "vitest";
import {
  MonthKeyRegex,
  generateFeeDocId,
  shouldGenerateFeeForStudent,
  calculateFeeSummary,
  filterFees,
} from "@/lib/fees";
import type { FeeRecord } from "@/types";

describe("Integration: Monthly Fee Sync & Payroll Accounting", () => {
  it("enforces strict YYYY-MM month key format", () => {
    expect(MonthKeyRegex.test("2027-05")).toBe(true);
    expect(MonthKeyRegex.test("2027-12")).toBe(true);
    expect(MonthKeyRegex.test("2027-5")).toBe(false);
    expect(MonthKeyRegex.test("May-2027")).toBe(false);
    expect(MonthKeyRegex.test("2027/05")).toBe(false);
  });

  it("generates deterministic canonical fee document ID for idempotency", () => {
    const docId1 = generateFeeDocId("stud_abc", "cls_maths", "2027-03");
    const docId2 = generateFeeDocId("stud_abc", "cls_maths", "2027-03");
    expect(docId1).toBe(docId2);
    expect(docId1).toBe("stud_abc_cls_maths_2027-03");
  });

  it("evaluates student enrollment join date against fee generation month", () => {
    // Student who joined in March 2027 should NOT have fees generated for February 2027
    expect(shouldGenerateFeeForStudent("2027-03", "2027-02")).toBe(false);
    // Student who joined in March 2027 SHOULD have fees generated for March 2027
    expect(shouldGenerateFeeForStudent("2027-03", "2027-03")).toBe(true);
    // Student who joined in March 2027 SHOULD have fees generated for April 2027
    expect(shouldGenerateFeeForStudent("2027-03", "2027-04")).toBe(true);
  });

  it("calculates monthly financial totals, collections, and teacher/owner shares", () => {
    const mockFees: FeeRecord[] = [
      {
        id: "f1",
        yearId: "2027",
        classId: "c1",
        studentId: "s1",
        studentName: "Student 1",
        month: "2027-05",
        amount: 3000,
        teacherShare: 2000,
        status: "paid",
        receiptNo: "REC-202705-001",
      },
      {
        id: "f2",
        yearId: "2027",
        classId: "c1",
        studentId: "s2",
        studentName: "Student 2",
        month: "2027-05",
        amount: 3000,
        teacherShare: 2000,
        status: "unpaid",
      },
      {
        id: "f3",
        yearId: "2027",
        classId: "c2",
        studentId: "s3",
        studentName: "Student 3",
        month: "2027-05",
        amount: 2500,
        teacherShare: 1800,
        status: "paid",
        receiptNo: "REC-202705-002",
      },
    ];

    const summary = calculateFeeSummary(mockFees);

    // Total expected: 3000 + 3000 + 2500 = 8500
    expect(summary.totalExpected).toBe(8500);
    // Total collected (paid): 3000 + 2500 = 5500
    expect(summary.totalCollected).toBe(5500);
    // Total unpaid: 3000
    expect(summary.totalUnpaid).toBe(3000);
    // Paid count: 2, Unpaid count: 1
    expect(summary.paidCount).toBe(2);
    expect(summary.unpaidCount).toBe(1);
    // Total teacher share across all fees: 2000 + 2000 + 1800 = 5800
    expect(summary.totalTeacherShare).toBe(5800);
    expect(summary.totalCount).toBe(3);
  });

  it("filters fees by class, grade, payment status, and student search", () => {
    const fees: FeeRecord[] = [
      {
        id: "f1",
        yearId: "2027",
        classId: "c_maths",
        studentId: "s1",
        studentName: "Alice Perera",
        grade: "Grade 06",
        month: "2027-05",
        amount: 3000,
        teacherShare: 2000,
        status: "paid",
      },
      {
        id: "f2",
        yearId: "2027",
        classId: "c_science",
        studentId: "s2",
        studentName: "Bob Silva",
        grade: "Grade 07",
        month: "2027-05",
        amount: 3000,
        teacherShare: 2000,
        status: "unpaid",
      },
    ];

    // Filter status unpaid
    const unpaid = filterFees(fees, { status: "unpaid" });
    expect(unpaid).toHaveLength(1);
    expect(unpaid[0].studentName).toBe("Bob Silva");

    // Filter grade Grade 06
    const grade6 = filterFees(fees, { grade: "Grade 06" });
    expect(grade6).toHaveLength(1);
    expect(grade6[0].studentName).toBe("Alice Perera");

    // Search query
    const searched = filterFees(fees, { search: "alice" });
    expect(searched).toHaveLength(1);
    expect(searched[0].studentName).toBe("Alice Perera");
  });
});
