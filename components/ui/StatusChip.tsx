import React from "react";

export type StatusChipType =
  | "scheduled"
  | "held"
  | "missed"
  | "notCompleted"
  | "unpaid"
  | "paid"
  | "notApplicable"
  | "onHold"
  | "ready"
  | "pending"
  | "approved"
  | "rejected";

export interface StatusChipProps {
  status: StatusChipType | string;
  label?: string;
  className?: string;
}

interface StatusConfig {
  label: string;
  className: string;
}

const statusConfigs: Record<string, StatusConfig> = {
  held: {
    label: "Held",
    className: "bg-[#E6F0EC] text-[#1F5C4D] border-[#C2DDD4]",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-[#F3F2EE] text-[#5F6670] border-[#E4E1DA]",
  },
  missed: {
    label: "Missed",
    className: "bg-[#FBE9E7] text-[#A32A2A] border-[#F5C7C3]",
  },
  notCompleted: {
    label: "Not Completed",
    className: "bg-[#FBF1DE] text-[#9A5B00] border-[#F3DCB1]",
  },
  unpaid: {
    label: "Unpaid",
    className: "bg-[#FBE9E7] text-[#A32A2A] border-[#F5C7C3]",
  },
  paid: {
    label: "Paid",
    className: "bg-[#E6F0EC] text-[#1F5C4D] border-[#C2DDD4]",
  },
  notApplicable: {
    label: "Not Applicable",
    className: "bg-[#F3F2EE] text-[#5F6670] border-[#E4E1DA]",
  },
  onHold: {
    label: "On Hold",
    className: "bg-[#FBF1DE] text-[#9A5B00] border-[#F3DCB1]",
  },
  ready: {
    label: "Ready to pay",
    className: "bg-[#E6F0EC] text-[#1F5C4D] border-[#C2DDD4]",
  },
  pending: {
    label: "Pending",
    className: "bg-[#FBF1DE] text-[#9A5B00] border-[#F3DCB1]",
  },
  approved: {
    label: "Approved",
    className: "bg-[#E6F0EC] text-[#1F5C4D] border-[#C2DDD4]",
  },
  rejected: {
    label: "Rejected",
    className: "bg-[#FBE9E7] text-[#A32A2A] border-[#F5C7C3]",
  },
};

export function StatusChip({ status, label, className = "" }: StatusChipProps) {
  const config = statusConfigs[status] || {
    label: status,
    className: "bg-[#F3F2EE] text-[#5F6670] border-[#E4E1DA]",
  };

  const displayLabel = label || config.label;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-[4px] select-none tabular-nums ${config.className} ${className}`}
    >
      {displayLabel}
    </span>
  );
}
