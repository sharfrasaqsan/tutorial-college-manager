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
});
