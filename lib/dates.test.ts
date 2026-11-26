import { test, describe } from "node:test";
import assert from "node:assert";
import {
  formatDateDisplay,
  formatTimeDisplay,
  formatTimeRange,
  formatMonthDisplay,
  calculateDuration,
  timeToMinutes,
  canCountForPreviousMonth,
  isMarkingWindowOpen,
  getMarkingWindowDetails,
  validateMakeupMonth,
} from "./dates.ts";

describe("Dates Library (Asia/Colombo)", () => {
  test("formats 24h time to 12h display", () => {
    assert.strictEqual(formatTimeDisplay("08:30"), "08:30 AM");
    assert.strictEqual(formatTimeDisplay("14:45"), "02:45 PM");
    assert.strictEqual(formatTimeDisplay("00:00"), "12:00 AM");
    assert.strictEqual(formatTimeDisplay("12:00"), "12:00 PM");
  });

  test("formats 24h time range to compact single-line display", () => {
    assert.strictEqual(formatTimeRange("16:00", "17:00"), "04:00 - 05:00 PM");
    assert.strictEqual(formatTimeRange("09:00", "11:00"), "09:00 - 11:00 AM");
    assert.strictEqual(formatTimeRange("11:00", "13:00"), "11:00 AM - 01:00 PM");
    assert.strictEqual(formatTimeRange("12:00", "14:30"), "12:00 - 02:30 PM");
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

  test("Marking window: open during 3 days after session, closed after", () => {
    // Session on 2026-03-10 at 10:00 AM
    // Starts: 2026-03-10 10:00 AM
    // Closes: 2026-03-13 23:59:59 PM (end of 3rd day)

    // Before session starts
    const beforeStart = new Date(2026, 2, 10, 9, 30);
    const beforeDetails = getMarkingWindowDetails("2026-03-10", "10:00", beforeStart);
    assert.strictEqual(beforeDetails.isOpen, false);
    assert.strictEqual(beforeDetails.isBeforeWindow, true);

    // 1 hour after session starts: OPEN (3 days left)
    const day1 = new Date(2026, 2, 10, 11, 0);
    const day1Details = getMarkingWindowDetails("2026-03-10", "10:00", day1);
    assert.strictEqual(day1Details.isOpen, true);
    assert.strictEqual(day1Details.daysLeft, 3);

    // 2 days after session: OPEN (1 day left)
    const day2 = new Date(2026, 2, 12, 12, 0);
    const day2Details = getMarkingWindowDetails("2026-03-10", "10:00", day2);
    assert.strictEqual(day2Details.isOpen, true);
    assert.strictEqual(day2Details.daysLeft, 1);

    // 4 days after session (March 14): LOCKED
    const day4 = new Date(2026, 2, 14, 10, 0);
    const day4Details = getMarkingWindowDetails("2026-03-10", "10:00", day4);
    assert.strictEqual(day4Details.isOpen, false);
    assert.strictEqual(day4Details.isPastWindow, true);
    assert.match(day4Details.statusLabel, /closed|Locked/i);
  });

  test("validateMakeupMonth: allows previous month up to 5th, refuses after 5th", () => {
    // On 4 March 2026: counting for Feb (2026-02) is allowed
    const mar4 = new Date(2026, 2, 4);
    const validFeb = validateMakeupMonth("2026-02", mar4);
    assert.strictEqual(validFeb.valid, true);

    // On 6 March 2026: counting for Feb (2026-02) is REFUSED
    const mar6 = new Date(2026, 2, 6);
    const invalidFeb = validateMakeupMonth("2026-02", mar6);
    assert.strictEqual(invalidFeb.valid, false);
    assert.match(invalidFeb.error || "", /up to the 5th/);

    // Current month (2026-03) is always allowed
    const validMar = validateMakeupMonth("2026-03", mar6);
    assert.strictEqual(validMar.valid, true);

    // January (2026-01) from March is strictly refused
    const invalidJan = validateMakeupMonth("2026-01", mar4);
    assert.strictEqual(invalidJan.valid, false);
    assert.match(invalidJan.error || "", /cannot count toward earlier months/);
  });

  test("calculateDuration formats difference between times", () => {
    assert.strictEqual(calculateDuration("15:00", "16:00"), "1 hr");
    assert.strictEqual(calculateDuration("09:00", "11:00"), "2 hrs");
    assert.strictEqual(calculateDuration("16:00", "17:30"), "1 hr 30 mins");
    assert.strictEqual(calculateDuration("10:00", "10:45"), "45 mins");
    assert.strictEqual(calculateDuration("", ""), "");
  });
});
