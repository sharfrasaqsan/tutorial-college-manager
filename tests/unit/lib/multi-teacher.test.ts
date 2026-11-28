import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateClassSchema, UpdateClassSchema } from "@/lib/classes";
import { checkClash } from "@/lib/clash";
import type { TimeInterval } from "@/types";

vi.mock("@/lib/notifications", () => ({
  notifyUser: vi.fn().mockResolvedValue(undefined),
  getOwnerUserId: vi.fn().mockResolvedValue("owner_uid"),
  notify: vi.fn().mockResolvedValue(undefined),
}));

// Mock firebase-admin before importing recalculateClassSalary
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn();

const mockClassDoc = {
  exists: true,
  id: "class_multi",
  data: () => ({
    name: "Grade 08 Science",
    grade: "Grade 08",
    subject: "Science",
    isMultiTeacher: true,
    teacherId: "teacher_lead",
    teacherName: "Lead Teacher",
    teachers: [
      { teacherId: "teacher_lead", teacherName: "Lead Teacher", splitPercentage: 60, role: "primary" },
      { teacherId: "teacher_co", teacherName: "Co Teacher", splitPercentage: 40, role: "co_teacher" },
    ],
    currentTerms: {
      monthlyFee: 2500,
      teacherSharePerStudent: 1500,
      requiredSessionsPerMonth: 8,
      effectiveFromMonth: "2026-01",
    },
  }),
};

const mockFeesDocs = Array.from({ length: 10 }, (_, i) => ({
  id: `fee_${i}`,
  data: () => ({
    teacherShare: 1500,
    amount: 2500,
  }),
}));

const mockFeesSnap = {
  size: 10,
  forEach: (cb: any) => mockFeesDocs.forEach(cb),
};

const mockSessionsSnap = {
  size: 8,
};

const mockSalariesDoc = {
  exists: false,
  data: () => ({}),
};

vi.mock("@/lib/firebase-admin", () => {
  const firestoreMock: any = {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        collection: vi.fn((subCol: string) => {
          if (subCol === "classes") {
            return {
              doc: vi.fn(() => ({
                get: vi.fn().mockResolvedValue(mockClassDoc),
              })),
            };
          }
          if (subCol === "sessions") {
            return {
              where: vi.fn().mockReturnThis(),
              get: vi.fn().mockResolvedValue(mockSessionsSnap),
            };
          }
          if (subCol === "fees") {
            return {
              where: vi.fn().mockReturnThis(),
              get: vi.fn().mockResolvedValue(mockFeesSnap),
            };
          }
          if (subCol === "salaries") {
            return {
              doc: vi.fn(() => ({
                get: vi.fn().mockResolvedValue(mockSalariesDoc),
                set: mockSet,
              })),
            };
          }
          return {
            doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false }) })),
            where: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({ size: 0, forEach: () => {} }),
          };
        }),
      })),
    })),
  };
  return { adminDb: firestoreMock };
});

import { recalculateClassSalary } from "@/lib/salary-recalc";

