import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotificationModal } from "@/components/notifications/NotificationModal";
import type { AppNotification } from "@/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/owner/dashboard",
}));

const mockNotifications: AppNotification[] = [
  {
    id: "notif-1",
    userId: "owner-1",
    title: "Timetable Updated",
    body: "Grade 06 Maths class has been scheduled for Friday 08:00 AM.",
    createdAt: new Date().toISOString(),
    readAt: null,
    link: "/owner/timetable",
  },
  {
    id: "notif-2",
    userId: "owner-1",
    title: "Salary Invoice Generated",
    body: "Monthly payout calculated for Science Teacher Test.",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    readAt: new Date(Date.now() - 1800000).toISOString(),
    link: "/owner/salary",
  },
  {
    id: "notif-3",
    userId: "owner-1",
    title: "Timetable Clash Alert",
    body: "Teacher Test was assigned to two simultaneous sessions.",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    readAt: null,
    link: "/owner/timetable",
  },
];

describe("NotificationModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/notifications") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            notifications: mockNotifications,
            unreadCount: 2,
          }),
        });
      }
      if (url.startsWith("/api/notifications/") && url.endsWith("/read")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      if (url === "/api/notifications/read-all") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders trigger button with unread count badge", () => {
    render(<NotificationModal role="owner" unreadCount={2} />);
    const triggerBtn = screen.getByRole("button", { name: /notifications \(2 unread\)/i });
    expect(triggerBtn).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("opens modal and displays notifications when trigger is clicked", async () => {
    render(<NotificationModal role="owner" unreadCount={2} />);
    const triggerBtn = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(triggerBtn);

    expect(await screen.findByRole("dialog", { name: /notifications panel/i })).toBeInTheDocument();
    expect(await screen.findByText("Timetable Updated")).toBeInTheDocument();
    expect(screen.getByText("Salary Invoice Generated")).toBeInTheDocument();
    expect(screen.getByText("Timetable Clash Alert")).toBeInTheDocument();
  });

  it("filters unread notifications when unread tab is selected", async () => {
    render(<NotificationModal role="owner" unreadCount={2} />);
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));

    expect(await screen.findByText("Timetable Updated")).toBeInTheDocument();
    expect(screen.getByText("Salary Invoice Generated")).toBeInTheDocument();

    const unreadTab = await screen.findByRole("button", { name: /^unread/i });
    fireEvent.click(unreadTab);

    // Read item should now be filtered out
    await waitFor(() => {
      expect(screen.queryByText("Salary Invoice Generated")).not.toBeInTheDocument();
    });
    // Unread items remain
    expect(screen.getByText("Timetable Updated")).toBeInTheDocument();
    expect(screen.getByText("Timetable Clash Alert")).toBeInTheDocument();
  });

  it("marks single notification as read and navigates when item is clicked", async () => {
    const handleCountChange = vi.fn();
    render(
      <NotificationModal
        role="owner"
        unreadCount={2}
        onUnreadCountChange={handleCountChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));

    const item = await screen.findByText("Timetable Updated");
    fireEvent.click(item);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/notifications/notif-1/read", { method: "PATCH" });
      expect(handleCountChange).toHaveBeenCalledWith(1);
      expect(mockPush).toHaveBeenCalledWith("/owner/timetable");
    });
  });

  it("marks all notifications as read when mark all read button is clicked", async () => {
    const handleCountChange = vi.fn();
    render(
      <NotificationModal
        role="owner"
        unreadCount={2}
        onUnreadCountChange={handleCountChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));

    const markAllBtn = await screen.findByRole("button", { name: /mark all as read/i });
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/notifications/read-all", { method: "POST" });
      expect(handleCountChange).toHaveBeenCalledWith(0);
    });
  });

  it("closes modal on Escape key press", async () => {
    render(<NotificationModal role="owner" unreadCount={2} />);
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("closes modal when close button is clicked", async () => {
    render(<NotificationModal role="owner" unreadCount={2} />);
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows empty state when no notifications are returned", async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ notifications: [], unreadCount: 0 }),
      })
    );

    render(<NotificationModal role="teacher" unreadCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));

    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
    expect(screen.getByText("New alerts and timetable updates will appear here.")).toBeInTheDocument();
  });
});
