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
      className={`flex items-start justify-between gap-3 mb-4 pb-3 border-b border-[#E4E1DA] ${className}`}
    >
      <div>
        <h1 className="text-lg font-semibold text-[#1C1F23] tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-[#5F6670] mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
