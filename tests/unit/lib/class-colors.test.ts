import { describe, it, expect } from "vitest";
import {
  CLASS_COLOR_PALETTE,
  getClassColor,
  getUsedClassColors,
  getAvailableClassColor,
} from "@/lib/class-colors";

describe("class-colors utility", () => {
  describe("getUsedClassColors", () => {
    it("collects used color IDs from an array of classes", () => {
      const classes = [
        { id: "c1", color: "blue", grade: "Grade 06", subject: "English" },
        { id: "c2", color: "emerald", grade: "Grade 06", subject: "Science" },
        { id: "c3", grade: "Grade 06", subject: "Maths" }, // resolved via getClassColor
      ];

      const used = getUsedClassColors(classes);
      expect(used.has("blue")).toBe(true);
      expect(used.has("emerald")).toBe(true);
      expect(used.has(getClassColor(classes[2]).id.toLowerCase())).toBe(true);
    });

    it("excludes class with excludeClassId when editing", () => {
      const classes = [
        { id: "c1", color: "purple", grade: "Grade 06", subject: "ICT" },
        { id: "c2", color: "amber", grade: "Grade 06", subject: "Maths" },
      ];

      const used = getUsedClassColors(classes, "c1");
      expect(used.has("purple")).toBe(false);
      expect(used.has("amber")).toBe(true);
    });
  });

  describe("getAvailableClassColor", () => {
    it("returns preferred color if it is not yet used", () => {
      const existingClasses = [
        { id: "c1", color: "indigo" },
        { id: "c2", color: "emerald" },
      ];

      // Grade 06 English prefers "blue" which is NOT in existingClasses
      const color = getAvailableClassColor(existingClasses, {
        grade: "Grade 06",
        subject: "English",
      });
      expect(color).toBe("blue");
    });

    it("does NOT repeat color if preferred color is already used", () => {
      const existingClasses = [
        { id: "c1", color: "blue" }, // Blue is already used by c1
      ];

      // Grade 06 English would normally prefer "blue", but it is already used
      const color = getAvailableClassColor(existingClasses, {
        grade: "Grade 06",
        subject: "English",
      });

      // Must NOT be "blue"
      expect(color).not.toBe("blue");
      expect(CLASS_COLOR_PALETTE.some((c) => c.id === color)).toBe(true);
    });

    it("picks completely unused colors sequentially without any duplicates", () => {
      const assignedColors: string[] = [];

      for (let i = 0; i < 12; i++) {
        const existing = assignedColors.map((col, idx) => ({
          id: `class-${idx}`,
          color: col,
        }));
        const nextColor = getAvailableClassColor(existing);
        expect(assignedColors).not.toContain(nextColor);
        assignedColors.push(nextColor);
      }

      // All 12 distinct palette colors should be used with 0 duplicates
      expect(new Set(assignedColors).size).toBe(12);
      expect(assignedColors).toHaveLength(12);
    });

    it("gracefully picks least frequently used color when all 12 colors are exhausted", () => {
      // Create 12 classes using all 12 palette colors
      const existing = CLASS_COLOR_PALETTE.map((c, idx) => ({
        id: `class-${idx}`,
        color: c.id,
      }));

      // Add a 13th class
      const nextColor = getAvailableClassColor(existing);
      expect(CLASS_COLOR_PALETTE.some((c) => c.id === nextColor)).toBe(true);
    });
  });
});
