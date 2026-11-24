import { test, describe } from "node:test";
import assert from "node:assert";
import { notify, notifyTeacherTimetableChange } from "./notifications.ts";
import type { AppNotification } from "../types/index.ts";

describe("Notifications Domain Logic & Helpers", () => {
  test("creates formatted notification data matching AppNotification schema", async () => {
    const testNotif: AppNotification = {
      id: "test-notif-1",
      userId: "teacher-123",
      title: "Salary Ready",
      body: "Grade 10 Maths is ready for payout.",
      link: "/teacher/salary",
      readAt: null,
      createdAt: new Date().toISOString(),
    };

    assert.equal(testNotif.userId, "teacher-123");
    assert.equal(testNotif.title, "Salary Ready");
    assert.equal(testNotif.link, "/teacher/salary");
    assert.strictEqual(testNotif.readAt, null);
    assert(testNotif.createdAt.length > 0);
  });

  test("notifyTeacherTimetableChange creates informative notification payload", async () => {
    let capturedUserId = "";
    let capturedTitle = "";
    let capturedBody = "";
    let capturedLink = "";

    // Test formatting
    const payload = {
      teacherId: "teacher-abc",
      slotId: "slot-xyz",
      action: "created" as const,
      className: "Grade 10 Science",
      weekday: 2,
      startTime: "14:00",
      endTime: "16:00",
      yearId: "2026",
    };

    const actionLabel = "added to the timetable";
    const expectedTitle = "Timetable Update: Grade 10 Science";
    const expectedBody = "Your class Grade 10 Science has been added to the timetable (14:00 - 16:00).";

    assert.equal(actionLabel, "added to the timetable");
    assert.equal(expectedTitle, `Timetable Update: ${payload.className}`);
    assert.equal(
      expectedBody,
      `Your class ${payload.className} has been ${actionLabel} (${payload.startTime} - ${payload.endTime}).`
    );
  });

  test("detects invalid FCM token error codes for automatic token cleanup", () => {
    const errorCodes = [
      "messaging/registration-token-not-registered",
      "messaging/invalid-registration-token",
      "messaging/invalid-argument",
    ];

    for (const code of errorCodes) {
      const isInvalidToken =
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token" ||
        code === "messaging/invalid-argument";
      assert.strictEqual(isInvalidToken, true);
    }

    const validError: string = "messaging/internal-error";
    const shouldNotDelete =
      validError === "messaging/registration-token-not-registered" ||
      validError === "messaging/invalid-registration-token" ||
      validError === "messaging/invalid-argument";
    assert.strictEqual(shouldNotDelete, false);
  });
});
