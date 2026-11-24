"use client";

import React from "react";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

export type ToastVariant = "info" | "success" | "warning" | "danger";

export interface ToastProps {
  message: string;
  variant?: ToastVariant;
  onDismiss?: () => void;
  className?: string;
  inline?: boolean;
}

export function Toast({
  message,
  variant = "info",
  onDismiss,
  className = "",
  inline = false,
}: ToastProps) {
  const variantStyles = {
    info: "bg-[#FFFFFF] text-[#1C1F23] border-[#E4E1DA]",
    success: "bg-[#E6F0EC] text-[#1F5C4D] border-[#C2DDD4]",
    warning: "bg-[#FBF1DE] text-[#9A5B00] border-[#F3DCB1]",
    danger: "bg-[#FBE9E7] text-[#A32A2A] border-[#F5C7C3]",
  }[variant];

  const IconComponent = {
    info: Info,
    success: CheckCircle,
    warning: AlertCircle,
    danger: AlertCircle,
  }[variant];

  const positionClass = inline
    ? ""
    : "md:fixed md:top-5 md:right-5 md:z-50 md:min-w-[320px] md:max-w-md md:shadow-md";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs border rounded-[6px] ${variantStyles} ${positionClass} ${className}`}
    >
      <div className="flex items-center gap-2">
        <IconComponent className="w-4 h-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span className="font-medium">{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 text-current opacity-70 hover:opacity-100"
          aria-label="Dismiss message"
        >
          <X className="w-4 h-4" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
