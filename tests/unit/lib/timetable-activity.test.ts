import { describe, it, expect } from "vitest";
import { getSlotActivityInfo, validateSlotDatesNotInPast, isSlotLiveNow } from "@/lib/timetable";
import type { TimetableSlot } from "@/types";

const baseSlot: TimetableSlot = {
  id: "slot-1",
  yearId: "2026",
  classId: "class-1",
  className: "Grade 06 Maths",
  grade: "Grade 06",
  subject: "Maths",
  teacherId: "teacher-1",
  teacherName: "Teacher One",
  weekday: 0,
  startTime: "08:00",
  endTime: "09:00",
  validFrom: "2026-01-01",
  validTo: "2026-12-31",
};

describe("getSlotActivityInfo", () => {
  const todayStr = "2026-11-28";

  it("marks past temporary/extra class as expired so it hides from Master Timetable", () => {
    const slot: TimetableSlot = {
      ...baseSlot,
      isTemporary: true,
      slotType: "extra",
      specificDate: "2026-11-20",
      validFrom: "2026-11-20",
      validTo: "2026-11-20",
    };

    const info = getSlotActivityInfo(slot, todayStr);
    expect(info.isExtra).toBe(true);
    expect(info.isExpired).toBe(true);
  });

  it("shows today's temporary/extra class with 'Today' badge", () => {
    const slot: TimetableSlot = {
      ...baseSlot,
      isTemporary: true,
      slotType: "extra",
      specificDate: "2026-11-28",
      validFrom: "2026-11-28",
      validTo: "2026-11-28",
    };

    const info = getSlotActivityInfo(slot, todayStr);
    expect(info.isExtra).toBe(true);
    expect(info.isExpired).toBe(false);
    expect(info.badgeType).toBe("extra");
    expect(info.badgeLabel).toBe("Today");
  });

  it("shows upcoming temporary/extra class with formatted date badge", () => {
    const slot: TimetableSlot = {
      ...baseSlot,
      weekday: 1,
      isTemporary: true,
      slotType: "extra",
      specificDate: "2026-11-30",
      validFrom: "2026-11-30",
      validTo: "2026-11-30",
    };

    const info = getSlotActivityInfo(slot, todayStr);
    expect(info.isExtra).toBe(true);
    expect(info.isExpired).toBe(false);
    expect(info.badgeType).toBe("extra");
    expect(info.badgeLabel).toBe("30 Nov");
  });

  it("marks expired regular slot (validTo < today) as expired", () => {
    const slot: TimetableSlot = {
      ...baseSlot,
      validFrom: "2026-01-01",
      validTo: "2026-11-27",
    };

    const info = getSlotActivityInfo(slot, todayStr);
    expect(info.isExtra).toBe(false);
    expect(info.isExpired).toBe(true);
  });

  it("marks future-effective regular slot with 'From 29 Nov' badge", () => {
    const slot: TimetableSlot = {
      ...baseSlot,
      startTime: "09:00",
      endTime: "10:00",
      validFrom: "2026-11-29",
      validTo: "2026-12-31",
    };

    const info = getSlotActivityInfo(slot, todayStr);
    expect(info.isExtra).toBe(false);
    expect(info.isExpired).toBe(false);
    expect(info.isFutureStart).toBe(true);
    expect(info.badgeType).toBe("future");
    expect(info.badgeLabel).toBe("From 29 Nov");
  });

  it("marks active regular slot ending before year end with 'Until 28 Nov' badge", () => {
    const slot: TimetableSlot = {
      ...baseSlot,
      validFrom: "2026-01-01",
      validTo: "2026-11-28",
    };

    const info = getSlotActivityInfo(slot, todayStr);
    expect(info.isExtra).toBe(false);
    expect(info.isExpired).toBe(false);
    expect(info.isEndingSoon).toBe(true);
    expect(info.badgeType).toBe("ending");
    expect(info.badgeLabel).toBe("Until 28 Nov");
  });

  it("shows standard full-year active regular slot with no special badge", () => {
    const info = getSlotActivityInfo(baseSlot, todayStr);
    expect(info.isExtra).toBe(false);
    expect(info.isExpired).toBe(false);
    expect(info.isFutureStart).toBe(false);
    expect(info.isEndingSoon).toBe(false);
    expect(info.badgeType).toBeUndefined();
  });
});

