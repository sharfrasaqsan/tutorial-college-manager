import { z } from "zod";
import { parseISO, addDays, format, isAfter, isBefore } from "date-fns";
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
  weekday: number;
  startTime: string;
  endTime: string;
  validFrom: string; // YYYY-MM-DD
  validTo: string; // YYYY-MM-DD
}

/**
 * Generates regular dated sessions for a weekly recurring slot between validFrom and validTo.
 * Each session has type "regular", status "scheduled", and countsForMonth equal to the date's YYYY-MM.
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
      const monthStr = dateStr.substring(0, 7);
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
        date: dateStr,
        startTime: params.startTime,
        endTime: params.endTime,
        type: "regular",
        status: "scheduled",
        countsForMonth: monthStr,
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
    weekday: slot.weekday,
    startTime: slot.startTime,
    endTime: slot.endTime,
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
