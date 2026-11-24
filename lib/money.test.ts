import { test, describe } from "node:test";
import assert from "node:assert";
import { formatLKR, parseLKR, calculateClassSalaryTotal } from "./money.ts";

describe("Money Library (LKR)", () => {
  test("formats positive integer amounts with commas and LKR prefix", () => {
    assert.strictEqual(formatLKR(12500), "LKR 12,500");
    assert.strictEqual(formatLKR(0), "LKR 0");
    assert.strictEqual(formatLKR(1500000), "LKR 1,500,000");
  });

  test("handles null, undefined and NaN gracefully", () => {
    assert.strictEqual(formatLKR(null), "LKR 0");
    assert.strictEqual(formatLKR(undefined), "LKR 0");
    assert.strictEqual(formatLKR(NaN), "LKR 0");
  });

  test("formats fractional amounts with 2 decimal places", () => {
    assert.strictEqual(formatLKR(1250.5), "LKR 1,250.50");
  });

  test("parses formatted string back to number", () => {
    assert.strictEqual(parseLKR("LKR 12,500"), 12500);
    assert.strictEqual(parseLKR("12500"), 12500);
    assert.strictEqual(parseLKR(""), 0);
  });

  test("calculates class salary accurately", () => {
    assert.strictEqual(calculateClassSalaryTotal(1200, 25), 30000);
  });
});
