"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

export type ToastVariant = "info" | "success" | "warning" | "danger";
export type ToastPosition = "top-center" | "top-right";

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  position?: ToastPosition;
  onDismiss?: () => void;
  className?: string;
  inline?: boolean;
  autoHideDuration?: number; // Auto-dismiss duration in ms (default: 4000ms / 4s). Set 0 to disable.
}

export function Toast({
  message,
  variant = "info",
  position = "top-right",
  onDismiss,
  className = "",
  inline = false,
  autoHideDuration = 4000,
}: ToastProps) {
  const [mounted, setMounted] = useState(false);
  const [progressStarted, setProgressStarted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Floating toasts have an onDismiss callback and are not marked inline
  const isFloating = !inline && Boolean(onDismiss);

  // Trigger smooth enter transition on mount
  useEffect(() => {
    if (!isFloating) return;
    const frame = requestAnimationFrame(() => {
      setMounted(true);
      // Small tick to ensure browser has painted the 100% width before starting transition to 0%
      const tick = setTimeout(() => {
        setProgressStarted(true);
      }, 30);
      return () => clearTimeout(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [isFloating]);

  // Smooth exit transition handler
  const triggerDismiss = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    setTimeout(() => {
      onDismiss?.();
    }, 220); // Wait for exit animation to complete before unmounting
  }, [isExiting, onDismiss]);

  // Auto-dismiss countdown
  useEffect(() => {
    if (!isFloating || autoHideDuration <= 0) return;
    dismissTimerRef.current = setTimeout(() => {
      triggerDismiss();
    }, autoHideDuration);

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [message, isFloating, autoHideDuration, triggerDismiss]);

  const variantStyles = {
    info: "bg-[#FFFFFF] text-[#1C1F23] border-[#E4E1DA] shadow-lg",
    success: "bg-[#E6F0EC] text-[#1F5C4D] border-[#C2DDD4] shadow-lg",
    warning: "bg-[#FBF1DE] text-[#9A5B00] border-[#F3DCB1] shadow-lg",
    danger: "bg-[#FBE9E7] text-[#A32A2A] border-[#F5C7C3] shadow-lg",
  }[variant];

  const progressBg = {
    info: "bg-[#1C1F23]/25",
    success: "bg-[#1F5C4D]/35",
    warning: "bg-[#9A5B00]/35",
    danger: "bg-[#A32A2A]/35",
  }[variant];

  const IconComponent = {
    info: Info,
    success: CheckCircle,
    warning: AlertCircle,
    danger: AlertCircle,
  }[variant];

  // Screen positioning:
  // - top-right (default): fixed to top-right corner across all viewports
  // - top-center: horizontally centered at top across all screen sizes
  const positionClass = !isFloating
    ? "relative"
    : position === "top-center"
    ? "fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm sm:w-auto sm:min-w-[340px] sm:max-w-md shadow-lg"
    : "fixed top-4 right-4 sm:top-5 sm:right-5 z-[9999] w-[calc(100%-2rem)] max-w-sm sm:w-auto sm:min-w-[340px] sm:max-w-md shadow-lg";

  // Animation classes
  const animationClass = !isFloating
    ? ""
    : isExiting
    ? "opacity-0 -translate-y-3 scale-95 transition-all duration-200 ease-in pointer-events-none"
    : mounted
    ? "opacity-100 translate-y-0 scale-100 transition-all duration-300 ease-out"
    : "opacity-0 -translate-y-4 scale-95";

  const toastElement = (
    <div
      role="status"
      aria-live="polite"
      className={`overflow-hidden flex items-start justify-between gap-3 px-4 py-3 text-xs border rounded-[8px] ${variantStyles} ${positionClass} ${animationClass} ${className}`}
    >
      {/* Icon + Message aligned to a shared 20px line-height */}
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <IconComponent
          className={`w-4 h-4 shrink-0 mt-[2px] transition-transform duration-300 ${
            mounted && !isExiting ? "scale-100" : "scale-75"
          }`}
          strokeWidth={2}
          aria-hidden="true"
        />
        <span className="font-medium text-xs leading-5 text-current break-words flex-1">
          {message}
        </span>
      </div>

      {/* Close button aligned with first line of text */}
      {onDismiss && (
        <button
          type="button"
          onClick={triggerDismiss}
          className="w-6 h-6 -mr-1.5 -mt-0.5 flex items-center justify-center rounded-[4px] text-current opacity-60 hover:opacity-100 hover:bg-black/10 transition-opacity shrink-0 cursor-pointer"
          aria-label="Dismiss message"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      )}

      {/* Auto-Dismiss Countdown Progress Bar */}
      {isFloating && autoHideDuration > 0 && (
        <div
          className={`absolute bottom-0 left-0 h-[2.5px] ${progressBg}`}
          style={{
            width: progressStarted && !isExiting ? "0%" : "100%",
            transition:
              progressStarted && !isExiting ? `width ${autoHideDuration}ms linear` : "none",
          }}
        />
      )}
    </div>
  );

  if (isFloating) {
    if (!mounted || typeof document === "undefined") return null;
    return createPortal(toastElement, document.body);
  }

  return toastElement;
}
