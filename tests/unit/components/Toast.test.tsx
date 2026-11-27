import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Toast } from "@/components/ui/Toast";

describe("Toast Component", () => {
  it("renders success toast message", () => {
    render(<Toast message="Payment recorded successfully" variant="success" inline />);
    expect(screen.getByText("Payment recorded successfully")).toBeInTheDocument();
  });

  it("renders danger toast message with error styling", () => {
    render(<Toast message="Failed to save timetable slot" variant="danger" inline />);
    const msg = screen.getByText("Failed to save timetable slot");
    expect(msg).toBeInTheDocument();
  });

  it("calls onDismiss callback when close button is clicked", () => {
    vi.useFakeTimers();
    const handleDismiss = vi.fn();
    render(<Toast message="Dismissable toast" onDismiss={handleDismiss} inline />);
    const closeBtn = screen.getByRole("button", { name: /dismiss message/i });
    fireEvent.click(closeBtn);

    // Toast exit animation takes 220ms before calling onDismiss
    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(handleDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
