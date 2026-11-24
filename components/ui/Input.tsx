import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error = false, disabled, type = "text", ...props }, ref) => {
    const isTabular = type === "number" || type === "time" || type === "date";

    return (
      <input
        ref={ref}
        type={type}
        disabled={disabled}
        className={`w-full min-h-[44px] px-3 py-2 text-sm bg-[#FFFFFF] text-[#1C1F23] border rounded-[6px] transition-colors placeholder:text-[#5F6670] focus:outline-none focus:ring-1 disabled:bg-[#FAF9F6] disabled:text-[#5F6670] disabled:cursor-not-allowed ${
          isTabular ? "tabular-nums" : ""
        } ${
          error
            ? "border-[#A32A2A] focus:border-[#A32A2A] focus:ring-[#A32A2A]"
            : "border-[#E4E1DA] focus:border-[#1F5C4D] focus:ring-[#1F5C4D]"
        } ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
