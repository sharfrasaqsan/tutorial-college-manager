"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Clock,
  BookOpen,
  Banknote,
  Menu,
  Bell,
  ChevronDown,
} from "lucide-react";

export interface TeacherShellProps {
  children: React.ReactNode;
  pageTitle?: string;
  selectedYear?: string;
  hasNotifications?: boolean;
}

export function TeacherShell({
  children,
  pageTitle = "Teacher Portal",
  selectedYear = "2026",
  hasNotifications = false,
}: TeacherShellProps) {
  const pathname = usePathname();
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useEffect(() => {
    async function loadNotifications() {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          setUnreadNotifCount(data.unreadCount || 0);
        }
      } catch {}
    }
    loadNotifications();
  }, [pathname]);

  const navItems = [
    { label: "Today", href: "/teacher", icon: CalendarDays },
    { label: "Timetable", href: "/teacher/timetable", icon: Clock },
    { label: "Classes", href: "/teacher/classes", icon: BookOpen },
    { label: "Salary", href: "/teacher/salary", icon: Banknote },
    { label: "More", href: "/teacher/more", icon: Menu },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#1C1F23]">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-[#FFFFFF] border-b border-[#E4E1DA] px-4 py-2 flex items-center justify-between min-h-[52px]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-[#1C1F23] truncate">
            {pageTitle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Year Indicator Placeholder */}
          <div
            className="min-h-[44px] px-2.5 py-1.5 flex items-center gap-1 text-xs font-semibold text-[#1C1F23] bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px]"
            aria-label={`Academic year ${selectedYear}`}
          >
            <span className="tabular-nums">{selectedYear}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#5F6670]" strokeWidth={1.75} />
          </div>

          {/* Notifications Bell */}
          <Link
            href="/teacher/notifications"
            className="min-h-[44px] min-w-[44px] relative flex items-center justify-center text-[#5F6670] hover:text-[#1C1F23] rounded-[6px] transition-colors"
            aria-label={`View notifications (${unreadNotifCount} unread)`}
          >
            <Bell className="w-5 h-5" strokeWidth={1.75} />
            {(unreadNotifCount > 0 || hasNotifications) && (
              <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-[#A32A2A] text-[#FFFFFF] rounded-full flex items-center justify-center leading-none">
                {unreadNotifCount > 9 ? "9+" : unreadNotifCount || "•"}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-md mx-auto p-4 pb-24">
        {children}
      </main>

      {/* Bottom Bar Navigation */}
      <nav
        aria-label="Teacher navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF] border-t border-[#E4E1DA]"
      >
        <div className="max-w-md mx-auto flex items-center justify-around px-1 py-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/teacher"
                ? pathname === "/teacher"
                : pathname?.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`min-h-[44px] flex-1 flex flex-col items-center justify-center py-1 select-none transition-colors rounded-[4px] ${
                  isActive
                    ? "text-[#1F5C4D] font-semibold"
                    : "text-[#5F6670] hover:text-[#1C1F23]"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className="w-5 h-5"
                  strokeWidth={isActive ? 2 : 1.75}
                  aria-hidden="true"
                />
                <span className="text-[11px] mt-0.5 tracking-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
