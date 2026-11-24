import React from "react";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  action,
  className = "",
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#E4E1DA] ${className}`}
    >
      <div className="min-w-0">
        <h1 className="font-serif text-xl sm:text-2xl font-semibold text-[#1C1F23] tracking-tight leading-snug">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-[#5F6670] mt-1 leading-relaxed">{subtitle}</p>
        )}
      </div>
      {action && (
        <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
          {action}
        </div>
      )}
    </div>
  );
}
