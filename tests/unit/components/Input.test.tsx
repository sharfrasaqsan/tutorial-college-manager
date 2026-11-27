import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "@/components/ui/Input";

describe("Input Component", () => {
  it("renders with placeholder and accessible role", () => {
    render(<Input placeholder="Enter username" />);
    const input = screen.getByPlaceholderText("Enter username");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "text");
  });

  it("handles value change events", () => {
    const handleChange = vi.fn();
    render(<Input placeholder="Type here" onChange={handleChange} />);
    const input = screen.getByPlaceholderText("Type here");
    fireEvent.change(input, { target: { value: "test@college.lk" } });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it("applies error styling when error is true", () => {
    render(<Input placeholder="Error field" error />);
    const input = screen.getByPlaceholderText("Error field");
    expect(input.className).toContain("border-[#A32A2A]");
  });

  it("applies tabular-nums for numerical, time, and date inputs", () => {
    const { rerender } = render(<Input placeholder="Num" type="number" />);
    let input = screen.getByPlaceholderText("Num");
    expect(input.className).toContain("tabular-nums");

    rerender(<Input placeholder="Time" type="time" />);
    input = screen.getByPlaceholderText("Time");
    expect(input.className).toContain("tabular-nums");

    rerender(<Input placeholder="Date" type="date" />);
    input = screen.getByPlaceholderText("Date");
    expect(input.className).toContain("tabular-nums");
  });

  it("supports disabled state", () => {
    render(<Input placeholder="Disabled" disabled />);
    const input = screen.getByPlaceholderText("Disabled");
    expect(input).toBeDisabled();
  });
});
