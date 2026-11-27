import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/Button";

describe("Button Component", () => {
  it("renders with default props and text content", () => {
    render(<Button>Click Me</Button>);
    const btn = screen.getByRole("button", { name: /click me/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("applies primary variant classes by default", () => {
    render(<Button variant="primary">Submit</Button>);
    const btn = screen.getByRole("button", { name: /submit/i });
    expect(btn.className).toContain("bg-[#1F5C4D]");
  });

  it("applies secondary and danger variants properly", () => {
    const { rerender } = render(<Button variant="secondary">Cancel</Button>);
    let btn = screen.getByRole("button", { name: /cancel/i });
    expect(btn.className).toContain("border-[#E4E1DA]");

    rerender(<Button variant="danger">Delete</Button>);
    btn = screen.getByRole("button", { name: /delete/i });
    expect(btn.className).toContain("bg-[#A32A2A]");
  });

  it("handles loading state by disabling button and showing loading indicator", () => {
    render(<Button loading>Processing</Button>);
    const btn = screen.getByRole("button", { name: /processing/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("handles click events properly when not disabled", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Trigger</Button>);
    const btn = screen.getByRole("button", { name: /trigger/i });
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("prevents click events when disabled", () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled Action</Button>);
    const btn = screen.getByRole("button", { name: /disabled action/i });
    fireEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("supports fullWidth prop", () => {
    render(<Button fullWidth>Full Width</Button>);
    const btn = screen.getByRole("button", { name: /full width/i });
    expect(btn.className).toContain("w-full");
  });
});
