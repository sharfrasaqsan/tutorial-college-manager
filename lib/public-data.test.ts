import { describe, it } from "node:test";
import assert from "node:assert";
import { getPublicSiteData, DEFAULT_PUBLIC_SECTIONS } from "./public-data.ts";

describe("Public Site Data Service", () => {
  it("defaults public sections correctly", () => {
    assert.strictEqual(DEFAULT_PUBLIC_SECTIONS.showClasses, true);
    assert.strictEqual(DEFAULT_PUBLIC_SECTIONS.showTeacherStrip, true);
    assert.strictEqual(DEFAULT_PUBLIC_SECTIONS.showHero, true);
    assert.strictEqual(DEFAULT_PUBLIC_SECTIONS.showKeyFacts, true);
    assert.strictEqual(DEFAULT_PUBLIC_SECTIONS.showContactBlock, true);
  });

  it("fetches active year and populates classes, slots, and teachers without being empty", async () => {
    const data = await getPublicSiteData();
    assert.ok(data.activeYear, "Active year should be defined");
    assert.strictEqual(data.activeYear, "2026", "Active year should resolve to current year 2026");
    assert.ok(Array.isArray(data.classes), "Classes should be an array");
    assert.ok(data.classes.length > 0, "Classes array should not be empty");
    assert.ok(Array.isArray(data.slots), "Slots should be an array");
    assert.ok(data.slots.length > 0, "Slots array should not be empty");
    assert.ok(Array.isArray(data.teachers), "Teachers should be an array");
    assert.ok(data.teachers.length > 0, "Teachers array should not be empty");
  });
});
