import React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", error = false, disabled, ...props }, ref) => {
    const hasError = Boolean(error || props["aria-invalid"]);

    return (
      <textarea
        ref={ref}
        disabled={disabled}
        className={`w-full min-h-[88px] px-3 py-2 text-sm bg-[#FFFFFF] text-[#1C1F23] border rounded-[6px] transition-colors placeholder:text-[#5F6670] focus:outline-none focus:ring-1 disabled:bg-[#FAF9F6] disabled:text-[#5F6670] disabled:cursor-not-allowed resize-y ${
          hasError
            ? "border-[#A32A2A] focus:border-[#A32A2A] focus:ring-[#A32A2A]"
            : "border-[#E4E1DA] focus:border-[#1F5C4D] focus:ring-[#1F5C4D]"
        } ${className}`}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
