import { z } from "zod";
import { parseISO, addDays, format, isAfter, isBefore } from "date-fns";
import { getColomboNow } from "./dates.ts";
import type { TimetableSlot, Session, TimeInterval } from "../types/index.ts";

export const TimeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const CreateSlotSchema = z
  .object({
    yearId: z.string().min(4, "Academic year is required."),
    classId: z.string().min(1, "Class is required."),
    weekday: z
      .number()
      .int()
      .min(0, "Weekday must be between 0 (Sunday) and 6 (Saturday).")
      .max(6, "Weekday must be between 0 (Sunday) and 6 (Saturday)."),
    startTime: z.string().regex(TimeRegex, "Start time must be in HH:mm 24h format."),
    endTime: z.string().regex(TimeRegex, "End time must be in HH:mm 24h format."),
    validFrom: z.string().regex(DateRegex, "Valid from date must be in YYYY-MM-DD format.").optional(),
    validTo: z.string().regex(DateRegex, "Valid to date must be in YYYY-MM-DD format.").optional(),
    isTemporary: z.boolean().optional(),
    slotType: z.enum(["regular", "extra"]).optional(),
    specificDate: z.string().regex(DateRegex, "Specific date must be in YYYY-MM-DD format.").optional(),
    countsForMonth: z.string().regex(/^\d{4}-\d{2}$/, "Target month must be in YYYY-MM format.").optional(),
    note: z.string().max(200).optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  })
  .refine(
    (data) => {
      if (data.validFrom && data.validTo) {
        return data.validFrom <= data.validTo;
      }
      return true;
    },
    {
      message: "Valid to date must be on or after valid from date.",
      path: ["validTo"],
    }
  );

export const UpdateSlotSchema = z
  .object({
    weekday: z
      .number()
      .int()
      .min(0, "Weekday must be between 0 and 6.")
      .max(6, "Weekday must be between 0 and 6."),
    startTime: z.string().regex(TimeRegex, "Start time must be in HH:mm 24h format."),
    endTime: z.string().regex(TimeRegex, "End time must be in HH:mm 24h format."),
    validFrom: z.string().regex(DateRegex, "Valid from date must be in YYYY-MM-DD format.").optional(),
    validTo: z.string().regex(DateRegex, "Valid to date must be in YYYY-MM-DD format.").optional(),
    isTemporary: z.boolean().optional(),
    slotType: z.enum(["regular", "extra"]).optional(),
    specificDate: z.string().regex(DateRegex, "Specific date must be in YYYY-MM-DD format.").optional(),
    countsForMonth: z.string().regex(/^\d{4}-\d{2}$/, "Target month must be in YYYY-MM format.").optional(),
    note: z.string().max(200).optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: "End time must be after start time.",
    path: ["endTime"],
  });

export type CreateSlotInput = z.infer<typeof CreateSlotSchema>;
export type UpdateSlotInput = z.infer<typeof UpdateSlotSchema>;

export interface GenerateSessionsParams {
  slotId: string;
  yearId: string;
  classId: string;
  className: string;
  grade: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  isMultiTeacher?: boolean;
  teachers?: import("../types/index.ts").ClassTeacherAssignment[];
  teacherIds?: string[];
  color?: string;
  weekday: number;
  startTime: string;
  endTime: string;
  validFrom: string; // YYYY-MM-DD
  validTo: string; // YYYY-MM-DD
  isTemporary?: boolean;
  countsForMonth?: string; // YYYY-MM
  note?: string;
}

/**
 * Generates regular dated sessions for a weekly recurring slot between validFrom and validTo.
 * For single non-repeating / extra classes (isTemporary = true), validFrom = validTo = specificDate,
 * generating exactly 1 session with type "extra", status "scheduled", and the specified countsForMonth.
 */
