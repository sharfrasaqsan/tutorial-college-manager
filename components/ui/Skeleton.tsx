import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "rectangular" | "circle";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  variant = "rectangular",
  width,
  height,
  className = "",
  style,
  ...props
}: SkeletonProps) {
  const hasWidthClass = /\bw-/.test(className);
  const hasHeightClass = /\bh-/.test(className);

  const defaultWidth = !hasWidthClass && width === undefined ? "w-full" : "";
  const defaultHeight =
    variant === "text" && !hasHeightClass && height === undefined ? "h-3.5" : "";

  const radiusClass = {
    text: "rounded-[4px]",
    rectangular: "rounded-[6px]",
    circle: "rounded-full aspect-square",
  }[variant];

  return (
    <div
      className={`animate-pulse bg-[#EFECE6] ${radiusClass} ${defaultWidth} ${defaultHeight} ${className}`.trim()}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        ...style,
      }}
      aria-hidden="true"
      {...props}
    />
  );
}
