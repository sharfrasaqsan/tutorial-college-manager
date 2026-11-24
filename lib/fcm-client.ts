"use client";

import { getMessaging, getToken } from "firebase/messaging";
import app from "./firebase";

export function isIosDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Requests web push notification permission and registers FCM token with the backend.
 */
export async function requestPushPermission(): Promise<{
  granted: boolean;
  token?: string;
  error?: string;
}> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { granted: false, error: "Notifications not supported in this browser." };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { granted: false, error: "Notification permission was not granted." };
    }

    if (!("serviceWorker" in navigator)) {
      return { granted: false, error: "Service workers not supported." };
    }

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });

    if (token) {
      await fetch("/api/notifications/fcm-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          device: navigator.userAgent,
        }),
      });
      return { granted: true, token };
    }

    return { granted: true };
  } catch (err: any) {
    console.error("Push registration error:", err);
    return { granted: false, error: err?.message || "Failed to register push notifications." };
  }
}
