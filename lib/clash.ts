import { timeToMinutes, formatTimeDisplay, getWeekdayName, formatDateDisplay } from "./dates.ts";
import { parseISO } from "date-fns";
import type { TimeInterval } from "../types/index.ts";

export interface ClashCheckResult {
  hasClash: boolean;
  message?: string;
  hasGradeWarning?: boolean;
  warningMessage?: string;
  gradeConflictClass?: string;
  overlappingGradeClasses?: Array<{
    className: string;
    grade: string;
    teacherName?: string;
    startTime: string;
    endTime: string;
  }>;
}

/**
 * Checks if two time windows overlap (touching endpoints are allowed).
 */
export function doIntervalsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const minStartA = timeToMinutes(startA);
  const minEndA = timeToMinutes(endA);
  const minStartB = timeToMinutes(startB);
  const minEndB = timeToMinutes(endB);

  // Touching is allowed (e.g. 10:00-11:00 and 11:00-12:00 do not overlap)
  return minStartA < minEndB && minStartB < minEndA;
}

/**
 * Helper to resolve weekday from either explicit weekday number/string or date string
 */
function resolveWeekday(interval: TimeInterval): number | undefined {
  if (interval.weekday !== undefined && interval.weekday !== null) {
    const num = Number(interval.weekday);
    if (!isNaN(num)) return num;
  }
  if (interval.date) {
    try {
      return parseISO(interval.date).getDay();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Shared clash detection function for timetable slots, make-ups, and sessions.
 * Enforced on server transactions.
 *
 * Rules:
 * 1. A teacher cannot have two overlapping sessions.
 * 2. The same class cannot have two overlapping sessions.
 * 3. At most 3 classes may overlap at any moment (college has 3 rooms; rooms are NOT tracked).
 * 4. Classes of the same grade MAY overlap (if rooms <= 3 and different teachers).
 * Touching times (one ends when another starts) are allowed.
 * Errors are plain sentences that name the conflict.
 */
export function checkClash(
  candidate: TimeInterval,
  existingIntervals: TimeInterval[]
): ClashCheckResult {
  const candStartMin = timeToMinutes(candidate.startTime);
  const candEndMin = timeToMinutes(candidate.endTime);

  if (candStartMin >= candEndMin) {
    return {
      hasClash: true,
      message: "End time must be after start time.",
    };
  }

  const candWeekday = resolveWeekday(candidate);

  // Filter intervals for the relevant day (ignore self if editing)
  const relevant = existingIntervals.filter((item) => {
    if (candidate.id && item.id && candidate.id === item.id) return false;

    // Both are specific calendar dates
    if (candidate.date && item.date) {
      return candidate.date === item.date;
    }

    // Compare resolved weekdays (handles numbers, strings, and date-to-weekday resolution)
    const itemWeekday = resolveWeekday(item);
    if (candWeekday !== undefined && itemWeekday !== undefined) {
      return candWeekday === itemWeekday;
    }

    return true;
  });

  const candTeacher = candidate.teacherId?.trim();
  const candClass = candidate.classId?.trim();

  // Rule 1: Teacher conflict & Same-Class conflict
  for (const existing of relevant) {
    const existTeacher = existing.teacherId?.trim();
    const existClass = existing.classId?.trim();

    // Teacher conflict
    if (
      candTeacher &&
      existTeacher &&
      candTeacher === existTeacher &&
      doIntervalsOverlap(
        candidate.startTime,
        candidate.endTime,
        existing.startTime,
        existing.endTime
      )
    ) {
      const teacherName = candidate.teacherName || existing.teacherName || "The teacher";
      const existW = resolveWeekday(existing);
      const dayContext = existing.date
        ? `on ${formatDateDisplay(existing.date)} `
        : existW !== undefined
        ? `on ${getWeekdayName(existW)} `
        : "";
      const classContext = existing.className ? `${existing.className} ` : "";
      return {
        hasClash: true,
        message: `${teacherName} already teaches ${classContext}${dayContext}from ${formatTimeDisplay(
          existing.startTime
        )} to ${formatTimeDisplay(existing.endTime)}.`.replace(/\s+/g, " ").replace(" .", "."),
      };
    }

    // Same-class overlapping session conflict
    if (
      candClass &&
      existClass &&
      candClass === existClass &&
      doIntervalsOverlap(
        candidate.startTime,
        candidate.endTime,
        existing.startTime,
        existing.endTime
      )
    ) {
      const existW = resolveWeekday(existing);
      const dayContext = existing.date
        ? `on ${formatDateDisplay(existing.date)} `
        : existW !== undefined
        ? `on ${getWeekdayName(existW)} `
        : "";
      return {
        hasClash: true,
        message: `${candidate.className || "This class"} already has a session ${dayContext}from ${formatTimeDisplay(
          existing.startTime
        )} to ${formatTimeDisplay(existing.endTime)}.`.replace(/\s+/g, " ").replace(" .", "."),
      };
    }
  }

  // Rule 3: Maximum 3 simultaneous classes at any moment
  // Find all intervals that overlap with candidate
  const overlapping = relevant.filter((item) =>
    doIntervalsOverlap(
      candidate.startTime,
      candidate.endTime,
      item.startTime,
      item.endTime
    )
  );

  // Point-in-time capacity check across all critical time boundaries
  const timePoints = new Set<number>();
  timePoints.add(candStartMin);
  for (const item of overlapping) {
    const s = timeToMinutes(item.startTime);
    const e = timeToMinutes(item.endTime);
    if (s > candStartMin && s < candEndMin) timePoints.add(s);
    if (e > candStartMin && e < candEndMin) timePoints.add(e);
  }

  for (const t of timePoints) {
    let activeClassesCount = 1; // candidate itself

    for (const item of overlapping) {
      const s = timeToMinutes(item.startTime);
      const e = timeToMinutes(item.endTime);
      if (s <= t && e > t) {
        activeClassesCount++;
      }
    }

    if (activeClassesCount > 3) {
      return {
        hasClash: true,
        message: "Three classes already run at that time. We currently have 3 classrooms.",
      };
    }
  }

  // Rule 4: Same-grade concurrent scheduling check
  // Classes of the same grade can be scheduled with different teachers (rooms <= 3),
  // but require an explicit confirmation alert and an owner push notification.
  let hasGradeWarning = false;
  let warningMessage: string | undefined = undefined;
  let gradeConflictClass: string | undefined = undefined;
  const overlappingGradeClasses: Array<{
    className: string;
    grade: string;
    teacherName?: string;
    startTime: string;
    endTime: string;
  }> = [];

  const candGrade = candidate.grade?.trim().toLowerCase();
  if (candGrade) {
    for (const item of overlapping) {
      const itemGrade = item.grade?.trim().toLowerCase();
      // If same grade and different class/session
      if (
        itemGrade &&
        itemGrade === candGrade &&
        (candidate.classId ? candidate.classId !== item.classId : true)
      ) {
        hasGradeWarning = true;
        const otherName =
          item.className || (item.grade ? `${item.grade} class` : "Another class");
        if (!gradeConflictClass) gradeConflictClass = otherName;
        overlappingGradeClasses.push({
          className: otherName,
          grade: item.grade || candidate.grade || "",
          teacherName: item.teacherName,
          startTime: item.startTime,
          endTime: item.endTime,
        });

        const existW = resolveWeekday(item);
        const dayContext = item.date
          ? `on ${formatDateDisplay(item.date)}`
          : existW !== undefined
          ? `on ${getWeekdayName(existW)}`
          : "";

        warningMessage = `${candidate.className || "This class"} overlaps with ${otherName} ${dayContext} (${formatTimeDisplay(candidate.startTime)} - ${formatTimeDisplay(candidate.endTime)}).`.replace(/\s+/g, " ");
      }
    }
  }

  return {
    hasClash: false,
    hasGradeWarning,
    warningMessage,
    gradeConflictClass,
    overlappingGradeClasses:
      overlappingGradeClasses.length > 0 ? overlappingGradeClasses : undefined,
  };
}
