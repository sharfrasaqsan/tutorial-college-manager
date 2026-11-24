import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateReceiptNo,
  generateFeeDocId,
  shouldGenerateFeeForStudent,
  calculateFeeSummary,
  calculateAdmissionFeeSummary,
  filterFees,
  MarkFeePaidSchema,
  UpdateFeeAmountSchema,
  MarkAdmissionFeeSchema,
} from "./fees.ts";
import type { FeeRecord } from "../types/index.ts";

describe("Fees pure logic and validations", () => {
  it("generates standardized receipt numbers", () => {
    const r1 = generateReceiptNo("FEE", "2026-11", 1);
    assert.equal(r1, "FEE-2026-00001");

    const r2 = generateReceiptNo("FEE", "2026", 42);
    assert.equal(r2, "FEE-2026-00042");
  });

  it("generates deterministic doc ids matching studentId_classId_YYYY-MM", () => {
    const id = generateFeeDocId("stu_202", "cls_101", "2026-11");
    assert.equal(id, "stu_202_cls_101_2026-11");
  });

  it("checks whether student fee should be generated based on joinedMonth", () => {
    assert.equal(shouldGenerateFeeForStudent("2026-01", "2026-03"), true);
    assert.equal(shouldGenerateFeeForStudent("2026-03", "2026-03"), true);
    assert.equal(shouldGenerateFeeForStudent("2026-04", "2026-03"), false);
  });

  it("validates MarkFeePaidSchema", () => {
    const valid = MarkFeePaidSchema.safeParse({
      paymentMethod: "cash",
      paidAt: "2026-11-20T10:00:00Z",
    });
    assert.equal(valid.success, true);

    const invalidMethod = MarkFeePaidSchema.safeParse({
      paymentMethod: "crypto",
    });
    assert.equal(invalidMethod.success, false);
  });

  it("validates UpdateFeeAmountSchema for mid-month joiners with note", () => {
    // Valid: teacher share <= fee amount with note
    const valid = UpdateFeeAmountSchema.safeParse({
      amount: 4000,
      teacherShare: 2500,
      note: "Joined on 15th of the month",
    });
    assert.equal(valid.success, true);

    // Invalid: missing note
    const missingNote = UpdateFeeAmountSchema.safeParse({
      amount: 4000,
      teacherShare: 2500,
    });
    assert.equal(missingNote.success, false);

    // Invalid: teacher share exceeds fee amount
    const invalid = UpdateFeeAmountSchema.safeParse({
      amount: 2000,
      teacherShare: 2500,
      note: "Mid-month discount",
    });
    assert.equal(invalid.success, false);
    if (!invalid.success) {
      assert.match(invalid.error.issues[0].message, /cannot exceed/i);
    }

    // Invalid: negative amounts
    const negative = UpdateFeeAmountSchema.safeParse({
      amount: -100,
      teacherShare: 0,
      note: "Negative",
    });
    assert.equal(negative.success, false);
  });

  it("validates MarkAdmissionFeeSchema", () => {
    // Paid requires method
    const validPaid = MarkAdmissionFeeSchema.safeParse({
      status: "paid",
      amount: 2500,
      method: "cash",
      paidDate: "2026-11-01",
    });
    assert.equal(validPaid.success, true);

    const invalidPaid = MarkAdmissionFeeSchema.safeParse({
      status: "paid",
      amount: 2500,
    });
    assert.equal(invalidPaid.success, false);

    // notApplicable requires no method
    const validNA = MarkAdmissionFeeSchema.safeParse({
      status: "notApplicable",
    });
    assert.equal(validNA.success, true);
  });

  it("calculates fee summary correctly", () => {
    const records: FeeRecord[] = [
      {
        id: "1",
        yearId: "2026",
        classId: "c1",
        studentId: "s1",
        month: "2026-11",
        amount: 5000,
        teacherShare: 3000,
        status: "paid",
        paymentMethod: "cash",
      },
      {
        id: "2",
        yearId: "2026",
        classId: "c1",
        studentId: "s2",
        month: "2026-11",
        amount: 5000,
        teacherShare: 3000,
        status: "unpaid",
      },
      {
        id: "3",
        yearId: "2026",
        classId: "c2",
        studentId: "s3",
        month: "2026-11",
        amount: 3000,
        teacherShare: 1800,
        status: "unpaid",
        note: "Joined Nov 15",
      },
    ];

    const summary = calculateFeeSummary(records);
    assert.equal(summary.totalCount, 3);
    assert.equal(summary.paidCount, 1);
    assert.equal(summary.unpaidCount, 2);
    assert.equal(summary.totalExpected, 13000);
    assert.equal(summary.totalCollected, 5000);
    assert.equal(summary.totalUnpaid, 8000);
    assert.equal(summary.totalTeacherShare, 7800);
  });

  it("filters fee records accurately", () => {
    const records: FeeRecord[] = [
      {
        id: "1",
        yearId: "2026",
        classId: "c1",
        className: "Grade 10 Maths",
        grade: "Grade 10",
        studentId: "s1",
        studentName: "Kasun Perera",
        month: "2026-11",
        amount: 5000,
        teacherShare: 3000,
        status: "paid",
        receiptNo: "FEE-2026-00001",
      },
      {
        id: "2",
        yearId: "2026",
        classId: "c1",
        className: "Grade 10 Maths",
        grade: "Grade 10",
        studentId: "s2",
        studentName: "Nimal Silva",
        month: "2026-11",
        amount: 5000,
        teacherShare: 3000,
        status: "unpaid",
      },
      {
        id: "3",
        yearId: "2026",
        classId: "c2",
        className: "Grade 11 Science",
        grade: "Grade 11",
        studentId: "s3",
        studentName: "Sunil Alwis",
        month: "2026-11",
        amount: 4500,
        teacherShare: 2800,
        status: "paid",
        receiptNo: "FEE-2026-00002",
      },
    ];

    // Filter by status unpaid
    const unpaidOnly = filterFees(records, { status: "unpaid" });
    assert.equal(unpaidOnly.length, 1);
    assert.equal(unpaidOnly[0].studentName, "Nimal Silva");

    // Filter by classId
    const c1Only = filterFees(records, { classId: "c1" });
    assert.equal(c1Only.length, 2);

    // Filter by grade
    const grade11 = filterFees(records, { grade: "Grade 11" });
    assert.equal(grade11.length, 1);
    assert.equal(grade11[0].studentName, "Sunil Alwis");

    // Filter by search query (receipt or name)
    const searched = filterFees(records, { search: "0002" });
    assert.equal(searched.length, 1);
    assert.equal(searched[0].studentName, "Sunil Alwis");
  });
});
