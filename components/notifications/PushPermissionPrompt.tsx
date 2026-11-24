"use client";

import React, { useState, useEffect } from "react";
import { Bell, Share, X, CheckCircle2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { isIosDevice, isStandalonePwa, requestPushPermission } from "@/lib/fcm-client";

export function PushPermissionPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    // Check if dismissed previously
    const dismissed = localStorage.getItem("tcm_push_dismissed");
    if (dismissed) return;

    // Check current permission
    if (Notification.permission === "default") {
      setShowPrompt(true);
    }

    setIsIos(isIosDevice());
    setIsStandalone(isStandalonePwa());
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    const result = await requestPushPermission();
    setLoading(false);

    if (result.granted) {
      setGranted(true);
      setTimeout(() => setShowPrompt(false), 2500);
    } else {
      setShowPrompt(false);
      localStorage.setItem("tcm_push_dismissed", "true");
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem("tcm_push_dismissed", "true");
  };

  if (!showPrompt) return null;

  return (
    <div className="mb-4 p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] relative shadow-sm">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-[#5F6670] hover:text-[#1C1F23]"
        aria-label="Dismiss notification prompt"
      >
        <X className="w-4 h-4" />
      </button>

      {granted ? (
        <div className="flex items-center gap-2.5 text-[#1F5C4D]">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-semibold">
            Push notifications enabled! You will now receive class and salary updates.
          </span>
        </div>
      ) : (
        <div className="space-y-3 pr-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center shrink-0 mt-0.5">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#1C1F23]">Stay updated with push alerts</h4>
              <p className="text-xs text-[#5F6670] mt-0.5">
                Enable push notifications to receive instant timetable updates, salary notices, and class reminders.
              </p>
            </div>
          </div>

          {/* iPhone Add to Home Screen Help Card */}
          {isIos && !isStandalone && (
            <div className="p-3 bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px] flex items-start gap-2.5">
              <Smartphone className="w-4 h-4 text-[#1F5C4D] shrink-0 mt-0.5" />
              <div className="text-xs text-[#5F6670] space-y-1">
                <span className="font-semibold text-[#1C1F23] block">
                  iPhone Users (iOS 16.4+)
                </span>
                <span>
                  Push notifications require installing this app to your Home Screen: tap the{" "}
                  <Share className="w-3.5 h-3.5 inline mx-0.5 text-[#1C1F23]" /> Share button in Safari,
                  then select <strong className="text-[#1C1F23]">Add to Home Screen</strong>.
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={handleEnable}
              disabled={loading}
              className="text-xs"
            >
              {loading ? "Enabling..." : "Enable Notifications"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDismiss}
              className="text-xs"
            >
              Not Now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
