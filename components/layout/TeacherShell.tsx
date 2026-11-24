"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  CalendarDays,
  Clock,
  BookOpen,
  Banknote,
  Menu,
  Bell,
  ChevronDown,
  LogOut,
  User,
  KeyRound,
  GraduationCap,
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
  const router = useRouter();
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [collegeName, setCollegeName] = useState("Tutorial College");
  const [collegeLogo, setCollegeLogo] = useState<string | null>(null);

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

  useEffect(() => {
    async function loadCollegeProfile() {
      try {
        const res = await fetch("/api/owner/settings/college");
        if (res.ok) {
          const data = await res.json();
          if (data.profile?.name) setCollegeName(data.profile.name);
          if (data.profile?.logoUrl) setCollegeLogo(data.profile.logoUrl);
        }
      } catch {}
    }
    loadCollegeProfile();
  }, []);

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await signOut(auth);
      router.push("/login");
    } catch {
      router.push("/login");
    }
  }

  // Mobile Bottom Navigation (5 items)
  const mobileNavItems = [
    { label: "Today", href: "/teacher", icon: CalendarDays },
    { label: "Timetable", href: "/teacher/timetable", icon: Clock },
    { label: "Classes", href: "/teacher/classes", icon: BookOpen },
    { label: "Salary", href: "/teacher/salary", icon: Banknote },
    { label: "More", href: "/teacher/more", icon: Menu },
  ];

  // Desktop / Tablet Sidebar Navigation (Direct links)
  const desktopNavItems = [
    { label: "Today", href: "/teacher", icon: CalendarDays, shortLabel: "Today" },
    { label: "Timetable", href: "/teacher/timetable", icon: Clock, shortLabel: "Timetable" },
    { label: "Classes", href: "/teacher/classes", icon: BookOpen, shortLabel: "Classes" },
    { label: "Salary", href: "/teacher/salary", icon: Banknote, shortLabel: "Salary" },
    {
      label: "Notifications",
      href: "/teacher/notifications",
      icon: Bell,
      shortLabel: "Alerts",
      badge: unreadNotifCount,
    },
    { label: "Account & Security", href: "/teacher/more", icon: KeyRound, shortLabel: "Account" },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FAF9F6] text-[#1C1F23]">
      {/* ============================================================ */}
      {/* 1. TABLET SIDEBAR (768px - 1023px): Narrow Icon + Short Label */}
      {/* ============================================================ */}
      <aside
        aria-label="Teacher navigation (tablet)"
        className="hidden md:flex lg:hidden fixed top-0 bottom-0 left-0 z-40 w-20 flex-col bg-[#FFFFFF] border-r border-[#E4E1DA]"
      >
        {/* Brand mark */}
        <div className="h-14 flex items-center justify-center border-b border-[#E4E1DA]">
          {collegeLogo ? (
            <img src={collegeLogo} alt={collegeName} className="w-8 h-8 object-contain rounded-[4px]" />
          ) : (
            <div className="w-8 h-8 rounded-[4px] bg-[#1F5C4D] text-[#FFFFFF] flex items-center justify-center font-serif font-bold text-sm">
              {collegeName.charAt(0) || "T"}
            </div>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-1">
          {desktopNavItems.map((item) => {
            const isActive =
              item.href === "/teacher"
                ? pathname === "/teacher"
                : pathname === item.href || (item.href !== "/teacher" && pathname?.startsWith(item.href + "/"));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-[6px] select-none transition-colors min-h-[48px] relative ${
                  isActive
                    ? "bg-[#E6F0EC] text-[#1F5C4D] font-semibold"
                    : "text-[#5F6670] hover:text-[#1C1F23] hover:bg-[#FAF9F6]"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
                <span className="text-[10px] mt-1 tracking-tight text-center truncate max-w-full">
                  {item.shortLabel}
                </span>
                {item.badge && item.badge > 0 ? (
                  <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#A32A2A]" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Sign Out at Bottom */}
        <div className="p-2 border-t border-[#E4E1DA]">
          <button
            type="button"
            onClick={handleSignOut}
            title="Sign Out"
            className="w-full flex flex-col items-center justify-center py-2 text-[#A32A2A] hover:bg-[#FBE9E7] rounded-[6px] transition-colors min-h-[44px]"
            aria-label="Sign out of teacher account"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">Exit</span>
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 2. DESKTOP SIDEBAR (1024px+): Full 240px with Text Labels    */}
      {/* ============================================================ */}
      <aside
        aria-label="Teacher navigation (desktop)"
        className="hidden lg:flex fixed top-0 bottom-0 left-0 z-40 w-60 flex-col bg-[#FFFFFF] border-r border-[#E4E1DA]"
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center gap-3 border-b border-[#E4E1DA]">
          {collegeLogo ? (
            <img src={collegeLogo} alt={collegeName} className="w-9 h-9 object-contain rounded-[6px]" />
          ) : (
            <div className="w-9 h-9 rounded-[6px] bg-[#1F5C4D] text-[#FFFFFF] flex items-center justify-center font-serif font-bold text-base shrink-0">
              {collegeName.charAt(0) || "T"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-serif font-semibold text-sm text-[#1C1F23] truncate leading-tight">
              {collegeName}
            </div>
            <div className="text-[10px] text-[#5F6670] font-medium tracking-wider uppercase mt-0.5">
              Teacher Faculty Portal
            </div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {desktopNavItems.map((item) => {
            const isActive =
              item.href === "/teacher"
                ? pathname === "/teacher"
                : pathname === item.href || (item.href !== "/teacher" && pathname?.startsWith(item.href + "/"));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-[6px] text-xs select-none transition-colors min-h-[40px] ${
                  isActive
                    ? "bg-[#E6F0EC] text-[#1F5C4D] font-semibold"
                    : "text-[#5F6670] hover:text-[#1C1F23] hover:bg-[#FAF9F6]"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && item.badge > 0 ? (
                  <span className="min-w-[18px] h-4 px-1.5 text-[10px] font-bold bg-[#A32A2A] text-[#FFFFFF] rounded-full flex items-center justify-center leading-none">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Profile & Sign Out Block */}
        <div className="p-3 border-t border-[#E4E1DA] space-y-2">
          <div className="px-3 py-1.5 rounded-[6px] bg-[#FAF9F6] border border-[#E4E1DA] flex items-center justify-between">
            <span className="text-[11px] text-[#5F6670]">Academic Year</span>
            <span className="text-xs font-semibold text-[#1F5C4D] tabular-nums">{selectedYear}</span>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#A32A2A] hover:bg-[#FBE9E7] rounded-[6px] transition-colors min-h-[44px]"
            aria-label="Sign out of teacher account"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* 3. MAIN CONTENT WRAPPER (Offsets for Tablet & Desktop)       */}
      {/* ============================================================ */}
      <div className="flex-1 flex flex-col md:pl-20 lg:pl-60 min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-[#FFFFFF] border-b border-[#E4E1DA] px-4 sm:px-6 py-2.5 flex items-center justify-between min-h-[52px]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-[#1C1F23] truncate">
              {pageTitle}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Year Indicator */}
            <div
              className="min-h-[44px] px-2.5 py-1.5 flex items-center gap-1 text-xs font-semibold text-[#1C1F23] bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px]"
              aria-label={`Academic year ${selectedYear}`}
            >
              <span className="tabular-nums font-semibold">Year {selectedYear}</span>
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

            {/* Teacher Role Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#1F5C4D] bg-[#E6F0EC] border border-[#C2DDD4] rounded-[6px]">
              <GraduationCap className="w-3.5 h-3.5 shrink-0" />
              <span>Teacher</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 w-full pb-24 md:pb-12 pt-4">
          {children}
        </main>
      </div>

      {/* ============================================================ */}
      {/* 4. MOBILE BOTTOM BAR (Strictly < 768px, 5 items)             */}
      {/* ============================================================ */}
      <nav
        aria-label="Teacher navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF] border-t border-[#E4E1DA] pb-[calc(env(safe-area-inset-bottom,0px)+2px)]"
      >
        <div className="flex items-center justify-around px-1 py-1">
          {mobileNavItems.map((item) => {
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
