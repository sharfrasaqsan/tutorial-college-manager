import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CLASS_COLOR_PALETTE,
  CLASS_COLORS_BY_ID,
  getClassColor,
} from "./class-colors.ts";

describe("Class Color Domain & Palette Helpers", () => {
  it("provides 12 distinct accessible color themes in the palette", () => {
    assert.equal(CLASS_COLOR_PALETTE.length, 12);
    for (const color of CLASS_COLOR_PALETTE) {
      assert.ok(color.id, "color must have id");
      assert.ok(color.hex.startsWith("#"), "color hex must be valid hex");
      assert.ok(color.accent.startsWith("#"), "accent must be valid hex");
      assert.ok(color.bg.startsWith("#"), "bg must be valid hex");
      assert.ok(color.text.startsWith("#"), "text must be valid hex");
      assert.ok(color.badgeBg.startsWith("#"), "badgeBg must be valid hex");
      assert.ok(color.badgeText.startsWith("#"), "badgeText must be valid hex");
    }
  });

  it("resolves default curriculum subjects to consistent standard colors", () => {
    const english = getClassColor("English");
    assert.equal(english.id, "blue");

    const maths = getClassColor("Mathematics");
    assert.equal(maths.id, "indigo");

    const science = getClassColor("Science");
    assert.equal(science.id, "emerald");

    const ict = getClassColor("ICT");
    assert.equal(ict.id, "purple");
  });

  it("prioritizes explicit color override when specified", () => {
    const customMaths = getClassColor({
      subject: "Maths",
      color: "rose",
    });
    assert.equal(customMaths.id, "rose");

    const customScience = getClassColor({
      subject: "Science",
      color: "amber",
    });
    assert.equal(customScience.id, "amber");
  });

  it("resolves class names with grade prefixes", () => {
    const g6Eng = getClassColor({ name: "Grade 06 English" });
    assert.equal(g6Eng.id, "blue");

    const g7Mat = getClassColor({ name: "Grade 07 Maths" });
    assert.equal(g7Mat.id, "indigo");

    const g6Mat = getClassColor({ name: "Grade 06 Maths" });
    assert.equal(g6Mat.id, "amber");

    const g8Sci = getClassColor({ name: "Grade 08 Science" });
    assert.equal(g8Sci.id, "lime");

    const g7Sci = getClassColor({ grade: "Grade 07", subject: "Science" });
    assert.equal(g7Sci.id, "teal");
  });

  it("deterministically falls back to hash for unknown or novel subjects", () => {
    const unknown1 = getClassColor("Robotics");
    const unknown2 = getClassColor("Robotics");
    assert.equal(unknown1.id, unknown2.id);
    assert.ok(CLASS_COLORS_BY_ID[unknown1.id]);
  });

  it("safely handles null, undefined, or empty inputs", () => {
    const c1 = getClassColor();
    assert.ok(c1);
    const c2 = getClassColor("");
    assert.ok(c2);
    const c3 = getClassColor(null as any);
    assert.ok(c3);
  });
});