describe("validateSlotDatesNotInPast", () => {
  const todayStr = "2026-11-28";

  it("blocks creating an extra class on a past date", () => {
    const err = validateSlotDatesNotInPast({
      isExtra: true,
      specificDate: "2026-11-20",
      todayStr,
      isEdit: false,
    });
    expect(err).toMatch(/cannot schedule.*past date/i);
  });

  it("blocks moving an extra class to a past date", () => {
    const err = validateSlotDatesNotInPast({
      isExtra: true,
      specificDate: "2026-11-27",
      todayStr,
      isEdit: true,
    });
    expect(err).toMatch(/cannot move.*past date/i);
  });

  it("allows scheduling an extra class today or in the future", () => {
    expect(
      validateSlotDatesNotInPast({
        isExtra: true,
        specificDate: "2026-11-28",
        todayStr,
        isEdit: false,
      })
    ).toBeNull();
    expect(
      validateSlotDatesNotInPast({
        isExtra: true,
        specificDate: "2026-11-30",
        todayStr,
        isEdit: false,
      })
    ).toBeNull();
  });

  it("blocks creating a new regular slot with start date or end date in the past", () => {
    expect(
      validateSlotDatesNotInPast({
        isExtra: false,
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        todayStr,
        isEdit: false,
      })
    ).toMatch(/start date.*cannot be in the past/i);

    expect(
      validateSlotDatesNotInPast({
        isExtra: false,
        validFrom: "2026-11-28",
        validTo: "2026-11-20",
        todayStr,
        isEdit: false,
      })
    ).toMatch(/end date.*cannot be in the past/i);
  });

  it("allows editing an existing regular slot whose validFrom is in the past as long as validTo is not in the past", () => {
    expect(
      validateSlotDatesNotInPast({
        isExtra: false,
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        todayStr,
        isEdit: true,
      })
    ).toBeNull();
  });
});

describe("isSlotLiveNow", () => {
  // Saturday 2026-11-28 at 11:30 AM (getDay() === 6)
  const sat1130 = new Date(2026, 10, 28, 11, 30, 0);

  it("returns true when weekday, date range, and current time fall inside the slot", () => {
    const slot: TimetableSlot = {
      ...baseSlot,
      weekday: 6,
      startTime: "11:00",
      endTime: "12:00",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
    };
    expect(isSlotLiveNow(slot, sat1130)).toBe(true);
  });

  it("returns false at exact endTime boundary and before startTime", () => {
    const sat1200 = new Date(2026, 10, 28, 12, 0, 0);
    const sat1059 = new Date(2026, 10, 28, 10, 59, 0);
    const slot: TimetableSlot = {
      ...baseSlot,
      weekday: 6,
      startTime: "11:00",
      endTime: "12:00",
    };
    expect(isSlotLiveNow(slot, sat1200)).toBe(false);
    expect(isSlotLiveNow(slot, sat1059)).toBe(false);
  });

  it("returns false for future-effective regular slot even if weekday & time match", () => {
    const futureSlot: TimetableSlot = {
      ...baseSlot,
      weekday: 6,
      startTime: "11:00",
      endTime: "12:00",
      validFrom: "2026-12-05",
      validTo: "2026-12-31",
    };
    expect(isSlotLiveNow(futureSlot, sat1130)).toBe(false);
  });

  it("returns true for an extra class scheduled specifically for today at the current time", () => {
    const extraToday: TimetableSlot = {
      ...baseSlot,
      weekday: 6,
      startTime: "11:00",
      endTime: "12:00",
      isTemporary: true,
      slotType: "extra",
      specificDate: "2026-11-28",
      validFrom: "2026-11-28",
      validTo: "2026-11-28",
    };
    expect(isSlotLiveNow(extraToday, sat1130)).toBe(true);
  });
});
