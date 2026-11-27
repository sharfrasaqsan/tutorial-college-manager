import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

describe("ConfirmDialog Component", () => {
  it("does not render when open is false", () => {
    render(
      <ConfirmDialog
        open={false}
        title="Delete Class"
        description="Are you sure you want to delete this class?"
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders dialog contents when open is true", () => {
    render(
      <ConfirmDialog
        open={true}
        title="Delete Class"
        description="Are you sure you want to delete this class?"
        confirmLabel="Confirm Delete"
        cancelLabel="Keep Class"
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Delete Class")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to delete this class?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep Class" })).toBeInTheDocument();
  });

  it("triggers onConfirm when confirm button is clicked", () => {
    const handleConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Confirm Action"
        description="Proceed with promotion?"
        onClose={() => {}}
        onConfirm={handleConfirm}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("triggers onClose when cancel button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Cancel Action"
        description="Proceed?"
        onClose={handleClose}
        onConfirm={() => {}}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("closes dialog on Escape key press", () => {
    const handleClose = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        title="Escape Test"
        description="Press escape to close"
        onClose={handleClose}
        onConfirm={() => {}}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("disables buttons and shows loading state when loading is true", () => {
    render(
      <ConfirmDialog
        open={true}
        loading={true}
        title="Saving"
        description="Please wait..."
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
  });
});
