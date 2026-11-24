"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  maxWidth?: "md" | "5xl" | "full";
}

export function OwnerShell({
  children,
  pageTitle = "Owner Portal",
  hasNotifications = false,
  maxWidth = "md",
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
            // First time setup: no years exist yet
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

  const navItems = [
    { label: "Home", href: "/owner", icon: Home },
    { label: "Classes", href: "/owner/classes", icon: BookOpen },
    { label: "Fees", href: "/owner/fees", icon: CreditCard },
    { label: "Salary", href: "/owner/salary", icon: Banknote },
    { label: "More", href: "/owner/more", icon: Menu },
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
          {/* Header Year Selector */}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="min-h-[44px] px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#1C1F23] bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px] hover:bg-[#F2EFE9] transition-colors"
            aria-label={`Academic year ${selectedYear}. Click to change.`}
          >
            <span className="tabular-nums font-semibold">{selectedYear}</span>
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
        </div>
      </header>

      {/* Main Content Area */}
      <main
        className={`flex-1 w-full mx-auto p-4 pb-24 ${
          maxWidth === "5xl"
            ? "max-w-md md:max-w-5xl"
            : maxWidth === "full"
            ? "max-w-full"
            : "max-w-md"
        }`}
      >
        {children}
      </main>

      {/* Bottom Bar Navigation */}
      <nav
        aria-label="Owner navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF] border-t border-[#E4E1DA]"
      >
        <div className="max-w-md mx-auto flex items-center justify-around px-1 py-1">
          {navItems.map((item) => {
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

      {/* Year Selection Sheet */}
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
