"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  Home,
  BookOpen,
  GraduationCap,
  Users,
  Clock,
  CreditCard,
  Banknote,
  FileSpreadsheet,
  Inbox,
  Bell,
  Building2,
  CalendarDays,
  Globe,
  LogOut,
  ChevronDown,
  Plus,
  Check,
  ShieldCheck,
  ExternalLink,
  Menu,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import type { AcademicYear } from "@/types";

export interface OwnerShellProps {
  children: React.ReactNode;
  pageTitle?: string;
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

interface SidebarNavGroup {
  group: string;
  items: SidebarNavItem[];
}

export function OwnerShell({
  children,
  pageTitle = "Owner Portal",
  hasNotifications = false,
  maxWidth = "default",
}: OwnerShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newYearInput, setNewYearInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [firstTimeModal, setFirstTimeModal] = useState(false);
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
    async function loadData() {
      try {
        const [yearsRes, collegeRes] = await Promise.all([
          fetch("/api/owner/years"),
          fetch("/api/owner/settings/college"),
        ]);

        if (yearsRes.ok) {
          const data = await yearsRes.json();
          setYears(data.years || []);
          if (data.selectedYear) {
            setSelectedYear(data.selectedYear);
          } else if (data.years && data.years.length > 0) {
            setSelectedYear(data.years[0].id);
          } else {
            setFirstTimeModal(true);
          }
        }

        if (collegeRes.ok) {
          const colData = await collegeRes.json();
          if (colData.profile?.name) setCollegeName(colData.profile.name);
          if (colData.profile?.logoUrl) setCollegeLogo(colData.profile.logoUrl);
        }
      } catch (err) {
        console.error("Failed to load shell data:", err);
      }
    }
    loadData();
  }, []);

  async function handleSelectYear(year: string) {
    if (year === selectedYear) {
      setSheetOpen(false);
      return;
    }
    try {
      const res = await fetch("/api/owner/years/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      });
      if (res.ok) {
        setSelectedYear(year);
        setSheetOpen(false);
        router.refresh();
      }
    } catch (err) {
      console.error("Failed to switch academic year:", err);
    }
  }

  async function handleCreateYear(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    const trimmed = newYearInput.trim();

    if (!/^\d{4}$/.test(trimmed)) {
      setErrorMessage("Please enter a valid 4-digit academic year (e.g. 2026).");
      return;
    }

    setIsCreating(true);

    try {
      const res = await fetch("/api/owner/years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: trimmed }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create academic year.");
      }

      setYears((prev) => [data.year, ...prev.filter((y) => y.id !== data.year.id)]);
      setSelectedYear(data.year.id);
      setNewYearInput("");
      setSheetOpen(false);
      setFirstTimeModal(false);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create academic year.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await signOut(auth);
      window.location.replace("/login");
    } catch {
      window.location.replace("/login");
    }
  }

  // Mobile Bottom Navigation (5 items)
  const mobileNavItems = [
    { label: "Home", href: "/owner", icon: Home },
    { label: "Classes", href: "/owner/classes", icon: BookOpen },
    { label: "Fees", href: "/owner/fees", icon: CreditCard },
    { label: "Salary", href: "/owner/salary", icon: Banknote },
    { label: "More", href: "/owner/more", icon: Menu },
  ];

  // Full Expanded Sidebar Links for Desktop & Tablet Rail (NO "More" item)
  const sidebarNavGroups: SidebarNavGroup[] = [
    {
      group: "Operations",
      items: [
        { label: "Home", href: "/owner", icon: Home, exact: true },
        { label: "Classes", href: "/owner/classes", icon: BookOpen },
        { label: "Students", href: "/owner/students", icon: GraduationCap },
        { label: "Teachers", href: "/owner/teachers", icon: Users },
        { label: "Timetable", href: "/owner/timetable", icon: Clock },
      ],
    },
    {
      group: "Finance & Records",
      items: [
        { label: "Fees", href: "/owner/fees", icon: CreditCard },
        { label: "Salary", href: "/owner/salary", icon: Banknote },
        { label: "Reports", href: "/owner/reports", icon: FileSpreadsheet },
        { label: "Requests", href: "/owner/requests", icon: Inbox },
        { label: "Notifications", href: "/owner/notifications", icon: Bell, badge: unreadNotifCount },
      ],
    },
    {
      group: "Institution & Public",
      items: [
        { label: "College Profile", href: "/owner/more/college", icon: Building2 },
        { label: "Academic Structure", href: "/owner/more/academic", icon: CalendarDays },
        { label: "Public Website", href: "/owner/more/public-site", icon: Globe },
      ],
    },
  ];

  // Max width classes for the main content
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
        aria-label="Tablet navigation rail"
        className="hidden md:flex lg:hidden w-16 bg-[#FFFFFF] border-r border-[#E4E1DA] flex-col items-center py-4 shrink-0 z-30 sticky top-0 h-screen"
      >
        <Link href="/owner" className="mb-6 p-2 rounded-[6px] hover:bg-[#FAF9F6]">
          {collegeLogo ? (
            <img src={collegeLogo} alt={collegeName} className="w-8 h-8 object-contain rounded" />
          ) : (
            <div className="w-8 h-8 rounded bg-[#1F5C4D] text-[#FFFFFF] flex items-center justify-center font-serif font-bold text-sm">
              {collegeName.charAt(0)}
            </div>
          )}
        </Link>

        <div className="flex-1 flex flex-col items-center gap-1.5 w-full px-2 overflow-y-auto">
          {sidebarNavGroups.flatMap((g) => g.items).map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || (item.href !== "/owner" && pathname.startsWith(item.href));
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
          title="Sign Out"
          className="mt-auto w-11 h-11 flex items-center justify-center text-[#5F6670] hover:text-[#A32A2A] rounded-[6px] transition-colors"
          aria-label="Sign Out"
        >
          <LogOut className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </aside>

      {/* 2. DESKTOP SIDEBAR (1024px+) */}
      <aside
        aria-label="Desktop sidebar"
        className="hidden lg:flex w-60 bg-[#FFFFFF] border-r border-[#E4E1DA] flex-col shrink-0 z-30 sticky top-0 h-screen select-none"
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#E4E1DA] flex items-center gap-2.5">
          {collegeLogo ? (
            <img src={collegeLogo} alt={collegeName} className="w-8 h-8 object-contain rounded-md" />
          ) : (
            <div className="w-8 h-8 rounded-md bg-[#1F5C4D] text-[#FFFFFF] flex items-center justify-center font-serif font-bold text-base shrink-0">
              {collegeName.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-serif font-semibold text-sm text-[#1C1F23] truncate leading-tight">
              {collegeName}
            </h1>
            <span className="text-[10px] text-[#5F6670] uppercase tracking-wider font-medium">
              Administrator Portal
            </span>
          </div>
        </div>

        {/* Navigation Group Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {sidebarNavGroups.map((group) => (
            <div key={group.group}>
              <div className="px-2.5 mb-1.5 text-[10px] font-semibold text-[#5F6670] uppercase tracking-wider">
                {group.group}
              </div>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.exact
                    ? pathname === item.href
                    : pathname === item.href || (item.href !== "/owner" && pathname.startsWith(item.href));
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
              </nav>
            </div>
          ))}
        </div>

        {/* Sidebar Footer with Sign Out */}
        <div className="p-3 border-t border-[#E4E1DA] space-y-1">
          <Link
            href="/"
            target="_blank"
            className="flex items-center justify-between px-2.5 py-1.5 rounded-[6px] text-xs text-[#5F6670] hover:text-[#1F5C4D] hover:bg-[#FAF9F6] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-[#1F5C4D]" />
              <span>View Public Site</span>
            </div>
            <ExternalLink className="w-3 h-3" />
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-[6px] text-xs text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7]/50 transition-colors"
          >
            <LogOut className="w-4 h-4 text-[#A32A2A]" strokeWidth={1.75} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* 3. MAIN APP AREA (Top Bar + Content) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Responsive Top Bar */}
        <header className="sticky top-0 z-40 bg-[#FFFFFF] border-b border-[#E4E1DA] px-4 md:px-6 lg:px-8 py-2.5 flex items-center justify-between min-h-[56px]">
          {/* Left: Page Title / Mobile Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-serif font-semibold text-base md:text-xl text-[#1C1F23] truncate">
              {pageTitle}
            </span>
          </div>

          {/* Right Controls: Academic Year, Notifications & Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Academic Year Selector Pill Button */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="min-h-[44px] px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-[#1C1F23] bg-[#FAF9F6] hover:bg-[#E6F0EC] border border-[#E4E1DA] rounded-[6px] transition-colors cursor-pointer"
              aria-label={`Academic year ${selectedYear}. Click to change.`}
              title="Change Academic Year"
            >
              <span className="text-[11px] text-[#5F6670] hidden sm:inline">Year:</span>
              <span className="font-semibold tabular-nums text-[#1F5C4D]">{selectedYear}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#5F6670]" strokeWidth={1.75} />
            </button>

            {/* Notifications Bell */}
            <Link
              href="/owner/notifications"
              className="min-h-[44px] min-w-[44px] relative flex items-center justify-center text-[#5F6670] hover:text-[#1C1F23] rounded-[6px] transition-colors"
              aria-label={`Notifications (${unreadNotifCount} unread)`}
            >
              <Bell className="w-5 h-5" strokeWidth={1.75} />
              {(unreadNotifCount > 0 || hasNotifications) && (
                <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-[#A32A2A] text-[#FFFFFF] rounded-full flex items-center justify-center leading-none">
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount || "•"}
                </span>
              )}
            </Link>

            {/* Owner Role Indicator Chip (Desktop & Tablet) */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E6F0EC] text-[#1F5C4D] text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Owner</span>
            </div>
          </div>
        </header>

        {/* Content Body: Responsive width container */}
        <main className={`flex-1 w-full mx-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-10 ${maxWClass}`}>
          {children}
        </main>
      </div>

      {/* 4. MOBILE BOTTOM BAR NAVIGATION (Hidden on md & lg) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF] border-t border-[#E4E1DA]"
      >
        <div className="max-w-md mx-auto flex items-center justify-around px-1 py-1">
          {mobileNavItems.map((item) => {
            const isActive =
              item.href === "/owner"
                ? pathname === "/owner"
                : pathname === item.href || (item.href !== "/owner" && pathname.startsWith(item.href));
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

      {/* Year Selection Sheet / Drawer */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setErrorMessage("");
        }}
        title="Select Academic Year"
        description="Choose the active academic year to view classes, fees, timetable, and salaries."
      >
        <div className="flex flex-col gap-4 py-2">
          {errorMessage && <Toast message={errorMessage} variant="danger" />}

          {/* List of Years */}
          <div className="flex flex-col divide-y divide-[#E4E1DA] border border-[#E4E1DA] rounded-[6px] overflow-hidden">
            {years.map((yearItem) => {
              const isCurrent = yearItem.id === selectedYear;
              return (
                <button
                  key={yearItem.id}
                  type="button"
                  onClick={() => handleSelectYear(yearItem.id)}
                  className={`min-h-[44px] w-full px-4 py-3 text-left flex items-center justify-between text-xs transition-colors ${
                    isCurrent
                      ? "bg-[#E6F0EC] text-[#1F5C4D] font-semibold"
                      : "bg-[#FFFFFF] text-[#1C1F23] hover:bg-[#FAF9F6]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-sm">{yearItem.name || yearItem.id}</span>
                    {yearItem.status === "active" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-[#5F6670]">
                        Active
                      </span>
                    )}
                  </div>
                  {isCurrent && <Check className="w-4 h-4 text-[#1F5C4D]" />}
                </button>
              );
            })}
          </div>

          {/* Create New Year Form */}
          <form onSubmit={handleCreateYear} className="pt-2 border-t border-[#E4E1DA] flex flex-col gap-3">
            <Field
              id="newYearInput"
              label="Create New Academic Year"
              hint="Enter a 4-digit calendar year (e.g. 2027)"
            >
              <Input
                type="text"
                placeholder="2027"
                value={newYearInput}
                onChange={(e) => setNewYearInput(e.target.value)}
                maxLength={4}
              />
            </Field>

            <Button type="submit" variant="primary" loading={isCreating} fullWidth>
              <Plus className="w-4 h-4 mr-1" />
              Add Academic Year
            </Button>
          </form>
        </div>
      </BottomSheet>
    </div>
  );
}
