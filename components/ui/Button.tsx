import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  size?: "default" | "sm" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "default",
      loading = false,
      fullWidth = false,
      disabled,
      children,
      className = "",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors select-none rounded-[6px] focus-visible:outline-2 focus-visible:outline-[#1F5C4D] focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const sizeStyles = {
      sm: "min-h-[36px] px-3 py-1.5 text-xs",
      default: "min-h-[44px] px-4 py-2 text-sm",
      lg: "min-h-[48px] px-5 py-2.5 text-base",
    }[size];

    const variantStyles = {
      primary:
        "bg-[#1F5C4D] text-[#FFFFFF] border border-[#1F5C4D] hover:bg-[#17473B] active:bg-[#12362C]",
      secondary:
        "bg-[#FFFFFF] text-[#1C1F23] border border-[#E4E1DA] hover:bg-[#FAF9F6] active:bg-[#F2EFE9]",
      quiet:
        "bg-transparent text-[#1F5C4D] border border-transparent hover:bg-[#E6F0EC] active:bg-[#D4E6DF]",
      danger:
        "bg-[#A32A2A] text-[#FFFFFF] border border-[#A32A2A] hover:bg-[#852222] active:bg-[#681B1B]",
    }[variant];

    const widthStyle = fullWidth ? "w-full" : "";

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${widthStyle} ${className}`}
        {...props}
      >
        {loading && (
          <Loader2
            className="w-4 h-4 mr-2 animate-spin text-current"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
