import React from "react";
import { formatLKR } from "@/lib/money";

export interface MoneyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number | null | undefined;
  className?: string;
}

export function MoneyText({ amount, className = "", ...props }: MoneyTextProps) {
  return (
    <span
      className={`tabular-nums font-medium text-[#1C1F23] ${className}`}
      {...props}
    >
      {formatLKR(amount)}
    </span>
  );
}
