import React from "react";
import { FolderOpen } from "lucide-react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 border border-dashed border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] ${className}`}
    >
      <div className="text-[#5F6670] mb-3" aria-hidden="true">
        {icon || <FolderOpen className="w-8 h-8" strokeWidth={1.75} />}
      </div>
      <h3 className="text-sm font-semibold text-[#1C1F23]">{title}</h3>
      {description && (
        <p className="text-xs text-[#5F6670] mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
