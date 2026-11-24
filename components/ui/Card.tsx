import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
}

export function Card({
  as: Component = "div",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <Component
      className={`bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] p-4 text-[#1C1F23] ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardHeader({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mb-3 pb-2 border-b border-[#E4E1DA] ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  as: Component = "h3",
  className = "",
  children,
  ...props
}: { as?: React.ElementType } & React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <Component className={`text-sm font-semibold text-[#1C1F23] ${className}`} {...props}>
      {children}
    </Component>
  );
}
