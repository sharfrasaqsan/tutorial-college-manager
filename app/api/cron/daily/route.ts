import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import {
  getColomboNow,
  formatColomboPattern,
  formatMonthDisplay,
  getMarkingWindowDetails,
} from "@/lib/dates";
import { formatLKR } from "@/lib/money";
import { notify, getOwnerUserId } from "@/lib/notifications";
import { recalculateClassSalary } from "@/lib/salary-recalc";
import type { Session, FeeRecord } from "@/types";

/**
 * GET or POST /api/cron/daily
 * Daily scheduled background cron job for Tutorial College Manager.
 * Scheduled in vercel.json for 20:00 Asia/Colombo (14:30 UTC): "30 14 * * *".
 *
 * Security:
 * Protected by CRON_SECRET:
 * Checks Authorization: Bearer <CRON_SECRET> header or ?secret=<CRON_SECRET> query param.
 *
 * Tasks:
 * 1. Lock sessions past the 3-day marking window as 'notCompleted' and trigger salary recalcs.
 * 2. 8 PM Session Day reminder for teachers with unmarked sessions held today.
 * 3. Final reminder on the last day of the 3-day window for sessions closing tonight.
 * 4. Weekly unpaid-students fee summary notification sent to the owner on Mondays.
 */
export async function GET(request: NextRequest) {
  return handleDailyCron(request);
}

export async function POST(request: NextRequest) {
  return handleDailyCron(request);
}

async function handleDailyCron(request: NextRequest) {
  try {
    // 1. Authenticate with CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const { searchParams } = new URL(request.url);
    const querySecret = searchParams.get("secret");
    const expectedSecret = process.env.CRON_SECRET || "tutorial-college-cron-secret-2026";

    const isAuthorized =
      authHeader === `Bearer ${expectedSecret}` || querySecret === expectedSecret;

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Unauthorized. Invalid or missing cron secret." },
        { status: 401 }
      );
    }

    const now = getColomboNow();
    const nowIso = new Date().toISOString();
    const todayDateStr = formatColomboPattern(now, "yyyy-MM-dd");
    const currentMonth = formatColomboPattern(now, "yyyy-MM");
    const isMonday = now.getDay() === 1;

    const yearId = searchParams.get("yearId") || todayDateStr.slice(0, 4) || "2026";

    // 2. Task A: Lock Expired Sessions & Task B/C: Reminders
    const sessionsSnap = await adminDb
      .collection("years")
      .doc(yearId)
      .collection("sessions")
      .where("status", "==", "scheduled")
      .get();

    let lockedCount = 0;
    const batch = adminDb.batch();
    const affectedRecalcs = new Map<string, { teacherId: string; classId: string; month: string }>();

    // Reminders maps: teacherId -> array of sessions
    const sameDayUnmarkedByTeacher = new Map<string, Session[]>();
    const finalDayUnmarkedByTeacher = new Map<string, Session[]>();

    sessionsSnap.forEach((doc) => {
      const session = doc.data() as Session;
      const window = getMarkingWindowDetails(session.date, session.startTime, now);

      // Past window: lock as notCompleted
      if (window.isPastWindow) {
        batch.update(doc.ref, {
          status: "notCompleted",
          locked: true,
          updatedAt: nowIso,
        });
        lockedCount++;
        const key = `${session.teacherId}_${session.classId}_${session.countsForMonth}`;
        affectedRecalcs.set(key, {
          teacherId: session.teacherId,
          classId: session.classId,
          month: session.countsForMonth,
        });
      }
      // Same day reminder: today, session already started / reached 20:00
      else if (session.date === todayDateStr && session.startTime <= "20:00") {
        const list = sameDayUnmarkedByTeacher.get(session.teacherId) || [];
        list.push(session);
        sameDayUnmarkedByTeacher.set(session.teacherId, list);
      }
      // Final notice: window closes tonight (daysLeft === 0)
      else if (window.isOpen && window.daysLeft === 0) {
        const list = finalDayUnmarkedByTeacher.get(session.teacherId) || [];
        list.push(session);
        finalDayUnmarkedByTeacher.set(session.teacherId, list);
      }
    });

    if (lockedCount > 0) {
      await batch.commit();
      // Recalculate salary for classes affected by expired sessions
      for (const item of affectedRecalcs.values()) {
        try {
          await recalculateClassSalary(yearId, item.teacherId, item.classId, item.month);
        } catch (recalcErr) {
          console.error("Cron salary recalc error:", recalcErr);
        }
      }
    }

    // 3. Send 8 PM Same-Day Reminders
    let sameDayRemindersSent = 0;
    for (const [teacherId, list] of sameDayUnmarkedByTeacher.entries()) {
      const count = list.length;
      const title = "Unmarked Session Reminder";
      const body = `You have ${count} unmarked class session(s) today. Please mark Held or Missed before the marking window closes.`;
      await notify(teacherId, title, body, "/teacher");
      sameDayRemindersSent++;
    }

    // 4. Send Final Day (3rd day window) Reminders
    let finalDayRemindersSent = 0;
    for (const [teacherId, list] of finalDayUnmarkedByTeacher.entries()) {
      const count = list.length;
      const title = "Final Notice: Marking Window Closing";
      const body = `The 3-day marking window for ${count} session(s) closes tonight. Unmarked sessions will be locked as Not Completed.`;
      await notify(teacherId, title, body, "/teacher");
      finalDayRemindersSent++;
    }

    // 5. Monday Unpaid Fees Summary for Owner
    let mondaySummaryData: { sent: boolean; unpaidCount?: number; totalUnpaid?: number } = { sent: false };

    if (isMonday) {
      const feesSnap = await adminDb
        .collection("years")
        .doc(yearId)
        .collection("fees")
        .where("month", "==", currentMonth)
        .where("status", "==", "unpaid")
        .get();

      const unpaidCount = feesSnap.size;
      let totalUnpaid = 0;
      feesSnap.forEach((d) => {
        const f = d.data() as FeeRecord;
        totalUnpaid += f.amount || 0;
      });

      if (unpaidCount > 0) {
        const ownerId = await getOwnerUserId();
        if (ownerId) {
          const monthName = formatMonthDisplay(currentMonth);
          const title = "Weekly Unpaid Fees Summary";
          const body = `${unpaidCount} student fee(s) totaling ${formatLKR(totalUnpaid)} remain unpaid for ${monthName}.`;
          await notify(ownerId, title, body, "/owner/fees");
          mondaySummaryData = { sent: true, unpaidCount, totalUnpaid };
        }
      } else {
        mondaySummaryData = { sent: true, unpaidCount: 0, totalUnpaid: 0 };
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: nowIso,
      colomboTime: formatColomboPattern(now, "yyyy-MM-dd HH:mm:ss"),
      lockedSessionsCount: lockedCount,
      remindersSent: {
        sameDayReminders: sameDayRemindersSent,
        finalDayReminders: finalDayRemindersSent,
      },
      mondaySummary: mondaySummaryData,
    });
  } catch (error: any) {
    console.error("Daily cron error:", error);
    return NextResponse.json(
      { error: "Daily cron execution failed: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
