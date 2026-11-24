"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  CreditCard,
  AlertTriangle,
  Banknote,
  PieChart,
  Phone,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatLKR } from "@/lib/money";
import type {
  StudentPaymentsReportData,
  PendingFeesReportData,
  TeacherSalaryReportData,
  MonthSummaryReportData,
} from "@/lib/reports";

interface ReportsClientViewProps {
  initialYearId: string;
}

type ReportType = "month-summary" | "student-payments" | "pending-fees" | "teacher-salary";

export function ReportsClientView({ initialYearId }: ReportsClientViewProps) {
  const [activeTab, setActiveTab] = useState<ReportType>("month-summary");

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Individual reports data
  const [monthSummary, setMonthSummary] = useState<MonthSummaryReportData | null>(null);
  const [studentPayments, setStudentPayments] = useState<StudentPaymentsReportData | null>(null);
  const [pendingFees, setPendingFees] = useState<PendingFeesReportData | null>(null);
  const [teacherSalary, setTeacherSalary] = useState<TeacherSalaryReportData | null>(null);

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

  // Fetch report data
  const fetchData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);
      setErrorMsg(null);

      try {
        const res = await fetch(
          `/api/owner/reports/data?yearId=${initialYearId}&month=${selectedMonth}&type=all`
        );
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to load report data.");
        }

        const data = json.data;
        setMonthSummary(data.monthSummary);
        setStudentPayments(data.studentPayments);
        setPendingFees(data.pendingFees);
        setTeacherSalary(data.teacherSalary);
      } catch (err: any) {
        console.error("Fetch report error:", err);
        setErrorMsg(err.message || "Failed to load report data.");
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

  const pdfDownloadUrl = `/api/owner/reports/pdf?type=${activeTab}&month=${selectedMonth}&yearId=${initialYearId}`;

  return (
    <div className="space-y-6 pb-12">
      {/* Month Navigator Header & PDF Download Action */}
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

        <div className="flex items-center gap-2.5">
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

          <a
            href={pdfDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 text-xs font-semibold text-[#FFFFFF] bg-[#1F5C4D] rounded-[6px] hover:bg-[#164237] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </a>
        </div>
      </div>

      {/* Tabs for the 4 Reports (Mobile & Tablet) */}
      <div className="flex lg:hidden border-b border-[#E4E1DA] gap-2 sm:gap-6 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("month-summary")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
            activeTab === "month-summary"
              ? "border-[#1F5C4D] text-[#1F5C4D]"
              : "border-transparent text-[#5F6670] hover:text-[#1C1F23]"
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span>Month Summary</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("student-payments")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
            activeTab === "student-payments"
              ? "border-[#1F5C4D] text-[#1F5C4D]"
              : "border-transparent text-[#5F6670] hover:text-[#1C1F23]"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Student Payments</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("pending-fees")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
            activeTab === "pending-fees"
              ? "border-[#1F5C4D] text-[#1F5C4D]"
              : "border-transparent text-[#5F6670] hover:text-[#1C1F23]"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Pending Fees</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("teacher-salary")}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-2 whitespace-nowrap ${
            activeTab === "teacher-salary"
              ? "border-[#1F5C4D] text-[#1F5C4D]"
              : "border-transparent text-[#5F6670] hover:text-[#1C1F23]"
          }`}
        >
          <Banknote className="w-4 h-4" />
          <span>Teacher Salary</span>
        </button>
      </div>

      {/* Main Grid: At lg, two columns (Left: 4 Report Types List, Right: Active Report Preview with Download buttons) */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-6 items-start">
        {/* Left Column: Vertical Report Types List on Desktop */}
        <div className="hidden lg:block lg:col-span-4 xl:col-span-3 space-y-2.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#5F6670] px-1 mb-1">
            Report Types
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setActiveTab("month-summary")}
              className={`w-full text-left p-3.5 rounded-[6px] border transition-all flex items-start gap-3 ${
                activeTab === "month-summary"
                  ? "border-[#1F5C4D] ring-1 ring-[#1F5C4D] bg-[#E6F0EC]/20 text-[#1F5C4D]"
                  : "border-[#E4E1DA] bg-[#FFFFFF] hover:border-[#1F5C4D]/60 hover:bg-[#FAF9F6] text-[#1C1F23]"
              }`}
            >
              <div className={`p-2 rounded-[4px] mt-0.5 ${activeTab === "month-summary" ? "bg-[#1F5C4D] text-[#FFFFFF]" : "bg-[#FAF9F6] text-[#5F6670]"}`}>
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm leading-tight">Month Summary</div>
                <div className="text-xs text-[#5F6670] mt-1 leading-snug">Income, expenditures & margin</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("student-payments")}
              className={`w-full text-left p-3.5 rounded-[6px] border transition-all flex items-start gap-3 ${
                activeTab === "student-payments"
                  ? "border-[#1F5C4D] ring-1 ring-[#1F5C4D] bg-[#E6F0EC]/20 text-[#1F5C4D]"
                  : "border-[#E4E1DA] bg-[#FFFFFF] hover:border-[#1F5C4D]/60 hover:bg-[#FAF9F6] text-[#1C1F23]"
              }`}
            >
              <div className={`p-2 rounded-[4px] mt-0.5 ${activeTab === "student-payments" ? "bg-[#1F5C4D] text-[#FFFFFF]" : "bg-[#FAF9F6] text-[#5F6670]"}`}>
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm leading-tight">Student Payments</div>
                <div className="text-xs text-[#5F6670] mt-1 leading-snug">Tuition and fee receipts by grade</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("pending-fees")}
              className={`w-full text-left p-3.5 rounded-[6px] border transition-all flex items-start gap-3 ${
                activeTab === "pending-fees"
                  ? "border-[#1F5C4D] ring-1 ring-[#1F5C4D] bg-[#E6F0EC]/20 text-[#1F5C4D]"
                  : "border-[#E4E1DA] bg-[#FFFFFF] hover:border-[#1F5C4D]/60 hover:bg-[#FAF9F6] text-[#1C1F23]"
              }`}
            >
              <div className={`p-2 rounded-[4px] mt-0.5 ${activeTab === "pending-fees" ? "bg-[#1F5C4D] text-[#FFFFFF]" : "bg-[#FAF9F6] text-[#5F6670]"}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm leading-tight">Pending Fees</div>
                <div className="text-xs text-[#5F6670] mt-1 leading-snug">Overdue tuition and admission fees</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("teacher-salary")}
              className={`w-full text-left p-3.5 rounded-[6px] border transition-all flex items-start gap-3 ${
                activeTab === "teacher-salary"
                  ? "border-[#1F5C4D] ring-1 ring-[#1F5C4D] bg-[#E6F0EC]/20 text-[#1F5C4D]"
                  : "border-[#E4E1DA] bg-[#FFFFFF] hover:border-[#1F5C4D]/60 hover:bg-[#FAF9F6] text-[#1C1F23]"
              }`}
            >
              <div className={`p-2 rounded-[4px] mt-0.5 ${activeTab === "teacher-salary" ? "bg-[#1F5C4D] text-[#FFFFFF]" : "bg-[#FAF9F6] text-[#5F6670]"}`}>
                <Banknote className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-sm leading-tight">Teacher Salary</div>
                <div className="text-xs text-[#5F6670] mt-1 leading-snug">Target sessions, progress & payouts</div>
              </div>
            </button>
          </div>
        </div>

        {/* Right Column on Desktop, Full Width below lg */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {/* Header on Desktop with Download Buttons */}
          <div className="hidden lg:flex bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] p-4 items-center justify-between">
            <div>
              <h2 className="font-serif font-bold text-lg text-[#1C1F23]">
                {activeTab === "month-summary" && "Month Summary Report"}
                {activeTab === "student-payments" && "Student Payments Report"}
                {activeTab === "pending-fees" && "Pending Fees & Arrears Report"}
                {activeTab === "teacher-salary" && "Teacher Salary Report"}
              </h2>
              <p className="text-xs text-[#5F6670] mt-0.5">
                Official financial ledger for {formatMonthDisplay(selectedMonth)}
              </p>
            </div>

            <a
              href={pdfDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 text-xs font-semibold text-[#FFFFFF] bg-[#1F5C4D] rounded-[6px] hover:bg-[#164237] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </a>
          </div>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {/* REPORT 1: MONTH SUMMARY */}
      {!loading && activeTab === "month-summary" && monthSummary && (
        <div className="space-y-6">
          {/* Financial KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
              <div className="text-xs font-medium text-[#5F6670] uppercase tracking-wider mb-1">
                Fees Collected
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#1F5C4D]">
                {formatLKR(monthSummary.financials.totalCollected)}
              </div>
              <div className="text-xs text-[#5F6670] mt-1">
                {monthSummary.financials.collectionRate}% of expected
              </div>
            </div>

            <div className="p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
              <div className="text-xs font-medium text-[#5F6670] uppercase tracking-wider mb-1">
                Fees Pending
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#A32A2A]">
                {formatLKR(monthSummary.financials.totalUnpaid)}
              </div>
              <div className="text-xs text-[#5F6670] mt-1">
                Unpaid tuition for {formatMonthDisplay(selectedMonth)}
              </div>
            </div>

            <div className="p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
              <div className="text-xs font-medium text-[#5F6670] uppercase tracking-wider mb-1">
                Teacher Share
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#1C1F23]">
                {formatLKR(monthSummary.financials.totalTeacherShare)}
              </div>
              <div className="text-xs text-[#5F6670] mt-1">
                Paid: {formatLKR(monthSummary.financials.totalSalaryPaid)}
              </div>
            </div>

            <div className="p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
              <div className="text-xs font-medium text-[#5F6670] uppercase tracking-wider mb-1">
                Owner Share
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#1F5C4D]">
                {formatLKR(monthSummary.financials.ownerShare)}
              </div>
              <div className="text-xs text-[#5F6670] mt-1">
                Collected fees minus teacher share
              </div>
            </div>
          </div>

          {/* Academic Operations & Sessions Performance Table */}
          <div className="bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] overflow-hidden">
            <div className="p-4 border-b border-[#E4E1DA] bg-[#FAF9F6]">
              <h3 className="font-bold text-sm text-[#1C1F23]">
                Class Operations &amp; Sessions Held ({monthSummary.classesPerformance.length} classes)
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E4E1DA] bg-[#FAF9F6] text-[#5F6670] uppercase font-bold text-[10px]">
                    <th className="p-3">Class</th>
                    <th className="p-3">Teacher</th>
                    <th className="p-3 text-center">Students</th>
                    <th className="p-3 text-center">Sessions Held</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Tuition Expected</th>
                    <th className="p-3 text-right">Teacher Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E1DA]">
                  {monthSummary.classesPerformance.map((c) => (
                    <tr key={c.classId} className="hover:bg-[#FAF9F6]/50">
                      <td className="p-3 font-semibold text-[#1C1F23]">{c.className}</td>
                      <td className="p-3 text-[#5F6670]">{c.teacherName}</td>
                      <td className="p-3 text-center tabular-nums">{c.studentCount}</td>
                      <td className="p-3 text-center tabular-nums font-medium">
                        {c.heldSessions} of {c.requiredSessions} ({c.completionRate}%)
                      </td>
                      <td className="p-3 text-center">
                        <StatusChip status={c.salaryStatus} />
                      </td>
                      <td className="p-3 text-right tabular-nums">{formatLKR(c.totalFeesExpected)}</td>
                      <td className="p-3 text-right tabular-nums font-semibold text-[#1F5C4D]">
                        {formatLKR(c.totalTeacherShare)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 2: STUDENT PAYMENTS */}
      {!loading && activeTab === "student-payments" && studentPayments && (
        <div className="space-y-4">
          {/* Header Summary */}
          <div className="p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] flex items-center justify-between">
            <div>
              <div className="text-xs text-[#5F6670]">Total Payments Received</div>
              <div className="font-bold text-lg text-[#1C1F23]">
                {studentPayments.totalPaidCount} students paid
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#5F6670]">Total Collected</div>
              <div className="font-bold text-xl text-[#1F5C4D]">
                {formatLKR(studentPayments.totalCollected)}
              </div>
            </div>
          </div>

          {studentPayments.classes.length === 0 ? (
            <EmptyState
              title="No payments recorded"
              description={`No student payments have been recorded for ${formatMonthDisplay(selectedMonth)}.`}
              icon={<CreditCard className="w-8 h-8" strokeWidth={1.75} />}
            />
          ) : (
            studentPayments.classes.map((cls) => (
              <div
                key={cls.classId}
                className="bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] overflow-hidden"
              >
                <div className="p-3 bg-[#FAF9F6] border-b border-[#E4E1DA] flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-sm text-[#1C1F23] mr-2">{cls.className}</span>
                    <span className="text-[#5F6670]">({cls.paidCount} paid)</span>
                  </div>
                  <div className="font-bold text-[#1F5C4D] text-sm">
                    {formatLKR(cls.totalAmount)}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E4E1DA] bg-[#FAF9F6] text-[#5F6670] uppercase font-bold text-[10px]">
                        <th className="p-3">Student Name</th>
                        <th className="p-3">Receipt #</th>
                        <th className="p-3">Method</th>
                        <th className="p-3">Date</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E1DA]">
                      {cls.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-[#FAF9F6]/50">
                          <td className="p-3 font-semibold text-[#1C1F23]">{p.studentName}</td>
                          <td className="p-3 font-mono text-[#5F6670]">{p.receiptNo}</td>
                          <td className="p-3 uppercase text-[11px]">{p.paymentMethod}</td>
                          <td className="p-3 text-[#5F6670]">{p.paidAt.slice(0, 10)}</td>
                          <td className="p-3 text-right font-bold text-[#1C1F23] tabular-nums">
                            {formatLKR(p.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* REPORT 3: PENDING FEES */}
      {!loading && activeTab === "pending-fees" && pendingFees && (
        <div className="space-y-4">
          {/* Header Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
              <div className="text-[11px] text-[#5F6670]">Students in Arrears</div>
              <div className="font-bold text-base text-[#1C1F23]">
                {pendingFees.totalStudentsPending}
              </div>
            </div>
            <div className="p-3 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
              <div className="text-[11px] text-[#5F6670]">Tuition Pending</div>
              <div className="font-bold text-base text-[#1C1F23]">
                {formatLKR(pendingFees.totalTuitionUnpaid)}
              </div>
            </div>
            <div className="p-3 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
              <div className="text-[11px] text-[#5F6670]">Admission Pending</div>
              <div className="font-bold text-base text-[#1C1F23]">
                {formatLKR(pendingFees.totalAdmissionUnpaid)}
              </div>
            </div>
            <div className="p-3 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
              <div className="text-[11px] text-[#5F6670]">Total Outstanding</div>
              <div className="font-bold text-base text-[#A32A2A]">
                {formatLKR(pendingFees.grandTotalPending)}
              </div>
            </div>
          </div>

          {pendingFees.students.length === 0 ? (
            <EmptyState
              title="No pending fees"
              description={`All students are fully settled for ${formatMonthDisplay(selectedMonth)}.`}
              icon={<CheckCircle2 className="w-8 h-8 text-[#1F5C4D]" strokeWidth={1.75} />}
            />
          ) : (
            <div className="bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E4E1DA] bg-[#FAF9F6] text-[#5F6670] uppercase font-bold text-[10px]">
                      <th className="p-3">Student</th>
                      <th className="p-3">Grade</th>
                      <th className="p-3">Guardian &amp; Phone</th>
                      <th className="p-3">Unpaid Classes</th>
                      <th className="p-3 text-right">Admission</th>
                      <th className="p-3 text-right">Total Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E1DA]">
                    {pendingFees.students.map((s) => (
                      <tr key={s.studentId} className="hover:bg-[#FAF9F6]/50">
                        <td className="p-3 font-semibold text-[#1C1F23]">{s.studentName}</td>
                        <td className="p-3 text-[#5F6670]">{s.grade}</td>
                        <td className="p-3">
                          <div className="font-medium text-[#1C1F23]">{s.guardianName}</div>
                          <a
                            href={`tel:${s.guardianPhone}`}
                            className="text-[#1F5C4D] hover:underline flex items-center gap-1 font-mono text-[11px] mt-0.5"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{s.guardianPhone}</span>
                          </a>
                        </td>
                        <td className="p-3 text-[#5F6670] text-[11px]">
                          {s.classesPending.map((c) => c.className).join(", ") || "Admission Only"}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {s.admissionFeePending > 0 ? formatLKR(s.admissionFeePending) : "-"}
                        </td>
                        <td className="p-3 text-right font-bold text-[#A32A2A] tabular-nums">
                          {formatLKR(s.totalPending)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REPORT 4: TEACHER SALARY */}
      {!loading && activeTab === "teacher-salary" && teacherSalary && (
        <div className="space-y-4">
          {/* Header Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
              <div className="text-[11px] text-[#5F6670]">Total Salary</div>
              <div className="font-bold text-base text-[#1C1F23]">
                {formatLKR(teacherSalary.grandTotalSalary)}
              </div>
            </div>
            <div className="p-3 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
              <div className="text-[11px] text-[#5F6670]">Ready to Pay</div>
              <div className="font-bold text-base text-[#1F5C4D]">
                {formatLKR(teacherSalary.totalReadyAmount)}
              </div>
            </div>
            <div className="p-3 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
              <div className="text-[11px] text-[#5F6670]">Paid Payouts</div>
              <div className="font-bold text-base text-[#1C1F23]">
                {formatLKR(teacherSalary.totalPaidAmount)}
              </div>
            </div>
            <div className="p-3 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
              <div className="text-[11px] text-[#5F6670]">On Hold</div>
              <div className="font-bold text-base text-[#9A5B00]">
                {formatLKR(teacherSalary.totalOnHoldAmount)}
              </div>
            </div>
          </div>

          {teacherSalary.teachers.length === 0 ? (
            <EmptyState
              title="No salary records"
              description={`No teacher classes or salary records for ${formatMonthDisplay(selectedMonth)}.`}
              icon={<Banknote className="w-8 h-8" strokeWidth={1.75} />}
            />
          ) : (
            teacherSalary.teachers.map((t) => (
              <div
                key={t.teacherId}
                className="bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] overflow-hidden"
              >
                <div className="p-3 bg-[#FAF9F6] border-b border-[#E4E1DA] flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-sm text-[#1C1F23] mr-2">{t.teacherName}</span>
                    <span className="text-[#5F6670]">({t.classes.length} class(es))</span>
                  </div>
                  <div className="font-bold text-[#1F5C4D] text-sm">
                    {formatLKR(t.totalAmount)}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E4E1DA] bg-[#FAF9F6] text-[#5F6670] uppercase font-bold text-[10px]">
                        <th className="p-3">Class</th>
                        <th className="p-3 text-center">Sessions Held</th>
                        <th className="p-3 text-center">Enrolled</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3">Invoice / Deposit</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4E1DA]">
                      {t.classes.map((cls) => (
                        <tr key={cls.classId} className="hover:bg-[#FAF9F6]/50">
                          <td className="p-3 font-semibold text-[#1C1F23]">{cls.className}</td>
                          <td className="p-3 text-center tabular-nums">
                            {cls.heldSessions} of {cls.requiredSessions}
                          </td>
                          <td className="p-3 text-center tabular-nums">{cls.studentCount}</td>
                          <td className="p-3 text-center">
                            <StatusChip status={cls.status} />
                          </td>
                          <td className="p-3 text-[#5F6670] font-mono text-[11px]">
                            {cls.invoiceNo ? `${cls.invoiceNo} (${cls.depositDate || "Paid"})` : "-"}
                          </td>
                          <td className="p-3 text-right font-bold text-[#1C1F23] tabular-nums">
                            {formatLKR(cls.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
