"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { performSignOut } from "@/lib/client-auth";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  CalendarDays,
  Clock,
  BookOpen,
  Banknote,
  Bell,
  User,
  LogOut,
  Loader2,
  ChevronDown,
  Menu,
  GraduationCap,
  ExternalLink,
} from "lucide-react";

export interface TeacherShellProps {
  children: React.ReactNode;
  pageTitle?: string;
  selectedYear?: string;
  hasNotifications?: boolean;
  maxWidth?: "narrow" | "default" | "wide" | "md" | "5xl" | "full";
}

interface SidebarNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<any>;
  exact?: boolean;
  badge?: number;
}

// Client-side module-level cache for teacher shell data
let cachedTeacherCollege: {
  name: string;
  logoUrl: string | null;
  fetchedAt: number;
} | null = null;

let lastTeacherNotifFetch = 0;
let cachedTeacherNotifCount = 0;
const TEACHER_COLLEGE_CACHE_TTL_MS = 60 * 1000;
const TEACHER_NOTIF_THROTTLE_MS = 15 * 1000;

export function TeacherShell({
  children,
  pageTitle = "Teacher Portal",
  selectedYear = "2026",
  hasNotifications = false,
  maxWidth = "default",
}: TeacherShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [unreadNotifCount, setUnreadNotifCount] = useState(() => cachedTeacherNotifCount);
  const [collegeName, setCollegeName] = useState(() => cachedTeacherCollege?.name || "");
  const [collegeLogo, setCollegeLogo] = useState<string | null>(() => cachedTeacherCollege?.logoUrl || null);
  const [collegeLoaded, setCollegeLoaded] = useState(() => Boolean(cachedTeacherCollege));
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    async function loadNotifications() {
      const now = Date.now();
      if (now - lastTeacherNotifFetch < TEACHER_NOTIF_THROTTLE_MS) {
        return;
      }
      lastTeacherNotifFetch = now;
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          const count = data.unreadCount || 0;
          cachedTeacherNotifCount = count;
          setUnreadNotifCount(count);
        }
      } catch {}
    }
    loadNotifications();
  }, [pathname]);

  useEffect(() => {
    async function loadCollege() {
      const now = Date.now();
      if (cachedTeacherCollege && now - cachedTeacherCollege.fetchedAt < TEACHER_COLLEGE_CACHE_TTL_MS) {
        return;
      }
      try {
        const res = await fetch("/api/owner/settings/college");
        if (res.ok) {
          const data = await res.json();
          const name = data.profile?.name || "";
          const logoUrl = data.profile?.logoUrl || null;
          setCollegeName(name);
          setCollegeLogo(logoUrl);
          cachedTeacherCollege = {
            name,
            logoUrl,
            fetchedAt: now,
          };
        }
      } catch {} finally {
        setCollegeLoaded(true);
      }
    }
    loadCollege();
  }, []);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await performSignOut(router);
    } catch {
      window.location.replace("/login");
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

  // Full Expanded Sidebar Links for Desktop & Tablet Rail (NO "More" item)
  const sidebarNavItems: SidebarNavItem[] = [
    { label: "Today's Schedule", href: "/teacher", icon: CalendarDays, exact: true },
    { label: "Weekly Timetable", href: "/teacher/timetable", icon: Clock },
    { label: "My Classes", href: "/teacher/classes", icon: BookOpen },
    { label: "Salary & Pay", href: "/teacher/salary", icon: Banknote },
    { label: "Notifications", href: "/teacher/notifications", icon: Bell, badge: unreadNotifCount },
    { label: "Account Profile", href: "/teacher/more", icon: User },
  ];

  const maxWClass = {
    narrow: "max-w-2xl",
    default: "max-w-6xl",
    wide: "max-w-7xl",
    md: "max-w-md md:max-w-4xl lg:max-w-6xl",
    "5xl": "max-w-5xl",
    full: "max-w-full",
  }[maxWidth] || "max-w-6xl";

  return (
    <div className="min-h-screen flex bg-[#FAF9F6] text-[#1C1F23]">
      {/* 1. TABLET ICON RAIL (768px - 1023px) */}
      <aside
        aria-label="Teacher tablet rail"
        className="hidden md:flex lg:hidden w-16 bg-[#FFFFFF] border-r border-[#E4E1DA] flex-col items-center py-4 shrink-0 z-30 sticky top-0 h-screen"
      >
        <Link href="/teacher" className="mb-6 p-2 rounded-[6px] hover:bg-[#FAF9F6]">
          {collegeLogo ? (
            <img src={collegeLogo} alt={collegeName} className="w-8 h-8 object-contain rounded" />
          ) : (
            <div className="w-8 h-8 rounded bg-[#1F5C4D] text-[#FFFFFF] flex items-center justify-center font-serif font-bold text-sm">
              {collegeName.charAt(0)}
            </div>
          )}
        </Link>

        <div className="flex-1 flex flex-col items-center gap-1.5 w-full px-2 overflow-y-auto">
          {sidebarNavItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || (item.href !== "/teacher" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`relative w-11 h-11 flex items-center justify-center rounded-[6px] transition-colors ${
                  isActive
                    ? "bg-[#E6F0EC] text-[#1F5C4D]"
                    : "text-[#5F6670] hover:text-[#1C1F23] hover:bg-[#FAF9F6]"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.75} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#A32A2A]" />
                ) : null}
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          title={signingOut ? "Signing out..." : "Sign Out"}
          className="mt-auto w-11 h-11 flex items-center justify-center text-[#5F6670] hover:text-[#A32A2A] rounded-[6px] transition-colors disabled:opacity-50"
          aria-label="Sign Out"
        >
          {signingOut ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#A32A2A]" strokeWidth={1.75} />
          ) : (
            <LogOut className="w-5 h-5" strokeWidth={1.75} />
          )}
        </button>
      </aside>

      {/* 2. DESKTOP SIDEBAR (1024px+) */}
      <aside
        aria-label="Teacher desktop sidebar"
        className="hidden lg:flex w-60 bg-[#FFFFFF] border-r border-[#E4E1DA] flex-col shrink-0 z-30 sticky top-0 h-screen select-none"
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#E4E1DA] flex items-center gap-2.5">
          {!collegeLoaded ? (
            <>
              <Skeleton className="w-8 h-8 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton variant="text" className="w-20 h-2.5" />
              </div>
            </>
          ) : (
            <>
              {collegeLogo ? (
                <img src={collegeLogo} alt={collegeName || "College"} className="w-8 h-8 object-contain rounded-md" />
              ) : (
                <div className="w-8 h-8 rounded-md bg-[#1F5C4D] text-[#FFFFFF] flex items-center justify-center font-serif font-bold text-base shrink-0">
                  {(collegeName || "Tutorial College").charAt(0)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="font-serif font-semibold text-sm text-[#1C1F23] truncate leading-tight">
                  {collegeName || "Tutorial College"}
                </h1>
                <span className="text-[10px] text-[#5F6670] uppercase tracking-wider font-medium">
                  Teacher Portal
                </span>
              </div>
            </>
          )}
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-2.5 mb-1.5 text-[10px] font-semibold text-[#5F6670] uppercase tracking-wider">
            Teaching Workspace
          </div>
          {sidebarNavItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || (item.href !== "/teacher" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-2.5 py-2 rounded-[6px] text-xs transition-colors ${
                  isActive
                    ? "bg-[#E6F0EC] text-[#1F5C4D] font-medium"
                    : "text-[#5F6670] hover:text-[#1C1F23] hover:bg-[#FAF9F6]"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2 : 1.75} />
                  <span>{item.label}</span>
                </div>
                {item.badge && item.badge > 0 ? (
                  <span className="min-w-[18px] h-4 px-1 rounded-full bg-[#A32A2A] text-[#FFFFFF] text-[10px] font-bold flex items-center justify-center">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#E4E1DA] space-y-1">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[6px] text-xs text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7]/50 transition-colors disabled:opacity-50"
          >
            {signingOut ? (
              <Loader2 className="w-4 h-4 text-[#A32A2A] animate-spin" strokeWidth={1.75} />
            ) : (
              <LogOut className="w-4 h-4 text-[#A32A2A]" strokeWidth={1.75} />
            )}
            <span className="font-medium">{signingOut ? "Signing out..." : "Sign Out"}</span>
          </button>
        </div>
      </aside>

      {/* 3. MAIN APP AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Responsive Top Bar */}
        <header className="sticky top-0 z-40 bg-[#FFFFFF] border-b border-[#E4E1DA] px-4 md:px-6 lg:px-8 py-2.5 flex items-center justify-between min-h-[56px]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-serif font-semibold text-base md:text-xl text-[#1C1F23] truncate">
              {pageTitle}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Academic Year Badge */}
            <div
              className="min-h-[44px] px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#1C1F23] bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px]"
              aria-label={`Academic year ${selectedYear}`}
            >
              <span className="text-[11px] text-[#5F6670] hidden sm:inline">Year:</span>
              <span className="tabular-nums text-[#1F5C4D]">{selectedYear}</span>
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

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E6F0EC] text-[#1F5C4D] text-xs font-medium">
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Teacher</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className={`flex-1 w-full mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-10 ${maxWClass}`}>
          {children}
        </main>
      </div>

      {/* 4. MOBILE BOTTOM BAR NAVIGATION (Hidden on md & lg) */}
      <nav
        aria-label="Mobile teacher navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF] border-t border-[#E4E1DA]"
      >
        <div className="max-w-md mx-auto flex items-center justify-around px-1 py-1">
          {mobileNavItems.map((item) => {
            const isActive =
              item.href === "/teacher"
                ? pathname === "/teacher"
                : pathname === item.href || (item.href !== "/teacher" && pathname.startsWith(item.href));
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
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.75} aria-hidden="true" />
                <span className="text-[11px] mt-0.5 tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
