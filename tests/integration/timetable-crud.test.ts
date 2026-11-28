import { describe, it, expect } from "vitest";
import { CreateSlotSchema, generateSessionsForSlot, slotToTimeInterval } from "@/lib/timetable";
import { checkClash } from "@/lib/clash";
import type { TimeInterval } from "@/types";

describe("Integration: Timetable Engine & Clash Prevention", () => {
  it("rejects slot creation when start time is equal to or after end time", () => {
    const invalidPayload = {
      yearId: "2027",
      classId: "cls_1",
      weekday: 2,
      startTime: "14:00",
      endTime: "13:00", // Invalid!
    };

    const parsed = CreateSlotSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toMatch(/end time must be after start time/i);
    }
  });

  it("rejects slot creation with invalid weekday out of bounds 0-6", () => {
    const invalidWeekday = {
      yearId: "2027",
      classId: "cls_1",
      weekday: 7, // Invalid!
      startTime: "10:00",
      endTime: "12:00",
    };

    const parsed = CreateSlotSchema.safeParse(invalidWeekday);
    expect(parsed.success).toBe(false);
  });

  it("enforces maximum 3 concurrent room clash boundary (Rule 2)", () => {
    const existingSlots: TimeInterval[] = [
      {
        id: "slot_1",
        classId: "cls_1",
        className: "Grade 06 Maths",
        grade: "Grade 06",
        teacherId: "t_1",
        teacherName: "Teacher A",
        weekday: 1, // Monday
        startTime: "10:00",
        endTime: "12:00",
      },
      {
        id: "slot_2",
        classId: "cls_2",
        className: "Grade 07 Science",
        grade: "Grade 07",
        teacherId: "t_2",
        teacherName: "Teacher B",
        weekday: 1,
        startTime: "10:30",
        endTime: "12:30",
      },
      {
        id: "slot_3",
        classId: "cls_3",
        className: "Grade 08 English",
        grade: "Grade 08",
        teacherId: "t_3",
        teacherName: "Teacher C",
        weekday: 1,
        startTime: "11:00",
        endTime: "13:00",
      },
    ];

    // Propose 4th overlapping slot at 11:15 - 11:45 where 3 classes are already active
    const fourthSlot: TimeInterval = {
      id: "slot_4",
      classId: "cls_4",
      className: "Grade 09 History",
      grade: "Grade 09",
      teacherId: "t_4",
      teacherName: "Teacher D",
      weekday: 1,
      startTime: "11:15",
      endTime: "12:00",
    };

    const result = checkClash(fourthSlot, existingSlots);
    expect(result.hasClash).toBe(true);
    expect(result.message).toMatch(/three classes already run at that time/i);
  });

  it("handles temporary / extra class slot creation with 1 non-repeating session", () => {
    const tempPayload = {
      yearId: "2027",
      classId: "cls_temp",
      weekday: 3,
      startTime: "15:00",
      endTime: "17:00",
      isTemporary: true,
      slotType: "extra" as const,
      specificDate: "2027-04-14",
      countsForMonth: "2027-04",
      note: "Extra Revision Session for Exam",
    };

    const parsed = CreateSlotSchema.safeParse(tempPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.isTemporary).toBe(true);
      expect(parsed.data.slotType).toBe("extra");
      expect(parsed.data.specificDate).toBe("2027-04-14");
    }

    const sessions = generateSessionsForSlot({
      slotId: "slot_extra_1",
      yearId: "2027",
      classId: "cls_temp",
      className: "Grade 11 Science Extra",
      grade: "Grade 11",
      subject: "Science",
      teacherId: "t_science",
      teacherName: "Science Faculty",
      weekday: 3,
      startTime: "15:00",
      endTime: "17:00",
      validFrom: "2027-04-14",
      validTo: "2027-04-14",
      isTemporary: true,
      countsForMonth: "2027-04",
      note: "Extra Revision Session for Exam",
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).toBe("2027-04-14");
    expect(sessions[0].isTemporary).toBe(true);
    expect(sessions[0].status).toBe("scheduled");
  });

  it("filters timetable slots weekly only: preserves all 7 days of selected week and isolates extra classes", () => {
    // Week: Monday 2027-04-12 to Sunday 2027-04-18
    const weekStart = "2027-04-12";
    const weekEnd = "2027-04-18";

    const slots = [
      {
        id: "s_mon",
        weekday: 1, // Monday 2027-04-12 - regular repeating slot
        validFrom: "2027-01-01",
        validTo: "2027-12-31",
        className: "Grade 07 Maths",
      },
      {
        id: "s_wed",
        weekday: 3, // Wednesday 2027-04-14 - regular repeating slot
        validFrom: "2027-01-01",
        validTo: "2027-12-31",
        className: "Grade 06 English",
      },
      {
        id: "s_fri",
        weekday: 5, // Friday 2027-04-16 - regular repeating slot
        validFrom: "2027-01-01",
        validTo: "2027-12-31",
        className: "Grade 08 Science",
      },
      {
        id: "s_expired",
        weekday: 3, // Wednesday - expired before this week (ended 2027-03-31)
        validFrom: "2027-01-01",
        validTo: "2027-03-31",
        className: "Grade 08 Science Term 1",
      },
      {
        id: "s_future",
        weekday: 1, // Monday - starts after this week (starts 2027-05-01)
        validFrom: "2027-05-01",
        validTo: "2027-12-31",
        className: "Grade 09 Revision",
      },
      {
        id: "s_extra_in_week",
        weekday: 3, // Extra session scheduled on Wednesday 2027-04-14 (in this week)
        isTemporary: true,
        specificDate: "2027-04-14",
        className: "Grade 11 Science Extra",
      },
      {
        id: "s_extra_next_week",
        weekday: 3, // Extra session scheduled on Wednesday 2027-04-21 (next week)
        isTemporary: true,
        specificDate: "2027-04-21",
        className: "Grade 11 Science Future Extra",
      },
    ];

    const filtered = slots.filter((slot) => {
      const isExtra = Boolean(
        slot.isTemporary || slot.specificDate || (slot.validFrom && slot.validFrom === slot.validTo)
      );

      if (isExtra) {
        const dateVal = slot.specificDate || slot.validFrom;
        if (!dateVal) return false;
        return dateVal >= weekStart && dateVal <= weekEnd;
      }

      // Regular recurring classes: check if active during this week
      if (slot.validFrom && slot.validFrom > weekEnd) {
        return false;
      }
      if (slot.validTo && slot.validTo < weekStart) {
        return false;
      }
      return true;
    });

    // All days of the week (Monday, Wednesday, Friday) inside the active week remain visible
    // and extra class for this week is included, while expired, future, and next week's extra are excluded!
    expect(filtered.map((s) => s.id)).toEqual(["s_mon", "s_wed", "s_fri", "s_extra_in_week"]);
  });
});