export function generateSessionsForSlot(params: GenerateSessionsParams): Session[] {
  const sessions: Session[] = [];
  const start = parseISO(params.validFrom);
  const end = parseISO(params.validTo);

  if (isAfter(start, end)) {
    return sessions;
  }

  let current = start;
  const now = new Date().toISOString();

  while (!isAfter(current, end)) {
    // getDay returns 0 for Sunday, 1 for Monday, etc.
    if (current.getDay() === params.weekday) {
      const dateStr = format(current, "yyyy-MM-dd");
      const monthStr = params.countsForMonth || dateStr.substring(0, 7);
      const sessionId = `${params.slotId}_${dateStr}`;

      sessions.push({
        id: sessionId,
        slotId: params.slotId,
        classId: params.classId,
        className: params.className,
        grade: params.grade,
        subject: params.subject,
        yearId: params.yearId,
        teacherId: params.teacherId,
        teacherName: params.teacherName,
        isMultiTeacher: params.isMultiTeacher,
        teachers: params.teachers,
        teacherIds: params.teacherIds,
        date: dateStr,
        startTime: params.startTime,
        endTime: params.endTime,
        type: params.isTemporary ? "extra" : "regular",
        status: "scheduled",
        countsForMonth: monthStr,
        isTemporary: params.isTemporary,
        note: params.note,
        locked: false,
      });
    }

    current = addDays(current, 1);
  }

  return sessions;
}

/**
 * Converts a slot to a TimeInterval format for clash detection.
 */
export function slotToTimeInterval(slot: TimetableSlot): TimeInterval {
  return {
    id: slot.id,
    classId: slot.classId,
    className: slot.className,
    grade: slot.grade || "",
    teacherId: slot.teacherId,
    teacherName: slot.teacherName,
    isMultiTeacher: slot.isMultiTeacher,
    teachers: slot.teachers,
    teacherIds: slot.teacherIds || (slot.teachers ? slot.teachers.map((t) => t.teacherId) : undefined),
    weekday: slot.weekday,
    startTime: slot.startTime,
    endTime: slot.endTime,
    date: slot.specificDate || (slot.isTemporary && slot.validFrom ? slot.validFrom : undefined),
  };
}

/**
 * Converts a dated session to a TimeInterval format for clash detection.
 */
export function sessionToTimeInterval(session: Session): TimeInterval {
  return {
    id: session.id,
    classId: session.classId,
    className: session.className,
    grade: session.grade || "",
    teacherId: session.teacherId,
    teacherName: session.teacherName,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
  };
}

export interface SlotActivityInfo {
  isExtra: boolean;
  isExpired: boolean;
  isFutureStart: boolean;
  isEndingSoon: boolean;
  badgeType?: "extra" | "future" | "ending";
  badgeLabel?: string;
  badgeTitle?: string;
}

/**
 * Evaluates a timetable slot's lifecycle status relative to today (YYYY-MM-DD).
 * - Past temporary/extra classes & expired regular slots are flagged `isExpired = true`.
 * - Upcoming extra classes, future-effective regular slots, and ending-soon slots get clear labels.
 */
