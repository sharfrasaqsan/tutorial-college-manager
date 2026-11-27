import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";

describe("Card Component", () => {
  it("renders container card with custom content", () => {
    render(<Card>Card Body Content</Card>);
    expect(screen.getByText("Card Body Content")).toBeInTheDocument();
  });

  it("renders CardHeader and CardTitle properly", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Academic Statistics</CardTitle>
        </CardHeader>
      </Card>
    );
    const title = screen.getByText("Academic Statistics");
    expect(title).toBeInTheDocument();
    expect(title.tagName.toLowerCase()).toBe("h3");
  });

  it("supports interactive hover card styling", () => {
    render(<Card interactive>Interactive Card</Card>);
    const cardEl = screen.getByText("Interactive Card");
    expect(cardEl.className).toContain("hover:border-[#1F5C4D]");
  });
});
