import { format, parseISO, addDays, isAfter, startOfDay, endOfDay, subMonths, differenceInCalendarDays } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

export const COLLEGE_TIMEZONE = "Asia/Colombo";

/**
 * Returns the current date in Asia/Colombo
 */
export function getColomboNow(): Date {
  return toZonedTime(new Date(), COLLEGE_TIMEZONE);
}

/**
 * Format a date as "Tue 24 Nov 2026" in Asia/Colombo
 */
export function formatColomboDate(date: Date | string): string {
  if (!date) return "";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    const zoned = toZonedTime(d, COLLEGE_TIMEZONE);
    return format(zoned, "EEE d MMM yyyy");
  } catch {
    return String(date);
  }
}

/**
 * Format a date in Asia/Colombo using a custom date-fns pattern
 */
export function formatColomboPattern(date: Date | string, patternStr: string): string {
  if (!date) return "";
  try {
    const d = typeof date === "string" ? parseISO(date) : date;
    const zoned = toZonedTime(d, COLLEGE_TIMEZONE);
    return format(zoned, patternStr);
  } catch {
    return String(date);
  }
}

/**
 * Format a date as "Tue 24 Nov"
 */
export function formatDateDisplay(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  const zoned = toZonedTime(d, COLLEGE_TIMEZONE);
  return format(zoned, "EEE d MMM");
}

/**
 * Format a date as "24 Nov 2026"
 */
export function formatDateWithYear(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  const zoned = toZonedTime(d, COLLEGE_TIMEZONE);
  return format(zoned, "d MMM yyyy");
}

/**
 * Format a 24h time string "14:30" to "02:30 PM"
 */
export function formatTimeDisplay(time24: string): string {
  if (!time24) return "";
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const paddedM = m < 10 ? `0${m}` : `${m}`;
  const paddedH = h12 < 10 ? `0${h12}` : `${h12}`;
  return `${paddedH}:${paddedM} ${period}`;
}

/**
 * Format month key "YYYY-MM" to "November 2026"
 */
export function formatMonthDisplay(yyyyMm: string): string {
  if (!yyyyMm || !yyyyMm.includes("-")) return yyyyMm;
  const [year, month] = yyyyMm.split("-");
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return format(date, "MMMM yyyy");
}

/**
 * Get current month key in Colombo "YYYY-MM"
 */
export function getCurrentMonthKey(): string {
  const now = getColomboNow();
  return format(now, "yyyy-MM");
}

/**
 * Check if a session can currently be marked by a teacher:
 * "The teacher marks Held or Missed from the session start until the end of the 3rd day after the session date."
 */
export function isMarkingWindowOpen(sessionDateStr: string, sessionStartTime: string): boolean {
  const now = getColomboNow();
  const [sHour, sMin] = sessionStartTime.split(":").map((v) => parseInt(v, 10));
  const sessionDate = parseISO(sessionDateStr);
  const sessionStart = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate(), sHour, sMin);

  // Must have reached session start
  if (isAfter(sessionStart, now)) {
    return false;
  }

  // Window closes at the end of the 3rd day after session date
  const windowEnd = endOfDay(addDays(sessionDate, 3));
  return !isAfter(now, windowEnd);
}

/**
 * Check if make-up session can count for previous month:
 * "A make-up may count toward the previous month up to the 5th of the current month."
 */
export function canCountForPreviousMonth(currentDate: Date = getColomboNow()): boolean {
  const dayOfMonth = currentDate.getDate();
  return dayOfMonth <= 5;
}

export interface MarkingWindowDetails {
  isOpen: boolean;
  isPastWindow: boolean;
  isBeforeWindow: boolean;
  daysLeft: number;
  deadlineDisplay: string;
  statusLabel: string;
}

/**
 * Returns comprehensive details about the marking window for a session.
 * Window: starts at session start and closes at the end of the 3rd day after the session date.
 */
export function getMarkingWindowDetails(
  sessionDateStr: string,
  sessionStartTime: string,
  now: Date = getColomboNow()
): MarkingWindowDetails {
  const [sHour, sMin] = sessionStartTime.split(":").map((v) => parseInt(v, 10));
  const sessionDate = parseISO(sessionDateStr);
  const sessionStart = new Date(
    sessionDate.getFullYear(),
    sessionDate.getMonth(),
    sessionDate.getDate(),
    sHour,
    sMin
  );

  const windowEnd = endOfDay(addDays(sessionDate, 3));
  const deadlineDisplay = formatColomboDate(windowEnd);

  if (isAfter(sessionStart, now)) {
    return {
      isOpen: false,
      isPastWindow: false,
      isBeforeWindow: true,
      daysLeft: 3,
      deadlineDisplay,
      statusLabel: "Starts at " + formatTimeDisplay(sessionStartTime),
    };
  }

  if (isAfter(now, windowEnd)) {
    return {
      isOpen: false,
      isPastWindow: true,
      isBeforeWindow: false,
      daysLeft: 0,
      deadlineDisplay,
      statusLabel: "Marking window closed (Locked)",
    };
  }

  // Calculate calendar days left until end of 3rd day
  const daysDiff = differenceInCalendarDays(windowEnd, now);
  const daysLeft = Math.max(0, Math.min(3, daysDiff));

  let statusLabel = `${daysLeft} days left`;
  if (daysLeft === 0) {
    statusLabel = "Last day to mark";
  } else if (daysLeft === 1) {
    statusLabel = "1 day left";
  }

  return {
    isOpen: true,
    isPastWindow: false,
    isBeforeWindow: false,
    daysLeft,
    deadlineDisplay,
    statusLabel,
  };
}

/**
 * Validates which month a make-up session can count for:
 * "A make-up may count toward the previous month up to the 5th of the current month."
 */
export function validateMakeupMonth(
  countsForMonth: string,
  now: Date = getColomboNow()
): { valid: boolean; error?: string } {
  const currentMonth = format(now, "yyyy-MM");
  const prevMonth = format(subMonths(now, 1), "yyyy-MM");

  if (countsForMonth === currentMonth) {
    return { valid: true };
  }

  if (countsForMonth === prevMonth) {
    if (now.getDate() <= 5) {
      return { valid: true };
    }
    return {
      valid: false,
      error: `A make-up class may only count toward ${formatMonthDisplay(
        prevMonth
      )} up to the 5th of this month.`,
    };
  }

  if (countsForMonth < prevMonth) {
    return {
      valid: false,
      error: `A make-up class cannot count toward earlier months prior to ${formatMonthDisplay(
        prevMonth
      )}.`,
    };
  }

  return { valid: true };
}

/**
 * Convert time string "HH:mm" to total minutes from midnight
 */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const SHORT_WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getWeekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday] || "";
}

export function getShortWeekdayName(weekday: number): string {
  return SHORT_WEEKDAY_NAMES[weekday] || "";
}
