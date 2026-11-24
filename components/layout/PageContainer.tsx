import React from "react";

export type PageContainerVariant = "narrow" | "default" | "wide" | "full";

export interface PageContainerProps {
  children: React.ReactNode;
  variant?: PageContainerVariant;
  className?: string;
}

export function PageContainer({
  children,
  variant = "default",
  className = "",
}: PageContainerProps) {
  const variantWidthClass = {
    narrow: "max-w-2xl mx-auto",
    default: "max-w-6xl mx-auto",
    wide: "max-w-7xl mx-auto",
    full: "w-full",
  }[variant];

  return (
    <div className={`w-full px-4 sm:px-6 lg:px-8 ${variantWidthClass} ${className}`}>
      {children}
    </div>
  );
}
