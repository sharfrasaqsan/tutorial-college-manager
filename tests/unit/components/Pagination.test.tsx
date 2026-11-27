import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Pagination } from "@/components/ui/Pagination";

describe("Pagination Component", () => {
  it("renders page buttons and summary correctly", () => {
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={() => {}}
      />
    );

    expect(
      screen.getByText((_, element) => {
        return (
          element?.tagName.toLowerCase() === "span" &&
          (element.textContent || "").includes("Showing") &&
          (element.textContent || "").includes("50")
        );
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
  });

  it("handles page change when page button is clicked", () => {
    const handlePageChange = vi.fn();
    render(
      <Pagination
        currentPage={1}
        totalItems={50}
        pageSize={10}
        onPageChange={handlePageChange}
      />
    );

    const page2Btn = screen.getByRole("button", { name: "Page 2" });
    fireEvent.click(page2Btn);
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it("disables previous button on first page and next button on last page", () => {
    const { rerender } = render(
      <Pagination
        currentPage={1}
        totalItems={30}
        pageSize={10}
        onPageChange={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();

    rerender(
      <Pagination
        currentPage={3}
        totalItems={30}
        pageSize={10}
        onPageChange={() => {}}
      />
    );

    expect(screen.getByRole("button", { name: /previous/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });
});
