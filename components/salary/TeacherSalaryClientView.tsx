"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Calendar,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatLKR } from "@/lib/money";
import type { ClassSalaryRecord, Invoice } from "@/types";

interface TeacherSalaryClientViewProps {
  initialYearId: string;
}

export function TeacherSalaryClientView({ initialYearId }: TeacherSalaryClientViewProps) {
  // Navigation Tabs: "classes" (my classes progress) | "invoices" (my paid invoices)
  const [activeTab, setActiveTab] = useState<"classes" | "invoices">("classes");

  // Selected Month (YYYY-MM)
  const currentMonthStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr());

  // Data states
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [classes, setClasses] = useState<ClassSalaryRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [totals, setTotals] = useState({
    totalAmount: 0,
    totalReady: 0,
    totalPaid: 0,
    totalOnHold: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m - 2, 1);
    setSelectedMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const date = new Date(y, m, 1);
    setSelectedMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    );
  };

  const formatMonthDisplay = (monthStr: string) => {
    try {
      const [y, m] = monthStr.split("-").map(Number);
      const d = new Date(y, m - 1, 1);
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return monthStr;
    }
  };

  // Fetch teacher salary data
  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);
      setErrorMsg(null);

      try {
        const res = await fetch(
          `/api/teacher/salaries?yearId=${initialYearId}&month=${selectedMonth}`
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load salary progress.");
        }

        setClasses(data.classes || []);
        setInvoices(data.invoices || []);
        if (data.totals) setTotals(data.totals);
      } catch (err: any) {
        console.error("Fetch teacher salary error:", err);
        setErrorMsg(err.message || "Failed to load salary details.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [initialYearId, selectedMonth]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6 pb-12">
      {/* Month Navigator Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            className="h-9 w-9 p-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#5F6670]" />
            <span className="font-semibold text-base text-[#1C1F23]">
              {formatMonthDisplay(selectedMonth)}
            </span>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleNextMonth}
            aria-label="Next month"
            className="h-9 w-9 p-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
          <div className="text-xs font-medium text-[#5F6670] uppercase tracking-wider mb-1">
            Ready for Payout
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#1F5C4D]">
            {formatLKR(totals.totalReady)}
          </div>
          <div className="text-xs text-[#5F6670] mt-1">
            Target sessions completed
          </div>
        </div>

        <div className="p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
          <div className="text-xs font-medium text-[#5F6670] uppercase tracking-wider mb-1">
            Paid Payouts
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#1C1F23]">
            {formatLKR(totals.totalPaid)}
          </div>
          <div className="text-xs text-[#5F6670] mt-1">
            Deposited into account
          </div>
        </div>

        <div className="p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
          <div className="text-xs font-medium text-[#5F6670] uppercase tracking-wider mb-1">
            On Hold
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#9A5B00]">
            {formatLKR(totals.totalOnHold)}
          </div>
          <div className="text-xs text-[#5F6670] mt-1">
            Pending target completion
          </div>
        </div>

        <div className="p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
          <div className="text-xs font-medium text-[#5F6670] uppercase tracking-wider mb-1">
            Total Expected
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#1C1F23]">
            {formatLKR(totals.totalAmount)}
          </div>
          <div className="text-xs text-[#5F6670] mt-1">
            Full month allocation
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#E4E1DA] gap-6">
        <button
          type="button"
          onClick={() => setActiveTab("classes")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === "classes"
              ? "border-[#1F5C4D] text-[#1F5C4D]"
              : "border-transparent text-[#5F6670] hover:text-[#1C1F23]"
          }`}
        >
          <Banknote className="w-4 h-4" />
          <span>My Classes ({classes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("invoices")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === "invoices"
              ? "border-[#1F5C4D] text-[#1F5C4D]"
              : "border-transparent text-[#5F6670] hover:text-[#1C1F23]"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Salary Invoices ({invoices.length})</span>
        </button>
      </div>

      {/* TAB 1: My Classes */}
      {activeTab === "classes" && (
        <div className="space-y-4">
          {errorMsg && (
            <div className="p-4 bg-[#FBE9E7] border border-[#F5C7C3] rounded-[6px] text-sm text-[#A32A2A] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          )}

          {!loading && classes.length === 0 && (
            <EmptyState
              title="No classes assigned"
              description={`No classes are assigned to you for ${formatMonthDisplay(selectedMonth)}.`}
              icon={<Banknote className="w-8 h-8" strokeWidth={1.75} />}
            />
          )}

          {!loading &&
            classes.map((cls) => {
              const progressPercent = Math.min(
                100,
                Math.round((cls.heldSessions / (cls.requiredSessions || 1)) * 100)
              );

              return (
                <div
                  key={cls.id}
                  className="bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 sm:max-w-md">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-[#1C1F23]">
                        {cls.className}
                      </span>
                      <StatusChip status={cls.status} />
                    </div>

                    <div className="flex items-center gap-3 text-xs text-[#5F6670]">
                      <span className="font-medium text-[#1C1F23]">
                        {cls.heldSessions} of {cls.requiredSessions} sessions held
                      </span>
                      <span>•</span>
                      <span>{cls.studentCount} enrolled student(s)</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full sm:w-64 h-2 bg-[#E4E1DA] rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full transition-all rounded-full ${
                          cls.status === "paid"
                            ? "bg-[#1F5C4D]"
                            : cls.status === "ready"
                            ? "bg-[#1F5C4D]"
                            : "bg-[#9A5B00]"
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                    <div className="text-right">
                      <div className="font-bold text-lg text-[#1F5C4D]">
                        {formatLKR(cls.amount)}
                      </div>
                      <div className="text-xs text-[#5F6670]">
                        Your share for {cls.month}
                      </div>
                    </div>

                    {cls.isPaid && cls.invoiceNo && (
                      <a
                        href={`/api/salaries/invoice/${cls.invoiceNo}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F5C4D] bg-[#E6F0EC] px-3 py-1.5 rounded-[4px] hover:bg-[#C2DDD4] transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Receipt ({cls.invoiceNo})</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* TAB 2: Salary Invoices */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          {invoices.length === 0 ? (
            <EmptyState
              title="No paid invoices yet"
              description="Invoices will appear here once the college owner processes salary deposits."
              icon={<FileText className="w-8 h-8" strokeWidth={1.75} />}
            />
          ) : (
            <div className="bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] divide-y divide-[#E4E1DA] overflow-hidden">
              {invoices.map((inv) => (
                <div
                  key={inv.invoiceNo}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#FAF9F6]/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#1F5C4D]">
                        {inv.invoiceNo}
                      </span>
                      <StatusChip status="paid" label="Deposited" />
                    </div>

                    <div className="text-xs text-[#5F6670] flex flex-wrap gap-2">
                      <span>Month: {inv.month}</span>
                      <span>•</span>
                      <span>Deposit Date: {inv.depositDate || "N/A"}</span>
                      <span>•</span>
                      <span className="capitalize">Method: {inv.paymentMethod || "bank"}</span>
                    </div>

                    <div className="text-xs text-[#5F6670] pt-1">
                      Classes:{" "}
                      {inv.classes.map((c) => `${c.className} (${c.sessionsHeld} sessions)`).join(", ")}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2">
                    <div className="text-right">
                      <div className="font-bold text-base text-[#1C1F23]">
                        {formatLKR(inv.totalAmount)}
                      </div>
                      <div className="text-xs text-[#5F6670]">Total deposited</div>
                    </div>

                    <a
                      href={`/api/salaries/invoice/${inv.invoiceNo}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FFFFFF] bg-[#1F5C4D] px-3 py-1.5 rounded-[4px] hover:bg-[#164237] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Invoice PDF</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