describe("Multi-Teacher Co-Teaching System", () => {
  describe("CreateClassSchema & UpdateClassSchema Validation", () => {
    const baseValidClass = {
      yearId: "2026",
      grade: "Grade 08",
      subject: "Science",
      teacherId: "teacher_1",
      terms: {
        monthlyFee: 2500,
        teacherSharePerStudent: 1800,
        requiredSessionsPerMonth: 8,
        effectiveFromMonth: "2026-01",
      },
      schedules: [
        { weekday: 1, startTime: "08:00", endTime: "10:00" },
      ],
    };

    it("accepts a valid single-teacher class (backward compatible)", () => {
      const parsed = CreateClassSchema.safeParse(baseValidClass);
      expect(parsed.success).toBe(true);
    });

    it("accepts a valid multi-teacher class with 2 teachers (50% / 50%)", () => {
      const data = {
        ...baseValidClass,
        isMultiTeacher: true,
        teachers: [
          { teacherId: "teacher_1", splitPercentage: 50, role: "primary" },
          { teacherId: "teacher_2", splitPercentage: 50, role: "co_teacher" },
        ],
      };
      const parsed = CreateClassSchema.safeParse(data);
      expect(parsed.success).toBe(true);
    });

    it("accepts a valid multi-teacher class with 3 teachers (34% / 33% / 33%)", () => {
      const data = {
        ...baseValidClass,
        isMultiTeacher: true,
        teachers: [
          { teacherId: "teacher_1", splitPercentage: 34, role: "primary" },
          { teacherId: "teacher_2", splitPercentage: 33, role: "co_teacher" },
          { teacherId: "teacher_3", splitPercentage: 33, role: "co_teacher" },
        ],
      };
      const parsed = CreateClassSchema.safeParse(data);
      expect(parsed.success).toBe(true);
    });

    it("rejects multi-teacher class with only 1 teacher", () => {
      const data = {
        ...baseValidClass,
        isMultiTeacher: true,
        teachers: [
          { teacherId: "teacher_1", splitPercentage: 100, role: "primary" },
        ],
      };
      const parsed = CreateClassSchema.safeParse(data);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((e) => e.message.includes("2 or 3 teachers"))).toBe(true);
      }
    });

    it("rejects multi-teacher class with more than 3 teachers", () => {
      const data = {
        ...baseValidClass,
        isMultiTeacher: true,
        teachers: [
          { teacherId: "teacher_1", splitPercentage: 25 },
          { teacherId: "teacher_2", splitPercentage: 25 },
          { teacherId: "teacher_3", splitPercentage: 25 },
          { teacherId: "teacher_4", splitPercentage: 25 },
        ],
      };
      const parsed = CreateClassSchema.safeParse(data);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((e) => e.message.includes("2 or 3 teachers"))).toBe(true);
      }
    });

    it("rejects duplicate teacher IDs in multi-teacher class", () => {
      const data = {
        ...baseValidClass,
        isMultiTeacher: true,
        teachers: [
          { teacherId: "teacher_1", splitPercentage: 50 },
          { teacherId: "teacher_1", splitPercentage: 50 },
        ],
      };
      const parsed = CreateClassSchema.safeParse(data);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((e) => e.message.includes("Cannot select the same teacher multiple times"))).toBe(true);
      }
    });

    it("rejects split percentages that do not sum to exactly 100%", () => {
      const data = {
        ...baseValidClass,
        isMultiTeacher: true,
        teachers: [
          { teacherId: "teacher_1", splitPercentage: 60 },
          { teacherId: "teacher_2", splitPercentage: 30 },
        ],
      };
      const parsed = CreateClassSchema.safeParse(data);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((e) => e.message.includes("must equal 100%"))).toBe(true);
      }
    });

    it("validates UpdateClassSchema with multi-teacher rules", () => {
      const validUpdate = {
        isMultiTeacher: true,
        teachers: [
          { teacherId: "teacher_a", splitPercentage: 60 },
          { teacherId: "teacher_b", splitPercentage: 40 },
        ],
      };
      const parsed = UpdateClassSchema.safeParse(validUpdate);
      expect(parsed.success).toBe(true);

      const invalidUpdate = {
        isMultiTeacher: true,
        teachers: [
          { teacherId: "teacher_a", splitPercentage: 70 },
          { teacherId: "teacher_b", splitPercentage: 20 },
        ],
      };
      const parsedInvalid = UpdateClassSchema.safeParse(invalidUpdate);
      expect(parsedInvalid.success).toBe(false);
    });
  });

  describe("Clash Engine (checkClash) with Multi-Teacher Support", () => {
    it("detects a clash if ANY co-teacher is already teaching another class at that time", () => {
      const existingIntervals: TimeInterval[] = [
        {
          id: "slot-1",
          classId: "class-1",
          className: "Grade 07 English",
          grade: "Grade 07",
          teacherId: "teacher_perera",
          teacherName: "Mr. Perera",
          weekday: 1,
          startTime: "09:00",
          endTime: "11:00",
        },
      ];

      // Candidate co-taught class with Mr. Perera and Dr. Silva
      const candidate: TimeInterval = {
        id: "candidate-1",
        classId: "class-new",
        className: "Grade 08 Science",
        grade: "Grade 08",
        teacherId: "teacher_silva",
        teacherName: "Dr. Silva",
        teacherIds: ["teacher_silva", "teacher_perera"],
        teachers: [
          { teacherId: "teacher_silva", teacherName: "Dr. Silva", splitPercentage: 50, role: "primary" },
          { teacherId: "teacher_perera", teacherName: "Mr. Perera", splitPercentage: 50, role: "co_teacher" },
        ],
        isMultiTeacher: true,
        weekday: 1,
        startTime: "10:00",
        endTime: "12:00", // Overlaps 10:00 - 11:00 with slot-1
      };

      const result = checkClash(candidate, existingIntervals);
      expect(result.hasClash).toBe(true);
      expect(result.message).toContain("Mr. Perera");
      expect(result.message).toContain("Grade 07 English");
    });

    it("detects a clash when both candidate and existing are multi-teacher classes sharing a co-teacher", () => {
      const existingIntervals: TimeInterval[] = [
        {
          id: "slot-multi",
          classId: "class-existing-multi",
          className: "Grade 06 Combined Science",
          grade: "Grade 06",
          teacherId: "teacher_alpha",
          teacherName: "Teacher Alpha",
          teacherIds: ["teacher_alpha", "teacher_beta"],
          weekday: 2,
          startTime: "14:00",
          endTime: "16:00",
        },
      ];

      // Candidate co-taught class having teacher_beta and teacher_gamma
      const candidate: TimeInterval = {
        id: "candidate-2",
        classId: "class-new-multi",
        className: "Grade 08 Robotics",
        grade: "Grade 08",
        teacherId: "teacher_gamma",
        teacherName: "Teacher Gamma",
        teacherIds: ["teacher_gamma", "teacher_beta"],
        weekday: 2,
        startTime: "15:00",
        endTime: "17:00", // Overlaps 15:00 - 16:00
      };

      const result = checkClash(candidate, existingIntervals);
      expect(result.hasClash).toBe(true);
      expect(result.message).toContain("Grade 06 Combined Science");
    });

    it("allows scheduling when none of the co-teachers overlap with other classes", () => {
      const existingIntervals: TimeInterval[] = [
        {
          id: "slot-1",
          classId: "class-1",
          className: "Grade 07 English",
          grade: "Grade 07",
          teacherId: "teacher_other",
          teacherName: "Mr. Other",
          weekday: 1,
          startTime: "09:00",
          endTime: "11:00",
        },
      ];

      const candidate: TimeInterval = {
        id: "candidate-clean",
        classId: "class-clean",
        className: "Grade 08 Science",
        grade: "Grade 08",
        teacherId: "teacher_silva",
        teacherName: "Dr. Silva",
        teacherIds: ["teacher_silva", "teacher_perera"],
        weekday: 1,
        startTime: "09:00",
        endTime: "11:00",
      };

      const result = checkClash(candidate, existingIntervals);
      expect(result.hasClash).toBe(false);
    });

    it("respects the 3-room physical capacity limit across all classes", () => {
      const existingIntervals: TimeInterval[] = [
        { id: "s1", classId: "c1", className: "C1", grade: "G1", teacherId: "t1", weekday: 3, startTime: "08:00", endTime: "10:00" },
        { id: "s2", classId: "c2", className: "C2", grade: "G2", teacherId: "t2", weekday: 3, startTime: "08:00", endTime: "10:00" },
        { id: "s3", classId: "c3", className: "C3", grade: "G3", teacherId: "t3", weekday: 3, startTime: "08:00", endTime: "10:00" },
      ];

      // 4th concurrent class at the same time
      const candidate: TimeInterval = {
        id: "s4",
        classId: "c4",
        className: "C4",
        grade: "G4",
        teacherId: "t4",
        teacherIds: ["t4", "t5"],
        weekday: 3,
        startTime: "08:30",
        endTime: "09:30",
      };

      const result = checkClash(candidate, existingIntervals);
      expect(result.hasClash).toBe(true);
      expect(result.message).toContain("3 classrooms");
    });
  });

  describe("Salary Recalculation (Fixed Percentage Split)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("partitions the student fee share accurately according to splitPercentage", async () => {
      // 1. Recalculate salary for Lead Teacher (60% of 10 * 1500 = 15000 -> 9000)
      const leadResult = await recalculateClassSalary("2026", "teacher_lead", "class_multi", "2026-01");
      expect(leadResult).not.toBeNull();
      expect(leadResult!.amount).toBe(9000);
      expect(leadResult!.studentCount).toBe(10);
      expect(leadResult!.displayName).toContain("60%");

      // Verify stored record payload for Lead Teacher
      expect(mockSet).toHaveBeenCalledTimes(1);
      const leadPayload = mockSet.mock.calls[0][0];
      expect(leadPayload.amount).toBe(9000);
      expect(leadPayload.teacherId).toBe("teacher_lead");

      // 2. Recalculate salary for Co Teacher (40% of 10 * 1500 = 15000 -> 6000)
      const coResult = await recalculateClassSalary("2026", "teacher_co", "class_multi", "2026-01");
      expect(coResult).not.toBeNull();
      expect(coResult!.amount).toBe(6000);
      expect(coResult!.studentCount).toBe(10);
      expect(coResult!.displayName).toContain("40%");

      expect(mockSet).toHaveBeenCalledTimes(2);
      const coPayload = mockSet.mock.calls[1][0];
      expect(coPayload.amount).toBe(6000);
      expect(coPayload.teacherId).toBe("teacher_co");

      // Verify total payout sums exactly to pool
      expect(leadResult!.amount + coResult!.amount).toBe(15000);
    });
  });
});
