import React from "react";

export interface DataRowProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rightValue?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  bordered?: boolean;
}

export function DataRow({
  title,
  subtitle,
  rightValue,
  onClick,
  className = "",
  bordered = true,
}: DataRowProps) {
  const isClickable = Boolean(onClick);

  return (
    <div
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`min-h-[44px] flex items-center justify-between gap-3 py-2.5 px-3 select-none ${
        bordered ? "border-b border-[#E4E1DA] last:border-b-0" : ""
      } ${
        isClickable
          ? "cursor-pointer hover:bg-[#FAF9F6] active:bg-[#F2EFE9] rounded-[4px] transition-colors"
          : ""
      } ${className}`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[#1C1F23] truncate">
          {title}
        </div>
        {subtitle && (
          <div className="text-xs text-[#5F6670] truncate mt-0.5">
            {subtitle}
          </div>
        )}
      </div>

      {rightValue && (
        <div className="shrink-0 text-sm font-medium text-[#1C1F23] text-right">
          {rightValue}
        </div>
      )}
    </div>
  );
}
