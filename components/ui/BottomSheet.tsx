"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  className = "",
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "sheet-title" : undefined}
      className="fixed inset-0 z-50 flex flex-col justify-end md:flex-row md:justify-end"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#1C1F23]/40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Container: Bottom sheet on mobile (<768px), 480px right-side drawer on tablet & desktop (>=768px) */}
      <div
        className={`relative z-10 w-full max-w-lg mx-auto md:mx-0 md:w-[480px] md:max-w-[480px] md:h-full md:max-h-full bg-[#FFFFFF] border-t md:border-t-0 md:border-l border-[#E4E1DA] rounded-t-[12px] md:rounded-t-none md:rounded-l-[8px] p-4 md:p-6 max-h-[85vh] flex flex-col overflow-hidden transition-all duration-200 ${className}`}
      >
        {/* Drag handle (Mobile only) */}
        <div className="flex justify-center mb-2 md:hidden">
          <div className="w-10 h-1 bg-[#E4E1DA] rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#E4E1DA]">
          <div className="pr-4">
            {title && (
              <h2
                id="sheet-title"
                className="text-base md:text-lg font-serif font-semibold text-[#1C1F23]"
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
            className="min-h-[44px] min-w-[44px] -mr-2 -mt-2 flex items-center justify-center text-[#5F6670] hover:text-[#1C1F23] rounded-[6px] transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto pt-4 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

export const Sheet = BottomSheet;
export type SheetProps = BottomSheetProps;
