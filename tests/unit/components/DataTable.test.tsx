import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable, DataTableColumn } from "@/components/ui/DataTable";

interface MockStudent {
  id: string;
  name: string;
  grade: string;
  status: string;
}

const mockData: MockStudent[] = [
  { id: "s1", name: "Alice Perera", grade: "Grade 06", status: "Active" },
  { id: "s2", name: "Bob Silva", grade: "Grade 07", status: "Active" },
  { id: "s3", name: "Charlie Fernando", grade: "Grade 08", status: "Inactive" },
  { id: "s4", name: "David De Silva", grade: "Grade 09", status: "Active" },
  { id: "s5", name: "Eve Jayawardena", grade: "Grade 10", status: "Active" },
];

const columns: DataTableColumn<MockStudent>[] = [
  { key: "name", header: "Student Name" },
  { key: "grade", header: "Grade Level" },
  {
    key: "status",
    header: "Status",
    render: (item) => <span data-testid="custom-status">{item.status.toUpperCase()}</span>,
  },
];

describe("DataTable Component", () => {
  it("renders emptyState when data is empty", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        keyExtractor={(item) => item.id}
        emptyState={<div>No students enrolled</div>}
      />
    );
    expect(screen.getByText("No students enrolled")).toBeInTheDocument();
  });

  it("renders table headers and rows correctly for dataset", () => {
    render(
      <DataTable
        columns={columns}
        data={mockData}
        keyExtractor={(item) => item.id}
      />
    );

    // Headers
    expect(screen.getAllByText("Student Name").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Grade Level").length).toBeGreaterThan(0);

    // Row contents
    expect(screen.getAllByText("Alice Perera").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bob Silva").length).toBeGreaterThan(0);
  });

  it("executes custom cell render functions", () => {
    render(
      <DataTable
        columns={columns}
        data={mockData.slice(0, 2)}
        keyExtractor={(item) => item.id}
      />
    );

    const customBadges = screen.getAllByTestId("custom-status");
    expect(customBadges.length).toBeGreaterThan(0);
    expect(customBadges[0].textContent).toBe("ACTIVE");
  });

  it("paginates items correctly when pageSize is specified", () => {
    render(
      <DataTable
        columns={columns}
        data={mockData}
        keyExtractor={(item) => item.id}
        pageSize={2}
        pagination={true}
      />
    );

    // Page 1 should show Alice and Bob
    expect(screen.getAllByText("Alice Perera").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bob Silva").length).toBeGreaterThan(0);
    // Should NOT show Charlie on Page 1
    expect(screen.queryByText("Charlie Fernando")).not.toBeInTheDocument();

    // Click Next or Page 2
    const page2Btn = screen.getByRole("button", { name: "Page 2" });
    fireEvent.click(page2Btn);

    // Page 2 should now show Charlie and David
    expect(screen.getAllByText("Charlie Fernando").length).toBeGreaterThan(0);
    expect(screen.getAllByText("David De Silva").length).toBeGreaterThan(0);
  });
});
