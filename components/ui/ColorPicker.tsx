"use client";

import React from "react";
import { CLASS_COLOR_PALETTE } from "@/lib/class-colors";
import { Check } from "lucide-react";

interface ColorPickerProps {
  value?: string;
  onChange: (colorId: string) => void;
  className?: string;
  label?: string;
}

export function ColorPicker({ value, onChange, className = "", label = "Class Color Theme" }: ColorPickerProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-semibold text-[#1C1F23]">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        {CLASS_COLOR_PALETTE.map((color) => {
          const isSelected = value === color.id;
          return (
            <button
              key={color.id}
              type="button"
              onClick={() => onChange(color.id)}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer relative ${
                isSelected
                  ? "ring-2 ring-offset-2 ring-[#1F5C4D] scale-110 shadow-xs"
                  : "hover:scale-105 opacity-85 hover:opacity-100"
              }`}
              style={{ backgroundColor: color.hex }}
              title={color.name}
              aria-label={`Select ${color.name} color`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
