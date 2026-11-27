import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { CLASS_COLOR_PALETTE } from "@/lib/class-colors";

describe("ColorPicker Component", () => {
  it("renders all 12 accessible color palette swatches", () => {
    render(<ColorPicker value="emerald" onChange={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(CLASS_COLOR_PALETTE.length);
    expect(buttons.length).toBe(12);
  });

  it("marks the selected color with check indicator", () => {
    render(<ColorPicker value="purple" onChange={() => {}} />);
    const violetBtn = screen.getByRole("button", { name: /select violet purple color/i });
    expect(violetBtn.className).toContain("ring-2");
    expect(violetBtn.querySelector("svg")).toBeInTheDocument();
  });

  it("calls onChange with the selected color id", () => {
    const handleChange = vi.fn();
    render(<ColorPicker value="emerald" onChange={handleChange} />);
    const amberBtn = screen.getByRole("button", { name: /select amber gold color/i });
    fireEvent.click(amberBtn);
    expect(handleChange).toHaveBeenCalledWith("amber");
  });

  it("supports custom label", () => {
    render(<ColorPicker label="Subject Accent" onChange={() => {}} />);
    expect(screen.getByText("Subject Accent")).toBeInTheDocument();
  });
});
