import { adminDb, adminMessaging, adminAuth } from "./firebase-admin.ts";
import { formatTimeDisplay, getWeekdayName } from "./dates.ts";
import type { AppNotification } from "@/types";

let cachedOwnerId: string | null = null;

/**
 * Retrieves the owner's Firebase UID.
 * Cached in memory for route performance.
 */
export async function getOwnerUserId(): Promise<string> {
  if (cachedOwnerId) return cachedOwnerId;

  try {
    // 1. Query users collection for owner role
    const usersSnap = await adminDb
      .collection("users")
      .where("role", "==", "owner")
      .limit(1)
      .get();

    if (!usersSnap.empty) {
      cachedOwnerId = usersSnap.docs[0].id;
      return cachedOwnerId;
    }

    // 2. Fallback to owner email from env / standard owner
    const ownerEmail = process.env.OWNER_EMAIL || "sharfrasaqsan@gmail.com";
    const userRecord = await adminAuth.getUserByEmail(ownerEmail);
    cachedOwnerId = userRecord.uid;
    return cachedOwnerId;
  } catch (err) {
    console.warn("[Notifications] Failed to resolve owner UID via auth, checking default:", err);
    // If not found yet, fallback to known UID or empty string
    return cachedOwnerId || "";
  }
}

/**
 * Core server notification function:
 * 1. Writes in-app notification item to `notifications/{id}` with:
 *    userId, title, body, link, readAt (null), createdAt.
 * 2. Fetches FCM tokens registered for this user and dispatches web push notifications.
 * 3. Removes invalid/expired tokens returned by FCM.
 */
export async function notify(
  userId: string,
  title: string,
  body: string,
  link: string = "/"
): Promise<string> {
  if (!userId) {
    console.warn("[Notifications] notify() called with empty userId; skipping.");
    return "";
  }

  const notifRef = adminDb.collection("notifications").doc();
  const notifId = notifRef.id;
  const now = new Date().toISOString();

  const notifData: AppNotification = {
    id: notifId,
    userId,
    title,
    body,
    link,
    readAt: null,
    createdAt: now,
  };

  // 1. Save in-app notification
  try {
    await notifRef.set(notifData);
  } catch (dbErr) {
    console.error("[Notifications] Failed to write in-app notification:", dbErr);
  }

  // 2. Fetch user's registered FCM tokens
  try {
    const tokensSnap = await adminDb
      .collection("fcmTokens")
      .where("userId", "==", userId)
      .get();

    if (!tokensSnap.empty) {
      const tokenDocs = tokensSnap.docs;
      const tokens = tokenDocs.map((d) => d.data().token as string).filter(Boolean);

      if (tokens.length > 0) {
        const fcmResponse = await adminMessaging.sendEachForMulticast({
          tokens,
          notification: {
            title,
            body,
          },
          data: {
            link,
            notificationId: notifId,
          },
          webpush: {
            fcmOptions: {
              link,
            },
            notification: {
              icon: "/icons/icon-192.svg",
              badge: "/icons/icon-192.svg",
            },
          },
        });

        // 3. Remove invalid / expired tokens
        const tokensToDelete: string[] = [];
        fcmResponse.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;
            if (
              errorCode === "messaging/registration-token-not-registered" ||
              errorCode === "messaging/invalid-registration-token" ||
              errorCode === "messaging/invalid-argument"
            ) {
              tokensToDelete.push(tokenDocs[idx].id);
            }
          }
        });

        if (tokensToDelete.length > 0) {
          const batch = adminDb.batch();
          tokensToDelete.forEach((docId) => {
            batch.delete(adminDb.collection("fcmTokens").doc(docId));
          });
          await batch.commit();
          console.log(`[Notifications] Cleaned up ${tokensToDelete.length} invalid FCM token(s).`);
        }
      }
    }
  } catch (fcmErr) {
    // Non-blocking for FCM push errors (e.g. invalid credentials or network glitch)
    console.error(`[Notifications] Web push dispatch failed for user ${userId}:`, fcmErr);
  }

  return notifId;
}

export interface TimetableNotificationPayload {
  teacherId: string;
  slotId: string;
  action: "created" | "updated" | "deleted";
  className: string;
  weekday: number;
  weekdayName?: string;
  startTime: string;
  endTime: string;
  yearId: string;
}

/**
 * Dispatched whenever an owner creates, updates, or deletes a timetable slot.
 */
export async function notifyTeacherTimetableChange(
  payload: TimetableNotificationPayload
): Promise<void> {
  const actionLabel =
    payload.action === "created"
      ? "added to the timetable"
      : payload.action === "updated"
      ? "updated"
      : "removed from the timetable";

  const title = `Timetable Update: ${payload.className}`;
  const body = `Your class ${payload.className} has been ${actionLabel} (${payload.startTime} - ${payload.endTime}).`;
  const link = "/teacher/timetable";

  await notify(payload.teacherId, title, body, link);
}

export interface ContactNotificationPayload {
  messageId: string;
  senderName: string;
  email: string;
  phone?: string;
  subject?: string;
  messageText: string;
}

/**
 * Dispatched when a website visitor submits an inquiry on the public contact page.
 * Strictly notifies ONLY the college administrator/owner via in-app notification & FCM web push.
 */
export async function notifyAdminContactMessage(
  payload: ContactNotificationPayload
): Promise<string> {
  const ownerId = await getOwnerUserId();
  if (!ownerId) {
    console.warn("[Notifications] No owner ID resolved for contact message notification.");
    return "";
  }

  const subjectSuffix = payload.subject ? ` • ${payload.subject}` : "";
  const title = `New Contact Inquiry: ${payload.senderName}${subjectSuffix}`;
  const snippet =
    payload.messageText.length > 90
      ? payload.messageText.slice(0, 87) + "..."
      : payload.messageText;
  const body = `${payload.email}${payload.phone ? ` • ${payload.phone}` : ""}: "${snippet}"`;
  const link = "/owner/messages";

  return await notify(ownerId, title, body, link);
}

export interface ConcurrentGradeScheduleNotificationPayload {
  grade: string;
  classNameA: string;
  classNameB: string;
  weekday: number;
  weekdayName?: string;
  startTime: string;
  endTime: string;
  yearId?: string;
}

/**
 * Dispatched when classes of the same grade are scheduled at the same time.
 * Alerts the owner via in-app notification & web push notification.
 */
export async function notifyOwnerConcurrentGradeSchedule(
  payload: ConcurrentGradeScheduleNotificationPayload
): Promise<string> {
  const ownerId = await getOwnerUserId();
  if (!ownerId) {
    console.warn("[Notifications] No owner ID resolved for concurrent grade schedule notification.");
    return "";
  }

  const dayStr = payload.weekdayName || getWeekdayName(payload.weekday);
  const timeStr = `${formatTimeDisplay(payload.startTime)} - ${formatTimeDisplay(payload.endTime)}`;
  const title = `Concurrent ${payload.grade} Classes Scheduled`;
  const body = `${payload.classNameA} and ${payload.classNameB} have been scheduled at the same time on ${dayStr} (${timeStr}).`;
  const link = "/owner/timetable";

  return await notify(ownerId, title, body, link);
}

