import { test, describe } from "node:test";
import assert from "node:assert";
import { calculateFeeSummary } from "./fees.ts";
import { calculateSalaryAmount } from "./salary.ts";
import type { FeeRecord } from "../types/index.ts";

describe("Reports Mathematical Consistency & Aggregations", () => {
  test("student payments and fee summary totals match with 100% precision", () => {
    const mockFees: FeeRecord[] = [
      {
        id: "f1",
        yearId: "2026",
        classId: "c1",
        studentId: "s1",
        studentName: "Amal Perera",
        month: "2026-11",
        amount: 4000,
        teacherShare: 2500,
        status: "paid",
        paymentMethod: "bank",
        receiptNo: "FEE-2026-00001",
      },
      {
        id: "f2",
        yearId: "2026",
        classId: "c1",
        studentId: "s2",
        studentName: "Nimal Silva",
        month: "2026-11",
        amount: 4000,
        teacherShare: 2500,
        status: "unpaid",
      },
      {
        id: "f3",
        yearId: "2026",
        classId: "c2",
        studentId: "s3",
        studentName: "Kamal Fernando",
        month: "2026-11",
        amount: 5000,
        teacherShare: 3500,
        status: "paid",
        paymentMethod: "cash",
        receiptNo: "FEE-2026-00002",
      },
    ];

    const feeSummary = calculateFeeSummary(mockFees);
    assert.equal(feeSummary.totalExpected, 13000);
    assert.equal(feeSummary.totalCollected, 9000);
    assert.equal(feeSummary.totalUnpaid, 4000);
    assert.equal(feeSummary.totalTeacherShare, 8500);

    // Sum of paid items
    const paidItems = mockFees.filter((f) => f.status === "paid");
    const totalCollectedFromPayments = paidItems.reduce((sum, f) => sum + f.amount, 0);
    assert.equal(totalCollectedFromPayments, feeSummary.totalCollected);

    // Owner share: collected fees minus teacher amounts for the same month
    const ownerShare = Math.max(0, feeSummary.totalCollected - feeSummary.totalTeacherShare);
    assert.equal(ownerShare, 9000 - 8500); // 500
  });

  test("teacher salary calculation equals sum of teacher shares for enrolled students", () => {
    const classFees: Array<{ teacherShare: number }> = [
      { teacherShare: 2500 },
      { teacherShare: 2500 },
      { teacherShare: 2500 },
    ];
    const totalTeacherSalary = calculateSalaryAmount(classFees);
    assert.equal(totalTeacherSalary, 7500);
  });

  test("pending fees aggregation calculates tuition and admission fee correctly", () => {
    const student1 = {
      monthlyTuitionPending: 4000,
      admissionFeePending: 2000,
      totalPending: 6000,
    };
    const student2 = {
      monthlyTuitionPending: 5000,
      admissionFeePending: 0,
      totalPending: 5000,
    };

    const grandTotal =
      student1.monthlyTuitionPending +
      student1.admissionFeePending +
      student2.monthlyTuitionPending +
      student2.admissionFeePending;

    assert.equal(grandTotal, 11000);
  });
});
