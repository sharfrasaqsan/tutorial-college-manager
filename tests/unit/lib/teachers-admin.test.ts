import { describe, it, expect } from "vitest";
import { CreateTeacherSchema, UpdateTeacherSchema, ToggleTeacherStatusSchema } from "@/lib/teachers";
import type { TeacherAssignedClass, ClassTeacherAssignment } from "@/types";

describe("Teachers Admin - Schemas & Business Logic", () => {
  describe("CreateTeacherSchema Validation", () => {
    it("accepts valid teacher registration data", () => {
      const valid = {
        name: "Mr. Sunil Perera",
        email: "sunil@college.lk",
        phone: "0771234567",
        subjects: ["Combined Maths", "Physics"],
        bio: "Senior lecturer with 12 years experience.",
        showOnPublicSite: true,
        password: "securePassword123",
      };
      const result = CreateTeacherSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Mr. Sunil Perera");
        expect(result.data.email).toBe("sunil@college.lk");
        expect(result.data.phone).toBe("0771234567");
      }
    });

    it("rejects invalid contact phone with fewer than 7 digits", () => {
      const invalid = {
        name: "Mr. Sunil Perera",
        email: "sunil@college.lk",
        phone: "12345",
        subjects: ["Physics"],
      };
      const result = CreateTeacherSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("phone"))).toBe(true);
      }
    });

    it("rejects password shorter than 6 characters when provided", () => {
      const invalid = {
        name: "Mr. Sunil Perera",
        email: "sunil@college.lk",
        phone: "0771234567",
        password: "123",
      };
      const result = CreateTeacherSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("password"))).toBe(true);
      }
    });

    it("allows empty password for auto-generation", () => {
      const valid = {
        name: "Mr. Sunil Perera",
        email: "sunil@college.lk",
        phone: "0771234567",
        password: "",
      };
      const result = CreateTeacherSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects invalid email formats", () => {
      const invalid = {
        name: "Mr. Sunil Perera",
        email: "not-an-email",
        phone: "0771234567",
      };
      const result = CreateTeacherSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("email"))).toBe(true);
      }
    });
  });

  describe("UpdateTeacherSchema Validation", () => {
    it("accepts valid teacher profile updates", () => {
      const valid = {
        name: "Dr. Sunil Perera",
        phone: "0779876543",
        bio: "Updated qualifications and publications.",
        subjects: ["Combined Maths", "Pure Maths", "Applied Maths"],
        showOnPublicSite: false,
      };
      const result = UpdateTeacherSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Dr. Sunil Perera");
        expect(result.data.showOnPublicSite).toBe(false);
      }
    });

    it("rejects names shorter than 2 characters", () => {
      const invalid = {
        name: "A",
        phone: "0779876543",
        subjects: ["Maths"],
      };
      const result = UpdateTeacherSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("ToggleTeacherStatusSchema Validation", () => {
    it("validates activation and deactivation booleans", () => {
      expect(ToggleTeacherStatusSchema.safeParse({ active: true }).success).toBe(true);
      expect(ToggleTeacherStatusSchema.safeParse({ active: false }).success).toBe(true);
      expect(ToggleTeacherStatusSchema.safeParse({ active: "invalid" }).success).toBe(false);
    });
  });

  describe("Class Assignment & Multi-Teacher Unassignment Logic", () => {
    it("maps single and co-taught classes correctly to teacher IDs", () => {
      const mockClasses = [
        {
          id: "class-1",
          grade: "Grade 10",
          subject: "Science",
          teacherId: "teacher-A",
          teachers: undefined,
          isMultiTeacher: false,
        },
        {
          id: "class-2",
          grade: "Grade 11",
          subject: "Combined Maths",
          teacherId: "teacher-A",
          teacherIds: ["teacher-A", "teacher-B"],
          isMultiTeacher: true,
          teachers: [
            { teacherId: "teacher-A", teacherName: "Teacher A", splitPercentage: 60, role: "primary" },
            { teacherId: "teacher-B", teacherName: "Teacher B", splitPercentage: 40, role: "co_teacher" },
          ],
        },
      ];

      const classesMap: Record<string, TeacherAssignedClass[]> = {};

      mockClasses.forEach((cdata) => {
        const classInfo: TeacherAssignedClass = {
          id: cdata.id,
          name: `${cdata.grade} ${cdata.subject}`.trim(),
          grade: cdata.grade,
          subject: cdata.subject,
          isMultiTeacher: Boolean(cdata.isMultiTeacher),
        };

        if (cdata.teacherId) {
          if (!classesMap[cdata.teacherId]) classesMap[cdata.teacherId] = [];
          if (!classesMap[cdata.teacherId].some((ci) => ci.id === cdata.id)) {
            classesMap[cdata.teacherId].push(classInfo);
          }
        }

        if (Array.isArray(cdata.teachers)) {
          cdata.teachers.forEach((t) => {
            if (t.teacherId) {
              if (!classesMap[t.teacherId]) classesMap[t.teacherId] = [];
              if (!classesMap[t.teacherId].some((ci) => ci.id === cdata.id)) {
                classesMap[t.teacherId].push(classInfo);
              }
            }
          });
        }
      });

      // Teacher A has 2 classes (1 single + 1 co-taught)
      expect(classesMap["teacher-A"]).toHaveLength(2);
      expect(classesMap["teacher-A"][0].name).toBe("Grade 10 Science");
      expect(classesMap["teacher-A"][1].isMultiTeacher).toBe(true);

      // Teacher B has 1 co-taught class
      expect(classesMap["teacher-B"]).toHaveLength(1);
      expect(classesMap["teacher-B"][0].name).toBe("Grade 11 Combined Maths");
      expect(classesMap["teacher-B"][0].isMultiTeacher).toBe(true);
    });

    it("unassigns a teacher from a 2-teacher co-taught class leaving 1 sole teacher with 100% split", () => {
      const currentTeachers: ClassTeacherAssignment[] = [
        { teacherId: "teacher-A", teacherName: "Teacher A", splitPercentage: 60, role: "primary" },
        { teacherId: "teacher-B", teacherName: "Teacher B", splitPercentage: 40, role: "co_teacher" },
      ];

      // Delete teacher-A
      const deletedId = "teacher-A";
      const remaining = currentTeachers.filter((t) => t.teacherId !== deletedId);

      expect(remaining).toHaveLength(1);
      const soleTeacher = remaining[0];
      const updatedClass = {
        teacherId: soleTeacher.teacherId,
        teacherName: soleTeacher.teacherName,
        isMultiTeacher: false,
        teachers: [{ ...soleTeacher, splitPercentage: 100, role: "primary" as const }],
        teacherIds: [soleTeacher.teacherId],
      };

      expect(updatedClass.isMultiTeacher).toBe(false);
      expect(updatedClass.teacherId).toBe("teacher-B");
      expect(updatedClass.teachers[0].splitPercentage).toBe(100);
      expect(updatedClass.teachers[0].role).toBe("primary");
    });

    it("normalizes split to 100% when 1 teacher is deleted from a 3-teacher class", () => {
      const currentTeachers: ClassTeacherAssignment[] = [
        { teacherId: "teacher-A", teacherName: "Teacher A", splitPercentage: 40, role: "primary" },
        { teacherId: "teacher-B", teacherName: "Teacher B", splitPercentage: 30, role: "co_teacher" },
        { teacherId: "teacher-C", teacherName: "Teacher C", splitPercentage: 30, role: "co_teacher" },
      ];

      // Delete teacher-A
      const deletedId = "teacher-A";
      const remaining = currentTeachers.filter((t) => t.teacherId !== deletedId);
      expect(remaining).toHaveLength(2);

      const totalRemaining = remaining.reduce((s, t) => s + (t.splitPercentage || 0), 0) || 100;
      const reallocated = remaining.map((t, idx) => ({
        ...t,
        splitPercentage: Math.round(((t.splitPercentage || 50) / totalRemaining) * 100),
        role: idx === 0 ? ("primary" as const) : ("co_teacher" as const),
      }));
      const sumSplit = reallocated.reduce((s, t) => s + t.splitPercentage, 0);
      if (sumSplit !== 100 && reallocated.length > 0) {
        reallocated[0].splitPercentage += 100 - sumSplit;
      }

      expect(reallocated).toHaveLength(2);
      expect(reallocated.reduce((s, t) => s + t.splitPercentage, 0)).toBe(100);
      expect(reallocated[0].splitPercentage).toBe(50);
      expect(reallocated[1].splitPercentage).toBe(50);
      expect(reallocated[0].role).toBe("primary");
    });

    it("resets class to Unassigned when sole teacher is deleted", () => {
      const currentTeachers: ClassTeacherAssignment[] = [
        { teacherId: "teacher-A", teacherName: "Teacher A", splitPercentage: 100, role: "primary" },
      ];

      const deletedId = "teacher-A";
      const remaining = currentTeachers.filter((t) => t.teacherId !== deletedId);

      expect(remaining).toHaveLength(0);
      const updatedClass = {
        teacherId: "",
        teacherName: "Unassigned",
        isMultiTeacher: false,
        teachers: [],
        teacherIds: [],
      };

      expect(updatedClass.teacherId).toBe("");
      expect(updatedClass.teacherName).toBe("Unassigned");
      expect(updatedClass.isMultiTeacher).toBe(false);
      expect(updatedClass.teachers).toHaveLength(0);
    });
  });
});
