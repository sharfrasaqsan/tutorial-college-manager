import { test, describe } from "node:test";
import assert from "node:assert";
import {
  CreateSlotSchema,
  generateSessionsForSlot,
  slotToTimeInterval,
  sessionToTimeInterval,
} from "./timetable.ts";

describe("Timetable & Session Generator Domain Logic", () => {
  test("CreateSlotSchema validates valid slot input", () => {
    const valid = CreateSlotSchema.safeParse({
      yearId: "2026",
      classId: "class-123",
      weekday: 2, // Tuesday
      startTime: "16:00",
      endTime: "18:00",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
    });

    assert.strictEqual(valid.success, true);
  });

  test("CreateSlotSchema rejects start time equal to or after end time", () => {
    const invalid = CreateSlotSchema.safeParse({
      yearId: "2026",
      classId: "class-123",
      weekday: 2,
      startTime: "18:00",
      endTime: "16:00",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
    });

    assert.strictEqual(invalid.success, false);
    if (!invalid.success) {
      assert.match(invalid.error.issues[0].message, /End time must be after start time/);
    }
  });

  test("CreateSlotSchema rejects invalid weekday", () => {
    const invalid = CreateSlotSchema.safeParse({
      yearId: "2026",
      classId: "class-123",
      weekday: 7, // Invalid (only 0-6 allowed)
      startTime: "16:00",
      endTime: "18:00",
    });

    assert.strictEqual(invalid.success, false);
  });

  test("generateSessionsForSlot produces correct sessions on matching weekday with countsForMonth", () => {
    // January 2026:
    // Jan 1 is Thursday (4)
    // Jan 6 is Tuesday (2)
    // Jan 13 is Tuesday (2)
    // Jan 20 is Tuesday (2)
    // Jan 27 is Tuesday (2)
    // Feb 3 is Tuesday (2)
    const sessions = generateSessionsForSlot({
      slotId: "slot-maths-tue",
      yearId: "2026",
      classId: "class-maths-10",
      className: "Grade 10 Maths",
      grade: "Grade 10",
      subject: "Maths",
      teacherId: "teacher-perera",
      teacherName: "Mr. Perera",
      weekday: 2, // Tuesday
      startTime: "16:00",
      endTime: "18:00",
      validFrom: "2026-01-01",
      validTo: "2026-02-10",
    });

    // 4 Tuesdays in Jan + 2 Tuesdays in Feb = 6 sessions
    assert.strictEqual(sessions.length, 6);

    // Verify properties of first session
    const first = sessions[0];
    assert.strictEqual(first.id, "slot-maths-tue_2026-01-06");
    assert.strictEqual(first.date, "2026-01-06");
    assert.strictEqual(first.startTime, "16:00");
    assert.strictEqual(first.endTime, "18:00");
    assert.strictEqual(first.type, "regular");
    assert.strictEqual(first.status, "scheduled");
    assert.strictEqual(first.countsForMonth, "2026-01");
    assert.strictEqual(first.locked, false);

    // Verify month boundary session
    const febSession = sessions[4];
    assert.strictEqual(febSession.date, "2026-02-03");
    assert.strictEqual(febSession.countsForMonth, "2026-02");
  });

  test("converts slot and session to TimeInterval for clash check", () => {
    const slotInterval = slotToTimeInterval({
      id: "slot-1",
      yearId: "2026",
      classId: "cls-1",
      className: "Grade 10 Science",
      grade: "Grade 10",
      subject: "Science",
      teacherId: "t-1",
      teacherName: "Mr. Silva",
      weekday: 3,
      startTime: "14:00",
      endTime: "16:00",
    });

    assert.strictEqual(slotInterval.id, "slot-1");
    assert.strictEqual(slotInterval.weekday, 3);
    assert.strictEqual(slotInterval.startTime, "14:00");
    assert.strictEqual(slotInterval.endTime, "16:00");

    const sessionInterval = sessionToTimeInterval({
      id: "sess-1",
      yearId: "2026",
      classId: "cls-1",
      className: "Grade 10 Science",
      grade: "Grade 10",
      teacherId: "t-1",
      date: "2026-03-15",
      startTime: "14:00",
      endTime: "16:00",
      type: "regular",
      status: "scheduled",
      countsForMonth: "2026-03",
      locked: false,
    });

    assert.strictEqual(sessionInterval.id, "sess-1");
    assert.strictEqual(sessionInterval.date, "2026-03-15");
  });

  test("CreateSlotSchema accepts temporary / extra class parameters", () => {
    const valid = CreateSlotSchema.safeParse({
      yearId: "2027",
      classId: "class-123",
      weekday: 0, // Sunday
      startTime: "10:00",
      endTime: "12:00",
      isTemporary: true,
      slotType: "extra",
      specificDate: "2027-03-14",
      countsForMonth: "2027-03",
      note: "Special Revision Seminar",
    });

    assert.strictEqual(valid.success, true);
    if (valid.success) {
      assert.strictEqual(valid.data.isTemporary, true);
      assert.strictEqual(valid.data.slotType, "extra");
      assert.strictEqual(valid.data.specificDate, "2027-03-14");
      assert.strictEqual(valid.data.countsForMonth, "2027-03");
      assert.strictEqual(valid.data.note, "Special Revision Seminar");
    }
  });

  test("generateSessionsForSlot produces exactly 1 non-repeating countable session for temporary / extra class", () => {
    // 2027-03-14 is a Sunday (0)
    const sessions = generateSessionsForSlot({
      slotId: "slot-extra-seminar",
      yearId: "2027",
      classId: "class-sci-08",
      className: "Grade 08 Science",
      grade: "Grade 08",
      subject: "Science",
      teacherId: "teacher-sci",
      teacherName: "Science Teacher Test",
      weekday: 0, // Sunday
      startTime: "10:00",
      endTime: "12:00",
      validFrom: "2027-03-14",
      validTo: "2027-03-14",
      isTemporary: true,
      countsForMonth: "2027-03",
      note: "Term Exam Revision",
    });

    // Exactly 1 non-repeating session
    assert.strictEqual(sessions.length, 1);

    const extraSession = sessions[0];
    assert.strictEqual(extraSession.id, "slot-extra-seminar_2027-03-14");
    assert.strictEqual(extraSession.date, "2027-03-14");
    assert.strictEqual(extraSession.startTime, "10:00");
    assert.strictEqual(extraSession.endTime, "12:00");
    assert.strictEqual(extraSession.type, "extra");
    assert.strictEqual(extraSession.status, "scheduled");
    assert.strictEqual(extraSession.countsForMonth, "2027-03"); // countable towards target month
    assert.strictEqual(extraSession.isTemporary, true);
    assert.strictEqual(extraSession.note, "Term Exam Revision");
    assert.strictEqual(extraSession.locked, false);
  });

  test("slotToTimeInterval correctly extracts specificDate for clash check", () => {
    const slotInterval = slotToTimeInterval({
      id: "slot-extra",
      yearId: "2027",
      classId: "cls-1",
      className: "Grade 08 Science",
      grade: "Grade 08",
      subject: "Science",
      teacherId: "t-1",
      teacherName: "Science Teacher",
      weekday: 0,
      startTime: "10:00",
      endTime: "12:00",
      isTemporary: true,
      specificDate: "2027-03-14",
    });

    assert.strictEqual(slotInterval.id, "slot-extra");
    assert.strictEqual(slotInterval.date, "2027-03-14");
    assert.strictEqual(slotInterval.weekday, 0);
  });
});
