import React from "react";

export interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactElement<{
    id?: string;
    error?: boolean;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>;
}

export function Field({
  id,
  label,
  required = false,
  hint,
  error,
  className = "",
  children,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const childWithProps = React.cloneElement(children, {
    id,
    error: Boolean(error),
    "aria-describedby": describedBy,
    "aria-invalid": Boolean(error),
  });

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-wider text-[#1C1F23]"
      >
        {label}
        {required && <span className="text-[#A32A2A] ml-1">*</span>}
      </label>
      {childWithProps}
      {hint && !error && (
        <p id={hintId} className="text-xs text-[#5F6670] mt-0.5">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-[#A32A2A] font-medium mt-0.5">
          {error}
        </p>
      )}
    </div>
  );
}
