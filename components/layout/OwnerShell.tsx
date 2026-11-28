"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { performSignOut } from "@/lib/client-auth";
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
  MessageSquare,
  LogOut,
  Loader2,
  ChevronDown,
  Plus,
  Check,
  ShieldCheck,
  ExternalLink,
  Menu,
  Edit2,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NotificationModal } from "@/components/notifications/NotificationModal";
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

// Client-side module-level cache for instantaneous navigation between pages
let cachedOwnerShellData: {
  years: AcademicYear[];
  selectedYear: string;
  collegeName: string;
  collegeLogo: string | null;
  fetchedAt: number;
} | null = null;

let lastOwnerNotifFetch = 0;
let cachedOwnerNotifCount = 0;
let cachedOwnerMsgCount = 0;
const SHELL_DATA_REVALIDATE_MS = 60 * 1000; // 60s
const NOTIF_THROTTLE_MS = 15 * 1000; // 15s

export function OwnerShell({
  children,
  pageTitle = "Owner Portal",
  hasNotifications = false,
  maxWidth = "default",
}: OwnerShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [years, setYears] = useState<AcademicYear[]>(() => cachedOwnerShellData?.years || []);
  const [selectedYear, setSelectedYear] = useState<string>(() => cachedOwnerShellData?.selectedYear || "");
  const [shellLoaded, setShellLoaded] = useState(() => Boolean(cachedOwnerShellData));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newYearInput, setNewYearInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [firstTimeModal, setFirstTimeModal] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(() => cachedOwnerNotifCount);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(() => cachedOwnerMsgCount);
  const [collegeName, setCollegeName] = useState(() => cachedOwnerShellData?.collegeName || "");
  const [collegeLogo, setCollegeLogo] = useState<string | null>(() => cachedOwnerShellData?.collegeLogo || null);
  const [signingOut, setSigningOut] = useState(false);

  // Edit & Delete Academic Year states (with double confirmation on delete)
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);
  const [editYearName, setEditYearName] = useState("");
  const [editYearStatus, setEditYearStatus] = useState<"active" | "archived">("active");
  const [isUpdatingYear, setIsUpdatingYear] = useState(false);

  const [deleteStep1Year, setDeleteStep1Year] = useState<AcademicYear | null>(null);
  const [deleteStep2Year, setDeleteStep2Year] = useState<AcademicYear | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [isDeletingYear, setIsDeletingYear] = useState(false);

  useEffect(() => {
    async function loadNotifications() {
      const now = Date.now();
      if (now - lastOwnerNotifFetch < NOTIF_THROTTLE_MS) {
        return;
      }
      lastOwnerNotifFetch = now;
      try {
        const [notifRes, msgRes] = await Promise.all([
          fetch("/api/notifications"),
          fetch("/api/owner/messages"),
        ]);
        if (notifRes.ok) {
          const data = await notifRes.json();
          const count = data.unreadCount || 0;
          cachedOwnerNotifCount = count;
          setUnreadNotifCount(count);
        }
        if (msgRes.ok) {
          const msgData = await msgRes.json();
          const count = msgData.unreadCount || 0;
          cachedOwnerMsgCount = count;
          setUnreadMessagesCount(count);
        }
      } catch {}
    }
    loadNotifications();
  }, [pathname]);

  useEffect(() => {
    async function loadData() {
      const now = Date.now();
      const hasFreshData =
        cachedOwnerShellData && now - cachedOwnerShellData.fetchedAt < SHELL_DATA_REVALIDATE_MS;
      if (hasFreshData) {
        return;
      }

      try {
        const [yearsRes, collegeRes] = await Promise.all([
          fetch("/api/owner/years"),
          fetch("/api/owner/settings/college"),
        ]);

        let loadedYears: AcademicYear[] = cachedOwnerShellData?.years || [];
        let loadedSelectedYear: string = cachedOwnerShellData?.selectedYear || "";
        let loadedCollegeName = cachedOwnerShellData?.collegeName || "";
        let loadedCollegeLogo = cachedOwnerShellData?.collegeLogo || null;

        if (yearsRes.ok) {
          const data = await yearsRes.json();
          loadedYears = data.years || [];
          setYears(loadedYears);
          if (data.selectedYear) {
            loadedSelectedYear = data.selectedYear;
            setSelectedYear(data.selectedYear);
          } else if (data.years && data.years.length > 0) {
            loadedSelectedYear = data.years[0].id;
            setSelectedYear(data.years[0].id);
          } else {
            setFirstTimeModal(true);
          }
        }

        if (collegeRes.ok) {
          const colData = await collegeRes.json();
          if (colData.profile?.name) {
            loadedCollegeName = colData.profile.name;
            setCollegeName(colData.profile.name);
          }
          if (colData.profile?.logoUrl) {
            loadedCollegeLogo = colData.profile.logoUrl;
            setCollegeLogo(colData.profile.logoUrl);
          }
        }

        cachedOwnerShellData = {
          years: loadedYears,
          selectedYear: loadedSelectedYear,
          collegeName: loadedCollegeName,
          collegeLogo: loadedCollegeLogo,
          fetchedAt: now,
        };
      } catch (err) {
        console.error("Failed to load shell data:", err);
      } finally {
        setShellLoaded(true);
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
        if (cachedOwnerShellData) {
          cachedOwnerShellData.selectedYear = year;
        }
        setSheetOpen(false);
        window.dispatchEvent(new CustomEvent("tcm-year-changed", { detail: { year } }));
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
      window.dispatchEvent(new CustomEvent("tcm-year-changed", { detail: { year: data.year.id } }));
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create academic year.");
    } finally {
      setIsCreating(false);
    }
  }

  function startEditingYear(yearItem: AcademicYear) {
    setErrorMessage("");
    setEditingYear(yearItem);
    setEditYearName(yearItem.name || yearItem.id);
    setEditYearStatus(yearItem.status || "active");
  }

  async function handleSaveEditYear(e: React.FormEvent) {
    e.preventDefault();
    if (!editingYear) return;
    setErrorMessage("");

    const trimmedName = editYearName.trim();
    if (!trimmedName) {
      setErrorMessage("Display name cannot be empty.");
      return;
    }

    setIsUpdatingYear(true);
    try {
      const res = await fetch(`/api/owner/years/${editingYear.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, status: editYearStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update academic year.");
      }

      setYears((prev) =>
        prev.map((y) => (y.id === editingYear.id ? data.year : y))
      );
      setEditingYear(null);
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update academic year.");
    } finally {
      setIsUpdatingYear(false);
    }
  }

  async function handleConfirmDeleteYear(e: React.FormEvent) {
    e.preventDefault();
    if (!deleteStep2Year) return;
    setErrorMessage("");

    if (deleteConfirmInput.trim() !== deleteStep2Year.id) {
      setErrorMessage(`Please type "${deleteStep2Year.id}" exactly to confirm deletion.`);
      return;
    }

    setIsDeletingYear(true);
    try {
      const res = await fetch(`/api/owner/years/${deleteStep2Year.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmYear: deleteConfirmInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete academic year.");
      }

      const remaining: AcademicYear[] = data.years || years.filter((y) => y.id !== deleteStep2Year.id);
      setYears(remaining);
      if (data.nextSelectedYear && data.nextSelectedYear !== selectedYear) {
        setSelectedYear(data.nextSelectedYear);
        window.dispatchEvent(
          new CustomEvent("tcm-year-changed", { detail: { year: data.nextSelectedYear } })
        );
      }
      setDeleteStep2Year(null);
      setDeleteConfirmInput("");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to delete academic year.");
    } finally {
      setIsDeletingYear(false);
    }
  }

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
        { label: "Contact Messages", href: "/owner/messages", icon: MessageSquare, badge: unreadMessagesCount },
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
        aria-label="Desktop sidebar"
        className="hidden lg:flex w-60 bg-[#FFFFFF] border-r border-[#E4E1DA] flex-col shrink-0 z-30 sticky top-0 h-screen select-none"
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#E4E1DA] flex items-center gap-2.5">
          {!shellLoaded ? (
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
                  Administrator Portal
                </span>
              </div>
            </>
          )}
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

          {/* Right Controls: Academic Year, Theme, Notifications & Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Theme Switcher Toggle */}
            <ThemeToggle />

            {/* Academic Year Selector Pill Button */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="min-h-[44px] px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-[#1C1F23] bg-[#FAF9F6] hover:bg-[#E6F0EC] border border-[#E4E1DA] rounded-[6px] transition-colors cursor-pointer"
              aria-label={selectedYear ? `Academic year ${selectedYear}. Click to change.` : "Select academic year"}
              title="Change Academic Year"
            >
              <span className="text-[11px] text-[#5F6670] hidden sm:inline">Year:</span>
              {selectedYear ? (
                <span className="font-semibold tabular-nums text-[#1F5C4D]">{selectedYear}</span>
              ) : (
                <Skeleton className="h-3.5 w-9" />
              )}
              <ChevronDown className="w-3.5 h-3.5 text-[#5F6670]" strokeWidth={1.75} />
            </button>

            {/* Notifications Modal */}
            <NotificationModal
              role="owner"
              unreadCount={unreadNotifCount}
              hasNotifications={hasNotifications}
              onUnreadCountChange={setUnreadNotifCount}
            />

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

      {/* Year Selection & Management Sheet / Drawer */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setEditingYear(null);
          setErrorMessage("");
        }}
        title="Manage Academic Years"
        description="Select, edit, create, or remove academic years."
      >
        <div className="flex flex-col gap-4 py-2">
          {errorMessage && <Toast message={errorMessage} variant="danger" />}

          {/* List of Years */}
          <div className="flex flex-col divide-y divide-[#E4E1DA] border border-[#E4E1DA] rounded-[6px] overflow-hidden">
            {years.map((yearItem) => {
              const isCurrent = yearItem.id === selectedYear;
              const isOnlyYear = years.length <= 1;

              return (
                <div
                  key={yearItem.id}
                  className={`min-h-[48px] w-full px-3 py-2 flex items-center justify-between gap-2 text-xs transition-colors ${
                    isCurrent
                      ? "bg-[#E6F0EC] text-[#1F5C4D]"
                      : "bg-[#FFFFFF] text-[#1C1F23] hover:bg-[#FAF9F6]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectYear(yearItem.id)}
                    className="flex-1 min-w-0 text-left flex items-center gap-2 py-1"
                  >
                    <span className={`tabular-nums text-sm truncate ${isCurrent ? "font-semibold" : "font-medium"}`}>
                      {yearItem.name || yearItem.id}
                    </span>
                    {yearItem.name && yearItem.name !== yearItem.id && (
                      <span className="text-[10px] text-[#5F6670] tabular-nums">
                        ({yearItem.id})
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${
                        yearItem.status === "archived"
                          ? "bg-[#F0EFEB] border-[#E4E1DA] text-[#5F6670]"
                          : "bg-[#FAF9F6] border-[#E4E1DA] text-[#1F5C4D]"
                      }`}
                    >
                      {yearItem.status === "archived" ? "Archived" : "Active"}
                    </span>
                    {isCurrent && <Check className="w-4 h-4 text-[#1F5C4D] shrink-0" />}
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditingYear(yearItem);
                      }}
                      title={`Edit ${yearItem.id}`}
                      aria-label={`Edit academic year ${yearItem.id}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-[4px] text-[#5F6670] hover:text-[#1F5C4D] hover:bg-[#FAF9F6] transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>

                    <button
                      type="button"
                      disabled={isOnlyYear}
                      onClick={(e) => {
                        e.stopPropagation();
                        setErrorMessage("");
                        setDeleteStep1Year(yearItem);
                      }}
                      title={
                        isOnlyYear
                          ? "Cannot delete the only academic year"
                          : `Delete ${yearItem.id}`
                      }
                      aria-label={`Delete academic year ${yearItem.id}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-[4px] text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7]/50 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Inline Edit Year Form */}
          {editingYear && (
            <form
              onSubmit={handleSaveEditYear}
              className="p-3.5 rounded-[6px] border border-[#1F5C4D]/40 bg-[#FAF9F6] flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1C1F23]">
                  Edit Academic Year ({editingYear.id})
                </span>
                <button
                  type="button"
                  onClick={() => setEditingYear(null)}
                  className="text-[11px] text-[#5F6670] hover:text-[#1C1F23]"
                >
                  Cancel
                </button>
              </div>

              <Field id="editYearName" label="Display Name" required>
                <Input
                  type="text"
                  value={editYearName}
                  onChange={(e) => setEditYearName(e.target.value)}
                  placeholder={editingYear.id}
                  maxLength={50}
                  disabled={isUpdatingYear}
                />
              </Field>

              <Field id="editYearStatus" label="Year Status">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditYearStatus("active")}
                    disabled={isUpdatingYear}
                    className={`min-h-[38px] rounded-[6px] border text-xs font-medium transition-colors ${
                      editYearStatus === "active"
                        ? "bg-[#E6F0EC] border-[#1F5C4D] text-[#1F5C4D]"
                        : "bg-[#FFFFFF] border-[#E4E1DA] text-[#5F6670]"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditYearStatus("archived")}
                    disabled={isUpdatingYear}
                    className={`min-h-[38px] rounded-[6px] border text-xs font-medium transition-colors ${
                      editYearStatus === "archived"
                        ? "bg-[#F0EFEB] border-[#1C1F23] text-[#1C1F23]"
                        : "bg-[#FFFFFF] border-[#E4E1DA] text-[#5F6670]"
                    }`}
                  >
                    Archived
                  </button>
                </div>
              </Field>

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditingYear(null)}
                  disabled={isUpdatingYear}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={isUpdatingYear}
                >
                  Save Changes
                </Button>
              </div>
            </form>
          )}

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

      {/* Delete Academic Year - Step 1 Confirmation */}
      <ConfirmDialog
        open={Boolean(deleteStep1Year)}
        onClose={() => setDeleteStep1Year(null)}
        onConfirm={() => {
          const target = deleteStep1Year;
          setDeleteStep1Year(null);
          setDeleteConfirmInput("");
          setDeleteStep2Year(target);
        }}
        title={`Delete Academic Year ${deleteStep1Year?.id || ""}?`}
        description={`This will permanently remove Academic Year ${deleteStep1Year?.id || ""} along with all classes, enrolments, timetable slots, sessions, fee records, and salary invoices inside this year. Permanent student and teacher profiles are kept.`}
        confirmLabel="Continue"
        cancelLabel="Cancel"
        variant="danger"
      />

      {/* Delete Academic Year - Step 2 Final Typed Confirmation */}
      <BottomSheet
        open={Boolean(deleteStep2Year)}
        onClose={() => {
          if (!isDeletingYear) {
            setDeleteStep2Year(null);
            setDeleteConfirmInput("");
          }
        }}
        title="Final Delete Confirmation"
        description={`Type "${deleteStep2Year?.id || ""}" below to permanently delete this academic year. This cannot be undone.`}
      >
        <form onSubmit={handleConfirmDeleteYear} className="flex flex-col gap-4 py-2">
          <div className="p-3 rounded-[6px] bg-[#FBE9E7]/60 border border-[#A32A2A]/30 flex items-start gap-2.5 text-xs text-[#A32A2A]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.75} />
            <div>
              <strong>Permanent Action:</strong> All classes, timetable schedules, fee collections, and salary records for{" "}
              <span className="font-semibold">{deleteStep2Year?.id}</span> will be erased permanently.
            </div>
          </div>

          <Field
            id="confirmDeleteYearInput"
            label={`Type ${deleteStep2Year?.id || ""} to confirm`}
            required
          >
            <Input
              type="text"
              placeholder={deleteStep2Year?.id || ""}
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              maxLength={4}
              disabled={isDeletingYear}
              autoFocus
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDeleteStep2Year(null);
                setDeleteConfirmInput("");
              }}
              disabled={isDeletingYear}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={isDeletingYear}
              disabled={isDeletingYear || deleteConfirmInput.trim() !== deleteStep2Year?.id}
            >
              Permanently Delete {deleteStep2Year?.id}
            </Button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
}
