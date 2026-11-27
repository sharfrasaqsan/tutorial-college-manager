import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

describe("ThemeToggle Component", () => {
  it("renders theme toggle button", () => {
    render(<ThemeToggle />);
    const toggleBtn = screen.getByRole("button", { name: /switch to/i });
    expect(toggleBtn).toBeInTheDocument();
  });

  it("toggles between dark and light themes and updates html classes", () => {
    render(<ThemeToggle />);
    const toggleBtn = screen.getByRole("button", { name: /switch to/i });

    // Initially light mode
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    // Toggle to dark
    fireEvent.click(toggleBtn);
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    // Toggle back to light
    fireEvent.click(toggleBtn);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("supports pill variant", () => {
    render(<ThemeToggle variant="pill" />);
    const btn = screen.getByRole("button", { name: /switch to/i });
    expect(btn).toBeInTheDocument();
  });
});
