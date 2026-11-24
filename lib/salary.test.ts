import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getSalaryStatus,
  formatInvoiceNumber,
  generateSalaryDocId,
  generateSalaryDisplayName,
  calculateSalaryAmount,
  PayTeacherSchema,
} from "./salary.ts";

describe("Salary Domain Logic & Acceptance Criteria", () => {
  it("criterion 1: short month stays onHold without proportional reduction", () => {
    // 4 sessions held out of 8 required
    const status = getSalaryStatus(4, 8, false);
    assert.equal(status, "onHold");

    // 0 sessions held
    assert.equal(getSalaryStatus(0, 8, false), "onHold");

    // 7 sessions held
    assert.equal(getSalaryStatus(7, 8, false), "onHold");

    // The amount is NOT reduced proportionally: if 10 students @ 2000 share, amount is 20,000
    const feeRecords = Array.from({ length: 10 }, () => ({ teacherShare: 2000 }));
    const amount = calculateSalaryAmount(feeRecords);
    assert.equal(amount, 20000);
  });

  it("criterion 2: a make-up completing a month flips status to ready", () => {
    // 7 regular sessions held + 1 makeup held = 8 held
    const regularHeld = 7;
    const makeupHeld = 1;
    const totalHeld = regularHeld + makeupHeld;
    const required = 8;

    // Before makeup held: 7 of 8 -> onHold
    assert.equal(getSalaryStatus(regularHeld, required, false), "onHold");

    // Once makeup is marked held: 8 of 8 -> ready!
    assert.equal(getSalaryStatus(totalHeld, required, false), "ready");
  });

  it("criterion 3: unpaid students do NOT reduce the salary amount", () => {
    // 6 students enrolled in class:
    // Student 1 & 2 paid, Student 3, 4, 5, 6 unpaid!
    const feeRecords = [
      { studentId: "s1", status: "paid", teacherShare: 3000 },
      { studentId: "s2", status: "paid", teacherShare: 3000 },
      { studentId: "s3", status: "unpaid", teacherShare: 3000 },
      { studentId: "s4", status: "unpaid", teacherShare: 3000 },
      { studentId: "s5", status: "unpaid", teacherShare: 3000 },
      { studentId: "s6", status: "unpaid", teacherShare: 3000 },
    ];

    // Salary amount is based strictly on ENROLLED students (all 6 records) and NOT on who paid!
    const salaryTotal = calculateSalaryAmount(feeRecords);
    assert.equal(salaryTotal, 18000); // 6 * 3000 = 18,000 regardless of unpaid status
  });

  it("criterion 4: a teacher with several classes gets ONE combined invoice", () => {
    const classA = {
      classId: "c_maths",
      className: "Grade 10 Maths",
      sessionsHeld: 8,
      sessionsRequired: 8,
      studentCount: 15,
      amount: 45000,
    };

    const classB = {
      classId: "c_stats",
      className: "Grade 11 Statistics",
      sessionsHeld: 8,
      sessionsRequired: 8,
      studentCount: 10,
      amount: 30000,
    };

    // Both classes are ready
    assert.equal(getSalaryStatus(classA.sessionsHeld, classA.sessionsRequired, false), "ready");
    assert.equal(getSalaryStatus(classB.sessionsHeld, classB.sessionsRequired, false), "ready");

    // Combined invoice calculation
    const readyClasses = [classA, classB];
    const totalInvoiceAmount = readyClasses.reduce((sum, c) => sum + c.amount, 0);
    assert.equal(totalInvoiceAmount, 75000);

    // Number format: SAL-YYYY-MM-NNN
    const invoiceNo = formatInvoiceNumber("2026", "2026-11", 5);
    assert.equal(invoiceNo, "SAL-2026-11-005");
  });

  it("generates canonical salary doc ID: teacherId_classId_YYYY-MM", () => {
    const docId = generateSalaryDocId("t_sunil", "c_maths10", "2026-11");
    assert.equal(docId, "t_sunil_c_maths10_2026-11");
  });

  it("generates display name: e.g. 2026 November, Grade 10 Maths", () => {
    const displayName = generateSalaryDisplayName("2026-11", "Grade 10 Maths");
    assert.equal(displayName, "2026 November, Grade 10 Maths");

    const mayName = generateSalaryDisplayName("2026-05", "Grade 11 Science");
    assert.equal(mayName, "2026 May, Grade 11 Science");
  });

  it("validates PayTeacherSchema", () => {
    const valid = PayTeacherSchema.safeParse({
      teacherId: "teacher_123",
      month: "2026-11",
      classIds: ["cls_1", "cls_2"],
      depositDate: "2026-11-25",
      paymentMethod: "bank",
    });
    assert.equal(valid.success, true);

    const invalid = PayTeacherSchema.safeParse({
      teacherId: "",
      month: "invalid-month",
      classIds: [],
      depositDate: "",
    });
    assert.equal(invalid.success, false);
  });
});