export function getSlotActivityInfo(slot: TimetableSlot, todayStr: string): SlotActivityInfo {
  const isExtra = Boolean(
    slot.isTemporary ||
      slot.slotType === "extra" ||
      slot.specificDate ||
      (slot.validFrom && slot.validFrom === slot.validTo)
  );

  if (isExtra) {
    const dateVal = slot.specificDate || slot.validFrom;
    const isExpired = Boolean(dateVal && dateVal < todayStr);
    let badgeLabel = "Extra";
    if (dateVal === todayStr) {
      badgeLabel = "Today";
    } else if (dateVal) {
      try {
        badgeLabel = format(parseISO(dateVal), "d MMM");
      } catch {
        badgeLabel = dateVal;
      }
    }
    return {
      isExtra: true,
      isExpired,
      isFutureStart: false,
      isEndingSoon: false,
      badgeType: "extra",
      badgeLabel,
      badgeTitle: `Temporary / Extra Class: ${dateVal || "Single Session"}${slot.note ? ` • ${slot.note}` : ""}${slot.countsForMonth ? ` (Counts for ${slot.countsForMonth})` : ""}`,
    };
  }

  const isExpired = Boolean(slot.validTo && slot.validTo < todayStr);
  const isFutureStart = Boolean(slot.validFrom && slot.validFrom > todayStr);
  const yearPrefix = slot.yearId || (slot.validFrom ? slot.validFrom.substring(0, 4) : todayStr.substring(0, 4));
  const yearEnd = `${yearPrefix}-12-31`;
  const isEndingSoon = Boolean(
    !isExpired &&
      !isFutureStart &&
      slot.validTo &&
      slot.validTo >= todayStr &&
      slot.validTo < yearEnd
  );

  if (isFutureStart && slot.validFrom) {
    let label = slot.validFrom;
    try {
      label = `From ${format(parseISO(slot.validFrom), "d MMM")}`;
    } catch {}
    return {
      isExtra: false,
      isExpired: false,
      isFutureStart: true,
      isEndingSoon: false,
      badgeType: "future",
      badgeLabel: label,
      badgeTitle: `Scheduled future change — effective from ${slot.validFrom}`,
    };
  }

  if (isEndingSoon && slot.validTo) {
    let label = slot.validTo;
    try {
      label = `Until ${format(parseISO(slot.validTo), "d MMM")}`;
    } catch {}
    return {
      isExtra: false,
      isExpired: false,
      isFutureStart: false,
      isEndingSoon: true,
      badgeType: "ending",
      badgeLabel: label,
      badgeTitle: `Current schedule ends after ${slot.validTo}`,
    };
  }

  return {
    isExtra: false,
    isExpired,
    isFutureStart: false,
    isEndingSoon: false,
  };
}

/**
 * Validates that timetable slot dates are not in the past.
 * - Extra/temporary classes can never be scheduled or moved to a past date.
 * - New regular slots cannot start or end in the past.
 * - Edited regular slots cannot have validTo in the past.
 */
export function validateSlotDatesNotInPast(params: {
  isExtra: boolean;
  specificDate?: string;
  validFrom?: string;
  validTo?: string;
  todayStr: string;
  isEdit?: boolean;
}): string | null {
  if (params.isExtra) {
    const dateVal = params.specificDate || params.validFrom;
    if (!dateVal) {
      return "Please select a date for the temporary / extra class.";
    }
    if (dateVal < params.todayStr) {
      return params.isEdit
        ? `Cannot move a temporary / extra class to a past date (${dateVal}).`
        : `Cannot schedule a temporary / extra class on a past date (${dateVal}).`;
    }
    return null;
  }

  if (params.validTo && params.validTo < params.todayStr) {
    return `End date (${params.validTo}) cannot be in the past.`;
  }
  if (!params.isEdit && params.validFrom && params.validFrom < params.todayStr) {
    return `Start date (${params.validFrom}) cannot be in the past when creating a new class slot.`;
  }

  return null;
}

/**
 * Returns true if the given timetable slot is currently in progress right now
 * (matching Asia/Colombo weekday, active date range, and startTime <= currentHHmm < endTime).
 */
export function isSlotLiveNow(
  slot: Pick<TimetableSlot, "weekday" | "startTime" | "endTime"> & Partial<TimetableSlot>,
  now: Date = getColomboNow()
): boolean {
  if (Number(slot.weekday) !== now.getDay()) {
    return false;
  }

  const todayStr = format(now, "yyyy-MM-dd");
  const isExtra = Boolean(
    slot.isTemporary ||
      slot.slotType === "extra" ||
      slot.specificDate ||
      (slot.validFrom && slot.validFrom === slot.validTo)
  );

  if (isExtra) {
    const dateVal = slot.specificDate || slot.validFrom;
    if (dateVal && dateVal !== todayStr) return false;
  } else {
    if (slot.validFrom && slot.validFrom > todayStr) return false;
    if (slot.validTo && slot.validTo < todayStr) return false;
  }

  const currentHHmm = format(now, "HH:mm");
  return currentHHmm >= slot.startTime && currentHHmm < slot.endTime;
}
