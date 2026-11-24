import React from "react";
import { ChevronDown } from "lucide-react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = "", error = false, disabled, children, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          disabled={disabled}
          className={`w-full min-h-[44px] pl-3 pr-9 py-2 text-sm bg-[#FFFFFF] text-[#1C1F23] border rounded-[6px] appearance-none transition-colors focus:outline-none focus:ring-1 disabled:bg-[#FAF9F6] disabled:text-[#5F6670] disabled:cursor-not-allowed ${
            error
              ? "border-[#A32A2A] focus:border-[#A32A2A] focus:ring-[#A32A2A]"
              : "border-[#E4E1DA] focus:border-[#1F5C4D] focus:ring-[#1F5C4D]"
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[#5F6670]">
          <ChevronDown className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
        </div>
      </div>
    );
  }
);

Select.displayName = "Select";
