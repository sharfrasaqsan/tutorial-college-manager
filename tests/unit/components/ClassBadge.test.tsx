import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClassBadge } from "@/components/ui/ClassBadge";

describe("ClassBadge Component", () => {
  it("renders with subject and default size", () => {
    render(<ClassBadge subject="Mathematics" />);
    expect(screen.getByText("Mathematics")).toBeInTheDocument();
  });

  it("falls back to name or Class when subject is missing", () => {
    const { rerender } = render(<ClassBadge name="Combined Maths 2026" />);
    expect(screen.getByText("Combined Maths 2026")).toBeInTheDocument();

    rerender(<ClassBadge />);
    expect(screen.getByText("Class")).toBeInTheDocument();
  });

  it("renders grade annotation when provided", () => {
    render(<ClassBadge subject="Physics" grade="Grade 11" />);
    expect(screen.getByText("Physics")).toBeInTheDocument();
    expect(screen.getByText("(Grade 11)")).toBeInTheDocument();
  });

  it("supports color override from palette", () => {
    const { container } = render(<ClassBadge subject="Chemistry" color="emerald" />);
    const badge = container.querySelector("span");
    expect(badge).toBeInTheDocument();
  });

  it("hides indicator dot when showDot is false", () => {
    const { container: withDot } = render(<ClassBadge subject="Biology" showDot={true} />);
    expect(withDot.querySelectorAll("span").length).toBeGreaterThan(2);

    const { container: withoutDot } = render(<ClassBadge subject="Biology" showDot={false} />);
    // With showDot=false, the inner accent dot span is not rendered
    expect(withoutDot.querySelectorAll("span").length).toBe(2); // container + text
  });

  it("applies sizing classes for xs, sm, md", () => {
    const { rerender, container } = render(<ClassBadge subject="ICT" size="xs" />);
    expect(container.firstChild).toHaveClass("text-[10.5px]");

    rerender(<ClassBadge subject="ICT" size="sm" />);
    expect(container.firstChild).toHaveClass("text-xs");

    rerender(<ClassBadge subject="ICT" size="md" />);
    expect(container.firstChild).toHaveClass("font-bold");
  });
});
