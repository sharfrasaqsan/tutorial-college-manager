"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Banknote,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Building2,
  Calendar,
  CreditCard,
  UserCheck,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { MoneyText } from "@/components/ui/MoneyText";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { formatLKR } from "@/lib/money";
import type { ClassSalaryRecord, Invoice, SalaryStatus } from "@/types";

interface TeacherGroup {
  teacherId: string;
  teacherName: string;
  teacherEmail?: string;
  teacherPhone?: string;
  classes: ClassSalaryRecord[];
  totalReadyAmount: number;
  totalPaidAmount: number;
  totalOnHoldAmount: number;
  totalAmount: number;
  readyClassesCount: number;
  onHoldClassesCount: number;
  paidClassesCount: number;
  canPay: boolean;
}

interface OwnerSalaryClientViewProps {
  initialYearId: string;
}

export function OwnerSalaryClientView({ initialYearId }: OwnerSalaryClientViewProps) {
  // Navigation Tabs: "teachers" (overview & pay) | "invoices" (history & pdf download)
  const [activeTab, setActiveTab] = useState<"teachers" | "invoices">("teachers");

  // Selected Month (YYYY-MM)
  const currentMonthStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr());

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "onHold" | "paid">("all");

  // Data states
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [teachers, setTeachers] = useState<TeacherGroup[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Pay Teacher Bottom Sheet State
  const [payingTeacher, setPayingTeacher] = useState<TeacherGroup | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [depositDate, setDepositDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "cash" | "cheque">("bank");
  const [submittingPay, setSubmittingPay] = useState<boolean>(false);

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

  // Fetch salaries data
  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);
      setErrorMsg(null);

      try {
        const res = await fetch(
          `/api/owner/salaries?yearId=${initialYearId}&month=${selectedMonth}`
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load salaries.");
        }

        setTeachers(data.teachers || []);
        setInvoices(data.invoices || []);
      } catch (err: any) {
        console.error("Fetch salaries error:", err);
        setErrorMsg(err.message || "Failed to load salary records.");
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

  // Toast helper
  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Open Pay Modal
  const openPayModal = (teacher: TeacherGroup) => {
    setPayingTeacher(teacher);
    // Pre-tick ready classes
    const readyIds = teacher.classes
      .filter((c) => c.status === "ready" && !c.isPaid)
      .map((c) => c.classId);
    setSelectedClassIds(readyIds);
    setDepositDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("bank");
  };

  const toggleClassSelection = (classId: string) => {
    if (selectedClassIds.includes(classId)) {
      setSelectedClassIds(selectedClassIds.filter((id) => id !== classId));
    } else {
      setSelectedClassIds([...selectedClassIds, classId]);
    }
  };

  // Submit Payment
  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingTeacher) return;
    if (selectedClassIds.length === 0) {
      showToast("Please select at least one ready class to pay.", "error");
      return;
    }

    setSubmittingPay(true);
    try {
      const res = await fetch("/api/owner/salaries/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: payingTeacher.teacherId,
          month: selectedMonth,
          classIds: selectedClassIds,
          depositDate,
          paymentMethod,
          yearId: initialYearId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process payment.");
      }

      showToast(`Payment processed! Invoice ${data.invoice?.invoiceNo} generated.`, "success");
      setPayingTeacher(null);
      await fetchData(true);
    } catch (err: any) {
      showToast(err.message || "Payment processing failed.", "error");
    } finally {
      setSubmittingPay(false);
    }
  };

  // Overall calculations
  const totalReadyAcrossAll = teachers.reduce((sum, t) => sum + t.totalReadyAmount, 0);
  const totalPaidAcrossAll = teachers.reduce((sum, t) => sum + t.totalPaidAmount, 0);
  const totalOnHoldAcrossAll = teachers.reduce((sum, t) => sum + t.totalOnHoldAmount, 0);
  const totalTeachersCount = teachers.length;

  // Filtered teachers
  const filteredTeachers = teachers.filter((t) => {
    const matchesQuery =
      searchQuery === "" ||
      t.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.classes.some((c) => c.className.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesQuery) return false;

    if (statusFilter === "ready") return t.readyClassesCount > 0;
    if (statusFilter === "onHold") return t.onHoldClassesCount > 0;
    if (statusFilter === "paid") return t.paidClassesCount > 0;
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-[6px] border text-sm font-medium shadow-sm transition-all ${
            toastMsg.type === "success"
              ? "bg-[#E6F0EC] text-[#1F5C4D] border-[#C2DDD4]"
              : "bg-[#FBE9E7] text-[#A32A2A] border-[#F5C7C3]"
          }`}
        >
          {toastMsg.text}
        </div>
      )}

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

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Sync & Recalc</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
          <div className="text-xs font-medium text-[#5F6670] uppercase tracking-wider mb-1">
            Ready to Pay
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#1F5C4D]">
            {formatLKR(totalReadyAcrossAll)}
          </div>
          <div className="text-xs text-[#5F6670] mt-1">
            Classes meeting session targets
          </div>
        </div>

        <div className="p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
          <div className="text-xs font-medium text-[#5F6670] uppercase tracking-wider mb-1">
            Paid Payouts
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#1C1F23]">
            {formatLKR(totalPaidAcrossAll)}
          </div>
          <div className="text-xs text-[#5F6670] mt-1">
            Deposited for {formatMonthDisplay(selectedMonth)}
          </div>
        </div>

        <div className="p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
          <div className="text-xs font-medium text-[#5F6670] uppercase tracking-wider mb-1">
            On Hold
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#9A5B00]">
            {formatLKR(totalOnHoldAcrossAll)}
          </div>
          <div className="text-xs text-[#5F6670] mt-1">
            Target sessions pending
          </div>
        </div>

        <div className="p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
          <div className="text-xs font-medium text-[#5F6670] uppercase tracking-wider mb-1">
            Active Teachers
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#1C1F23]">
            {totalTeachersCount}
          </div>
          <div className="text-xs text-[#5F6670] mt-1">
            Assigned in {initialYearId}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#E4E1DA] gap-6">
        <button
          type="button"
          onClick={() => setActiveTab("teachers")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 ${
            activeTab === "teachers"
              ? "border-[#1F5C4D] text-[#1F5C4D]"
              : "border-transparent text-[#5F6670] hover:text-[#1C1F23]"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Teachers & Classes ({teachers.length})</span>
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
          <span>Paid Invoices ({invoices.length})</span>
        </button>
      </div>

      {/* TAB 1: Teachers & Classes */}
      {activeTab === "teachers" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#5F6670]" />
              <Input
                placeholder="Search by teacher name or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="w-full sm:w-48">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                aria-label="Filter status"
              >
                <option value="all">All Statuses</option>
                <option value="ready">Has Ready Classes</option>
                <option value="onHold">Has On Hold Classes</option>
                <option value="paid">Has Paid Classes</option>
              </Select>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-4 bg-[#FBE9E7] border border-[#F5C7C3] rounded-[6px] text-sm text-[#A32A2A] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredTeachers.length === 0 && (
            <EmptyState
              title="No teacher records found"
              description={`No classes or salary calculations found for ${formatMonthDisplay(selectedMonth)}.`}
              icon={<Banknote className="w-8 h-8" strokeWidth={1.75} />}
            />
          )}

          {/* Teachers Cards List */}
          {!loading &&
            filteredTeachers.map((teacher) => (
              <div
                key={teacher.teacherId}
                className="bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] overflow-hidden"
              >
                {/* Teacher Header Bar */}
                <div className="p-4 bg-[#FAF9F6] border-b border-[#E4E1DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-base text-[#1C1F23]">
                      {teacher.teacherName}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-[#5F6670] mt-0.5">
                      {teacher.teacherPhone && <span>{teacher.teacherPhone}</span>}
                      {teacher.teacherEmail && <span>{teacher.teacherEmail}</span>}
                      <span>• {teacher.classes.length} class(es)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-[#5F6670]">Ready to Pay</div>
                      <div className="font-bold text-base text-[#1F5C4D]">
                        {formatLKR(teacher.totalReadyAmount)}
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!teacher.canPay}
                      onClick={() => openPayModal(teacher)}
                      className="whitespace-nowrap"
                    >
                      Pay Teacher
                    </Button>
                  </div>
                </div>

                {/* Teacher's Classes List */}
                <div className="divide-y divide-[#E4E1DA]">
                  {teacher.classes.map((cls) => {
                    const progressPercent = Math.min(
                      100,
                      Math.round((cls.heldSessions / (cls.requiredSessions || 1)) * 100)
                    );

                    return (
                      <div
                        key={cls.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F6]/50 transition-colors"
                      >
                        <div className="space-y-1 sm:max-w-md">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-[#1C1F23]">
                              {cls.className}
                            </span>
                            <StatusChip status={cls.status} />
                          </div>

                          {/* Sessions Progress */}
                          <div className="flex items-center gap-3 text-xs text-[#5F6670]">
                            <span className="font-medium text-[#1C1F23]">
                              {cls.heldSessions} of {cls.requiredSessions} sessions
                            </span>
                            <span>•</span>
                            <span>{cls.studentCount} enrolled student(s)</span>
                          </div>

                          {/* Mini Progress Bar */}
                          <div className="w-48 h-1.5 bg-[#E4E1DA] rounded-full overflow-hidden mt-1">
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

                        {/* Amount & Invoice info */}
                        <div className="flex items-center justify-between sm:justify-end gap-4 text-right">
                          <div>
                            <div className="font-bold text-sm text-[#1C1F23]">
                              {formatLKR(cls.amount)}
                            </div>
                            <div className="text-xs text-[#5F6670]">
                              Teacher share
                            </div>
                          </div>

                          {cls.isPaid && cls.invoiceNo && (
                            <a
                              href={`/api/salaries/invoice/${cls.invoiceNo}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F5C4D] bg-[#E6F0EC] px-2.5 py-1.5 rounded-[4px] hover:bg-[#C2DDD4] transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{cls.invoiceNo}</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* TAB 2: Paid Invoices History */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          {invoices.length === 0 ? (
            <EmptyState
              title="No invoices generated yet"
              description={`No teacher payouts have been recorded for ${formatMonthDisplay(selectedMonth)}.`}
              icon={<FileText className="w-8 h-8" strokeWidth={1.75} />}
            />
          ) : (
            <div className="bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] overflow-hidden divide-y divide-[#E4E1DA]">
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

                    <div className="text-sm font-semibold text-[#1C1F23]">
                      {inv.teacherName}
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
                      <div className="text-xs text-[#5F6670]">Total payout</div>
                    </div>

                    <a
                      href={`/api/salaries/invoice/${inv.invoiceNo}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FFFFFF] bg-[#1F5C4D] px-3 py-1.5 rounded-[4px] hover:bg-[#164237] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pay Teacher Bottom Sheet */}
      <BottomSheet
        open={Boolean(payingTeacher)}
        onClose={() => setPayingTeacher(null)}
        title={payingTeacher ? `Pay ${payingTeacher.teacherName}` : "Pay Teacher"}
        description={`Record salary payout and generate sequential invoice for ${formatMonthDisplay(selectedMonth)}.`}
      >
        {payingTeacher && (
          <form onSubmit={handlePaySubmit} className="space-y-4 pt-2">
            {/* Ready Classes Selection List */}
            <div>
              <label className="block text-xs font-semibold text-[#1C1F23] uppercase tracking-wider mb-2">
                Select Ready Classes to Pay
              </label>

              <div className="border border-[#E4E1DA] rounded-[6px] divide-y divide-[#E4E1DA] max-h-56 overflow-y-auto">
                {payingTeacher.classes
                  .filter((c) => !c.isPaid)
                  .map((cls) => {
                    const isReady = cls.status === "ready";
                    const isChecked = selectedClassIds.includes(cls.classId);

                    return (
                      <div
                        key={cls.classId}
                        onClick={() => isReady && toggleClassSelection(cls.classId)}
                        className={`p-3 flex items-center justify-between gap-3 select-none ${
                          isReady
                            ? "cursor-pointer hover:bg-[#FAF9F6]"
                            : "bg-[#F3F2EE]/60 opacity-60 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isReady ? (
                            isChecked ? (
                              <CheckSquare className="w-5 h-5 text-[#1F5C4D]" />
                            ) : (
                              <Square className="w-5 h-5 text-[#5F6670]" />
                            )
                          ) : (
                            <Clock className="w-5 h-5 text-[#9A5B00]" />
                          )}

                          <div>
                            <div className="font-semibold text-sm text-[#1C1F23]">
                              {cls.className}
                            </div>
                            <div className="text-xs text-[#5F6670]">
                              {cls.heldSessions} of {cls.requiredSessions} sessions held • {cls.studentCount} students
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-sm text-[#1C1F23]">
                            {formatLKR(cls.amount)}
                          </div>
                          <StatusChip status={cls.status} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Total Calculated Payout */}
            <div className="p-3 bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px] flex items-center justify-between">
              <span className="font-semibold text-sm text-[#5F6670]">
                Invoice Total Amount ({selectedClassIds.length} classes):
              </span>
              <span className="font-bold text-lg text-[#1F5C4D]">
                {formatLKR(
                  payingTeacher.classes
                    .filter((c) => selectedClassIds.includes(c.classId))
                    .reduce((sum, c) => sum + c.amount, 0)
                )}
              </span>
            </div>

            {/* Deposit Date */}
            <div>
              <label className="block text-xs font-semibold text-[#1C1F23] mb-1">
                Deposit Date <span className="text-[#A32A2A]">*</span>
              </label>
              <Input
                type="date"
                required
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-semibold text-[#1C1F23] mb-1">
                Payment Method <span className="text-[#A32A2A]">*</span>
              </label>
              <Select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
              >
                <option value="bank">Bank Transfer / Direct Deposit</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setPayingTeacher(null)}
                disabled={submittingPay}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                className="flex-1"
                disabled={submittingPay || selectedClassIds.length === 0}
              >
                {submittingPay ? "Processing..." : "Generate Invoice & Pay"}
              </Button>
            </div>
          </form>
        )}
      </BottomSheet>
    </div>
  );
}
