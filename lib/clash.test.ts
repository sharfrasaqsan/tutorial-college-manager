import { test, describe } from "node:test";
import assert from "node:assert";
import { doIntervalsOverlap, checkClash } from "./clash.ts";
import type { TimeInterval } from "../types/index.ts";

describe("Clash Rules", () => {
  test("touching times are allowed (do NOT overlap)", () => {
    assert.strictEqual(
      doIntervalsOverlap("08:30", "10:30", "10:30", "12:00"),
      false
    );
    assert.strictEqual(
      doIntervalsOverlap("10:30", "12:00", "08:30", "10:30"),
      false
    );
  });

  test("overlapping times correctly detected (partial overlap)", () => {
    assert.strictEqual(
      doIntervalsOverlap("08:30", "10:30", "09:00", "11:00"),
      true
    );
    assert.strictEqual(
      doIntervalsOverlap("09:00", "11:00", "08:30", "10:30"),
      true
    );
    assert.strictEqual(
      doIntervalsOverlap("08:30", "11:30", "09:00", "10:00"),
      true
    );
  });

  test("Rule 1: Teacher cannot have two overlapping sessions (plain sentence)", () => {
    const existing: TimeInterval[] = [
      {
        id: "slot-1",
        teacherId: "teacher-1",
        teacherName: "Mr Perera",
        classId: "class-1",
        className: "Grade 8 Science",
        grade: "Grade 8",
        weekday: 2, // Tuesday
        startTime: "16:00",
        endTime: "17:00",
      },
    ];

    const candidate: TimeInterval = {
      id: "candidate-1",
      teacherId: "teacher-1",
      teacherName: "Mr Perera",
      classId: "class-2",
      className: "Grade 9 Maths",
      grade: "Grade 9",
      weekday: 2,
      startTime: "16:30",
      endTime: "17:30",
    };

    const result = checkClash(candidate, existing);
    assert.strictEqual(result.hasClash, true);
    assert.strictEqual(
      result.message,
      "Mr Perera already teaches Grade 8 Science on Tuesday from 04:00 PM to 05:00 PM."
    );
  });

  test("Rule 2: At most 3 classes may overlap at any moment (4th class blocked)", () => {
    const existing: TimeInterval[] = [
      {
        id: "c1",
        teacherId: "t1",
        classId: "cls1",
        grade: "Grade 9",
        weekday: 1,
        startTime: "09:00",
        endTime: "11:00",
      },
      {
        id: "c2",
        teacherId: "t2",
        classId: "cls2",
        grade: "Grade 10",
        weekday: 1,
        startTime: "09:00",
        endTime: "11:00",
      },
      {
        id: "c3",
        teacherId: "t3",
        classId: "cls3",
        grade: "Grade 11",
        weekday: 1,
        startTime: "09:00",
        endTime: "11:00",
      },
    ];

    const candidate: TimeInterval = {
      id: "c4",
      teacherId: "t4",
      classId: "cls4",
      grade: "Grade 12",
      weekday: 1,
      startTime: "09:30",
      endTime: "10:30",
    };

    const result = checkClash(candidate, existing);
    assert.strictEqual(result.hasClash, true);
    assert.strictEqual(result.message, "Three classes already run at that time.");
  });

  test("Rule 4: Classes of the same grade MAY overlap with different teachers, flagging hasGradeWarning", () => {
    const existing: TimeInterval[] = [
      {
        id: "c1",
        teacherId: "t1",
        teacherName: "Mr. Fernando",
        classId: "cls1",
        className: "Grade 10 Science",
        grade: "Grade 10",
        weekday: 1,
        startTime: "09:00",
        endTime: "11:00",
      },
    ];

    const candidate: TimeInterval = {
      id: "c2",
      teacherId: "t2",
      teacherName: "Mrs. Perera",
      classId: "cls2",
      className: "Grade 10 Maths",
      grade: "Grade 10",
      weekday: 1,
      startTime: "09:00",
      endTime: "11:00",
    };

    const result = checkClash(candidate, existing);
    assert.strictEqual(result.hasClash, false);
    assert.strictEqual(result.hasGradeWarning, true);
    assert.strictEqual(result.gradeConflictClass, "Grade 10 Science");
    assert.ok(result.warningMessage?.includes("Grade 10 Maths and Grade 10 Science are both scheduled for Grade 10 on Monday"));
    assert.ok(result.warningMessage?.includes("cannot attend both classes simultaneously"));
  });

  test("Different grades overlapping with different teachers do NOT flag a grade warning", () => {
    const existing: TimeInterval[] = [
      {
        id: "c1",
        teacherId: "t1",
        teacherName: "Mr. Fernando",
        classId: "cls1",
        className: "Grade 10 Science",
        grade: "Grade 10",
        weekday: 1,
        startTime: "09:00",
        endTime: "11:00",
      },
    ];

    const candidate: TimeInterval = {
      id: "c2",
      teacherId: "t2",
      teacherName: "Mrs. Perera",
      classId: "cls2",
      className: "Grade 11 Maths",
      grade: "Grade 11",
      weekday: 1,
      startTime: "09:00",
      endTime: "11:00",
    };

    const result = checkClash(candidate, existing);
    assert.strictEqual(result.hasClash, false);
    assert.strictEqual(result.hasGradeWarning, false);
  });

  test("Same class overlapping with another session of itself produces a hard clash", () => {
    const existing: TimeInterval[] = [
      {
        id: "c1",
        teacherId: "t1",
        teacherName: "Mr. Fernando",
        classId: "cls1",
        className: "Grade 10 Science",
        grade: "Grade 10",
        weekday: 1,
        startTime: "09:00",
        endTime: "11:00",
      },
    ];

    const candidate: TimeInterval = {
      id: "c2",
      teacherId: "t2",
      teacherName: "Substitute Teacher",
      classId: "cls1",
      className: "Grade 10 Science",
      grade: "Grade 10",
      weekday: 1,
      startTime: "10:00",
      endTime: "12:00",
    };

    const result = checkClash(candidate, existing);
    assert.strictEqual(result.hasClash, true);
    assert.ok(result.message?.includes("already has a session on Monday from 09:00 AM to 11:00 AM"));
  });

  test("End time must be strictly after start time", () => {
    const candidate: TimeInterval = {
      id: "c-invalid",
      teacherId: "t1",
      classId: "cls1",
      grade: "Grade 10",
      weekday: 1,
      startTime: "11:00",
      endTime: "10:00",
    };
    const result = checkClash(candidate, []);
    assert.strictEqual(result.hasClash, true);
    assert.strictEqual(result.message, "End time must be after start time.");
  });
});
