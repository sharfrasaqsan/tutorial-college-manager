"use client";

import React from "react";
import { getClassColor } from "@/lib/class-colors";

interface ClassBadgeProps {
  name?: string;
  subject?: string;
  grade?: string;
  color?: string;
  className?: string;
  size?: "xs" | "sm" | "md";
  showDot?: boolean;
}

export function ClassBadge({
  name,
  subject,
  grade,
  color,
  className = "",
  size = "xs",
  showDot = true,
}: ClassBadgeProps) {
  const theme = getClassColor({ color, subject, name });
  const displayText = subject || name || "Class";

  const sizeClasses = {
    xs: "text-[10.5px] px-2 py-0.5 gap-1 font-semibold",
    sm: "text-xs px-2.5 py-0.5 gap-1.5 font-semibold",
    md: "text-xs px-3 py-1 gap-1.5 font-bold",
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border transition-colors select-none ${sizeClasses} ${className}`}
      style={{
        backgroundColor: theme.badgeBg,
        borderColor: theme.badgeBorder,
        color: theme.badgeText,
      }}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: theme.accent }}
        />
      )}
      <span className="truncate">{displayText}</span>
      {grade && (
        <span className="opacity-80 text-[9.5px] font-normal">({grade})</span>
      )}
    </span>
  );
}
