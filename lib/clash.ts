import { timeToMinutes, formatTimeDisplay, getWeekdayName, formatDateDisplay } from "./dates.ts";
import type { TimeInterval } from "../types/index.ts";

export interface ClashCheckResult {
  hasClash: boolean;
  message?: string;
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
 * Shared clash detection function for timetable slots, make-ups, and sessions.
 * Enforced on server transactions.
 *
 * Rules:
 * 1. A teacher cannot have two overlapping sessions.
 * 2. At most 3 classes may overlap at any moment (college has 3 rooms; rooms are NOT tracked).
 * 3. Classes of the same grade MAY overlap.
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

  // Filter intervals for the relevant day (ignore self if editing)
  const relevant = existingIntervals.filter((item) => {
    if (item.id === candidate.id) return false;
    if (candidate.date && item.date) {
      return candidate.date === item.date;
    }
    if (candidate.weekday !== undefined && item.weekday !== undefined) {
      return candidate.weekday === item.weekday;
    }
    return true;
  });

  // Rule 1: Teacher conflict
  for (const existing of relevant) {
    if (
      existing.teacherId === candidate.teacherId &&
      doIntervalsOverlap(
        candidate.startTime,
        candidate.endTime,
        existing.startTime,
        existing.endTime
      )
    ) {
      const teacherName = candidate.teacherName || existing.teacherName || "The teacher";
      const dayContext = existing.date
        ? `on ${formatDateDisplay(existing.date)} `
        : existing.weekday !== undefined
        ? `on ${getWeekdayName(existing.weekday)} `
        : "";
      const classContext = existing.className ? `${existing.className} ` : "";
      return {
        hasClash: true,
        message: `${teacherName} already teaches ${classContext}${dayContext}from ${formatTimeDisplay(
          existing.startTime
        )} to ${formatTimeDisplay(existing.endTime)}.`.replace(/\s+/g, " ").replace(" .", "."),
      };
    }
  }

  // Rule 2 & 3: Maximum 3 simultaneous classes at any moment
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
        message: "Three classes already run at that time.",
      };
    }
  }

  return { hasClash: false };
}
