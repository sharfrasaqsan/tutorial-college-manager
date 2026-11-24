import React from "react";

export interface PageContainerProps {
  children: React.ReactNode;
  size?: "narrow" | "default" | "wide";
  className?: string;
}

export function PageContainer({
  children,
  size = "default",
  className = "",
}: PageContainerProps) {
  const sizeStyles = {
    narrow: "max-w-2xl",
    default: "max-w-6xl",
    wide: "max-w-7xl",
  }[size];

  return (
    <div className={`w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 ${sizeStyles} ${className}`}>
      {children}
    </div>
  );
}
