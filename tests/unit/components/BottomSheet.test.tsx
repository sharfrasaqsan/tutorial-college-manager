import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BottomSheet } from "@/components/ui/BottomSheet";

describe("BottomSheet Component", () => {
  it("does not render when open is false", () => {
    render(
      <BottomSheet open={false} onClose={() => {}}>
        <div>Drawer Content</div>
      </BottomSheet>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title, description and children when open is true", () => {
    render(
      <BottomSheet
        open={true}
        onClose={() => {}}
        title="Add Timetable Slot"
        description="Configure room and faculty allocation"
      >
        <p>Slot Form Fields</p>
      </BottomSheet>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Add Timetable Slot")).toBeInTheDocument();
    expect(screen.getByText("Configure room and faculty allocation")).toBeInTheDocument();
    expect(screen.getByText("Slot Form Fields")).toBeInTheDocument();
  });

  it("triggers onClose when close icon button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <BottomSheet open={true} onClose={handleClose} title="Panel Title">
        <div>Content</div>
      </BottomSheet>
    );

    const closeBtn = screen.getByRole("button", { name: /close dialog/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape key press", () => {
    const handleClose = vi.fn();
    render(
      <BottomSheet open={true} onClose={handleClose} title="Panel">
        <div>Content</div>
      </BottomSheet>
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
