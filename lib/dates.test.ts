import { test, describe } from "node:test";
import assert from "node:assert";
import {
  formatDateDisplay,
  formatTimeDisplay,
  formatMonthDisplay,
  timeToMinutes,
  canCountForPreviousMonth,
} from "./dates.ts";

describe("Dates Library (Asia/Colombo)", () => {
  test("formats 24h time to 12h display", () => {
    assert.strictEqual(formatTimeDisplay("08:30"), "08:30 AM");
    assert.strictEqual(formatTimeDisplay("14:45"), "02:45 PM");
    assert.strictEqual(formatTimeDisplay("00:00"), "12:00 AM");
    assert.strictEqual(formatTimeDisplay("12:00"), "12:00 PM");
  });

  test("formats month string YYYY-MM to full month name and year", () => {
    assert.strictEqual(formatMonthDisplay("2026-11"), "November 2026");
    assert.strictEqual(formatMonthDisplay("2026-01"), "January 2026");
  });

  test("converts time string to total minutes from midnight", () => {
    assert.strictEqual(timeToMinutes("08:30"), 510);
    assert.strictEqual(timeToMinutes("14:00"), 840);
  });

  test("checks if make-up counts for previous month (up to 5th)", () => {
    const fifthOfNov = new Date(2026, 10, 5); // 5 Nov 2026
    const sixthOfNov = new Date(2026, 10, 6); // 6 Nov 2026

    assert.strictEqual(canCountForPreviousMonth(fifthOfNov), true);
    assert.strictEqual(canCountForPreviousMonth(sixthOfNov), false);
  });
});
