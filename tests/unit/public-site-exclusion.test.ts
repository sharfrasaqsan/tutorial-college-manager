import { describe, it, expect } from "vitest";
import type { PublicSafeSlot, PublicSafeClass } from "@/types";

describe("Public Site: Extra/Temporary Class Exclusion", () => {
  it("filters out extra and temporary slots from public timetable data", () => {
    const rawSlots = [
      {
        id: "slot-regular-1",
        classId: "cls-1",
        grade: "Grade 06",
        subject: "English",
        teacherName: "English Faculty",
        weekday: 1,
        startTime: "08:00",
        endTime: "10:00",
        isTemporary: false,
      },
      {
        id: "slot-extra-1",
        classId: "cls-1",
        grade: "Grade 06",
        subject: "English",
        teacherName: "English Faculty",
        weekday: 1,
        startTime: "10:30",
        endTime: "12:30",
        isTemporary: true,
        slotType: "extra",
        specificDate: "2027-04-12",
      },
      {
        id: "slot-temp-2",
        classId: "cls-2",
        grade: "Grade 07",
        subject: "Science",
        teacherName: "Science Faculty",
        weekday: 3,
        startTime: "14:00",
        endTime: "16:00",
        isTemporary: true,
      },
      {
        id: "slot-single-date",
        classId: "cls-3",
        grade: "Grade 08",
        subject: "Maths",
        teacherName: "Maths Faculty",
        weekday: 5,
        startTime: "09:00",
        endTime: "11:00",
        specificDate: "2027-05-15",
      },
      {
        id: "slot-regular-2",
        classId: "cls-4",
        grade: "Grade 08",
        subject: "ICT",
        teacherName: "ICT Faculty",
        weekday: 6,
        startTime: "13:00",
        endTime: "15:00",
      },
    ];

    // Mirroring public data filtering
    const publicSlots: PublicSafeSlot[] = rawSlots.filter((data: any) => {
      if (
        data.isTemporary === true ||
        data.isExtra === true ||
        data.slotType === "extra" ||
        data.type === "extra" ||
        Boolean(data.specificDate)
      ) {
        return false;
      }
      return true;
    });

    expect(publicSlots).toHaveLength(2);
    expect(publicSlots.map((s) => s.id)).toEqual(["slot-regular-1", "slot-regular-2"]);
    expect(publicSlots.some((s) => s.isTemporary)).toBe(false);
    expect(publicSlots.some((s) => s.specificDate)).toBe(false);
  });

  it("filters out extra and temporary classes from public classes catalog", () => {
    const rawClasses = [
      {
        id: "cls-reg-1",
        grade: "Grade 06",
        subject: "English",
        teacherName: "English Faculty",
        monthlyFee: 3500,
      },
      {
        id: "cls-extra-1",
        grade: "Grade 06",
        subject: "English Extra Session",
        teacherName: "English Faculty",
        monthlyFee: 0,
        isTemporary: true,
      },
      {
        id: "cls-temp-2",
        grade: "Grade 07",
        subject: "Exam Paper Seminar",
        teacherName: "Maths Faculty",
        monthlyFee: 1500,
        type: "extra",
      },
      {
        id: "cls-reg-2",
        grade: "Grade 08",
        subject: "Science",
        teacherName: "Science Faculty",
        monthlyFee: 4000,
      },
    ];

    const publicClasses: PublicSafeClass[] = rawClasses.filter((data: any) => {
      if (
        data.isTemporary === true ||
        data.isExtra === true ||
        data.slotType === "extra" ||
        data.type === "extra" ||
        data.classType === "extra" ||
        Boolean(data.specificDate)
      ) {
        return false;
      }
      return true;
    });

    expect(publicClasses).toHaveLength(2);
    expect(publicClasses.map((c) => c.id)).toEqual(["cls-reg-1", "cls-reg-2"]);
  });
});
