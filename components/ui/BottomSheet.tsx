"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  width?: "default" | "wide";
}

export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  width = "default",
}: BottomSheetProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const drawerWidthClass = width === "wide" ? "md:w-[560px]" : "md:w-[480px]";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "sheet-title" : undefined}
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-start md:items-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1C1F23]/40 transition-opacity backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Container: Bottom Sheet on <md, Right Drawer on >=md */}
      <div
        className={`relative z-10 w-full max-w-lg mx-auto bg-[#FFFFFF] border-t border-[#E4E1DA] rounded-t-[12px] p-4 max-h-[85vh] flex flex-col overflow-hidden md:fixed md:inset-y-0 md:right-0 ${drawerWidthClass} md:max-w-none md:rounded-none md:border-l md:border-t-0 md:max-h-full md:p-6 md:shadow-2xl transition-transform duration-200 ease-out`}
      >
        {/* Mobile Drag Handle (hidden on tablet/desktop) */}
        <div className="flex justify-center mb-2 md:hidden">
          <div className="w-10 h-1 bg-[#E4E1DA] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between pb-3 md:pb-4 border-b border-[#E4E1DA] shrink-0">
          <div className="pr-2">
            {title && (
              <h2
                id="sheet-title"
                className="font-serif text-base md:text-lg font-semibold text-[#1C1F23]"
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs text-[#5F6670] mt-0.5 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#5F6670] hover:text-[#1C1F23] rounded-[6px] hover:bg-[#FAF9F6] transition-colors -mr-1 -mt-1"
            aria-label="Close sheet"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto pt-3 md:pt-4 flex-1 overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
