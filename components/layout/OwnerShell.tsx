"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  Home,
  BookOpen,
  CreditCard,
  Banknote,
  Menu,
  Bell,
  ChevronDown,
  Plus,
  Check,
  Users,
  GraduationCap,
  Calendar,
  FileSpreadsheet,
  Inbox,
  Building2,
  Layers,
  LogOut,
  ShieldCheck,
  Sparkles,
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
  maxWidth?: "md" | "5xl" | "full"; // Deprecated, kept for backward compatibility
}

export function OwnerShell({
  children,
  pageTitle = "Owner Portal",
  hasNotifications = false,
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

  useEffect(() => {
    async function loadYears() {
      try {
        const res = await fetch("/api/owner/years");
        if (res.ok) {
          const data = await res.json();
          setYears(data.years || []);
          if (data.selectedYear) {
            setSelectedYear(data.selectedYear);
          } else if (data.years && data.years.length > 0) {
            setSelectedYear(data.years[0].id);
          } else {
            setFirstTimeModal(true);
          }
        }
      } catch (err) {
        console.error("Failed to load academic years:", err);
      }
    }
    loadYears();
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
      router.push("/login");
    } catch {
      router.push("/login");
    }
  }

  // Mobile Bottom Navigation (Strictly unchanged 5 items)
  const mobileNavItems = [
    { label: "Home", href: "/owner", icon: Home },
    { label: "Classes", href: "/owner/classes", icon: BookOpen },
    { label: "Fees", href: "/owner/fees", icon: CreditCard },
    { label: "Salary", href: "/owner/salary", icon: Banknote },
    { label: "More", href: "/owner/more", icon: Menu },
  ];

  // Desktop / Tablet Expanded Sidebar Navigation (NO "More" item, all direct links)
  const desktopNavItems = [
    { label: "Home", href: "/owner", icon: Home, shortLabel: "Home" },
    { label: "Classes", href: "/owner/classes", icon: BookOpen, shortLabel: "Classes" },
    { label: "Students", href: "/owner/students", icon: GraduationCap, shortLabel: "Students" },
    { label: "Teachers", href: "/owner/teachers", icon: Users, shortLabel: "Teachers" },
    { label: "Timetable", href: "/owner/timetable", icon: Calendar, shortLabel: "Timetable" },
    { label: "Fees", href: "/owner/fees", icon: CreditCard, shortLabel: "Fees" },
    { label: "Salary", href: "/owner/salary", icon: Banknote, shortLabel: "Salary" },
    { label: "Reports", href: "/owner/reports", icon: FileSpreadsheet, shortLabel: "Reports" },
    { label: "Requests", href: "/owner/requests", icon: Inbox, shortLabel: "Requests" },
    {
      label: "Notifications",
      href: "/owner/notifications",
      icon: Bell,
      shortLabel: "Alerts",
      badge: unreadNotifCount,
    },
    { label: "College Settings", href: "/owner/more/college", icon: Building2, shortLabel: "College" },
    { label: "Academic Years", href: "/owner/more/academic", icon: Layers, shortLabel: "Years" },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FAF9F6] text-[#1C1F23]">
      {/* ============================================================ */}
      {/* 1. TABLET SIDEBAR (768px - 1023px): Narrow Icon + Short Label */}
      {/* ============================================================ */}
      <aside
        aria-label="Owner navigation (tablet)"
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
              item.href === "/owner"
                ? pathname === "/owner"
                : pathname === item.href || (item.href !== "/owner" && pathname?.startsWith(item.href + "/"));
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
            aria-label="Sign out of owner account"
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
        aria-label="Owner navigation (desktop)"
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
              Owner Administration
            </div>
          </div>
        </div>

        {/* Desktop Direct Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {desktopNavItems.map((item) => {
            const isActive =
              item.href === "/owner"
                ? pathname === "/owner"
                : pathname === item.href || (item.href !== "/owner" && pathname?.startsWith(item.href + "/"));
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
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="text-xs font-semibold text-[#1F5C4D] hover:underline flex items-center gap-1"
            >
              <span>{selectedYear}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#A32A2A] hover:bg-[#FBE9E7] rounded-[6px] transition-colors min-h-[44px]"
            aria-label="Sign out of owner account"
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
            {/* Year Selector Button */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="min-h-[44px] px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#1C1F23] bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px] hover:bg-[#F2EFE9] transition-colors"
              aria-label={`Academic year ${selectedYear}. Click to change.`}
            >
              <span className="tabular-nums font-semibold">Year {selectedYear}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#5F6670]" strokeWidth={1.75} />
            </button>

            {/* Notifications Bell */}
            <Link
              href="/owner/notifications"
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

            {/* Desktop Signed-In Owner Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#1F5C4D] bg-[#E6F0EC] border border-[#C2DDD4] rounded-[6px]">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Owner</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 w-full pb-24 md:pb-12 pt-4">
          {children}
        </main>
      </div>

      {/* ============================================================ */}
      {/* 4. MOBILE BOTTOM BAR (Strictly < 768px, 5 items + More)      */}
      {/* ============================================================ */}
      <nav
        aria-label="Owner navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF] border-t border-[#E4E1DA] pb-[calc(env(safe-area-inset-bottom,0px)+2px)]"
      >
        <div className="flex items-center justify-around px-1 py-1">
          {mobileNavItems.map((item) => {
            const isActive =
              item.href === "/owner"
                ? pathname === "/owner"
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

      {/* ============================================================ */}
      {/* 5. YEAR SELECTION SHEET                                      */}
      {/* ============================================================ */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setErrorMessage("");
        }}
        title="Select Academic Year"
        description="Choose the academic year to view classes, fees, and salaries."
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
                  className={`min-h-[44px] flex items-center justify-between px-3.5 py-2.5 text-sm select-none transition-colors ${
                    isCurrent
                      ? "bg-[#E6F0EC] text-[#1F5C4D] font-semibold"
                      : "bg-[#FFFFFF] text-[#1C1F23] hover:bg-[#FAF9F6]"
                  }`}
                >
                  <span className="tabular-nums">Year {yearItem.name}</span>
                  {isCurrent && (
                    <Check className="w-4 h-4 text-[#1F5C4D]" strokeWidth={2} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Create New Year Form */}
          <form onSubmit={handleCreateYear} className="flex flex-col gap-2 pt-2 border-t border-[#E4E1DA]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5F6670]">
              Add Academic Year
            </span>
            <div className="flex gap-2">
              <Input
                id="new-academic-year"
                type="text"
                placeholder="e.g. 2027"
                maxLength={4}
                value={newYearInput}
                onChange={(e) => setNewYearInput(e.target.value)}
                disabled={isCreating}
              />
              <Button
                type="submit"
                variant="secondary"
                loading={isCreating}
                disabled={isCreating || !newYearInput.trim()}
              >
                <Plus className="w-4 h-4 mr-1" strokeWidth={1.75} />
                Add
              </Button>
            </div>
          </form>
        </div>
      </BottomSheet>

      {/* First-time Setup Dialog */}
      <BottomSheet
        open={firstTimeModal}
        onClose={() => {}}
        title="First-Time Setup: Academic Year"
        description="Welcome to Tutorial College Manager. Please create your first academic year to begin."
      >
        <form onSubmit={handleCreateYear} className="flex flex-col gap-4 py-2">
          {errorMessage && <Toast message={errorMessage} variant="danger" />}

          <Field id="initial-year" label="Academic Year" required hint="Enter the current 4-digit academic year">
            <Input
              type="text"
              defaultValue="2026"
              maxLength={4}
              value={newYearInput || "2026"}
              onChange={(e) => setNewYearInput(e.target.value)}
              disabled={isCreating}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={isCreating}
            disabled={isCreating}
          >
            Create Academic Year
          </Button>
        </form>
      </BottomSheet>
    </div>
  );
}
