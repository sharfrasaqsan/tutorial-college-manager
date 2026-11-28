"use client";

import React from "react";
import { CLASS_COLOR_PALETTE } from "@/lib/class-colors";
import { Check } from "lucide-react";

interface ColorPickerProps {
  value?: string;
  onChange: (colorId: string) => void;
  className?: string;
  label?: string;
  usedColors?: string[];
  helperText?: string;
}

export function ColorPicker({
  value,
  onChange,
  className = "",
  label = "Class Color Theme",
  usedColors = [],
  helperText,
}: ColorPickerProps) {
  const normalizedUsed = new Set(usedColors.map((c) => c.toLowerCase()));

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[#1C1F23]">{label}</label>
        {value && (
          <span className="text-[11px] font-medium text-[#5F6670] capitalize">
            {CLASS_COLOR_PALETTE.find((c) => c.id === value)?.name || value}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {CLASS_COLOR_PALETTE.map((color) => {
          const isSelected = value?.toLowerCase() === color.id.toLowerCase();
          const isUsed = normalizedUsed.has(color.id.toLowerCase()) && !isSelected;

          return (
            <button
              key={color.id}
              type="button"
              onClick={() => onChange(color.id)}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer relative ${
                isSelected
                  ? "ring-2 ring-offset-2 ring-[#1F5C4D] scale-110 shadow-xs z-10"
                  : isUsed
                  ? "opacity-60 hover:opacity-100 hover:scale-105"
                  : "hover:scale-105 opacity-90 hover:opacity-100 ring-1 ring-black/10"
              }`}
              style={{ backgroundColor: color.hex }}
              title={
                isUsed
                  ? `${color.name} (In use by another class)`
                  : `${color.name} (Available)`
              }
              aria-label={`Select ${color.name} color${isUsed ? " (in use)" : ""}`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />}
              {isUsed && !isSelected && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-white/90 shadow-2xs pointer-events-none"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {helperText ? (
        <p className="text-[11px] text-[#5F6670]">{helperText}</p>
      ) : normalizedUsed.size > 0 ? (
        <p className="text-[11px] text-[#5F6670] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block" />
          <span>Swatches with a center dot are already in use by other classes.</span>
        </p>
      ) : null}
    </div>
  );
}
