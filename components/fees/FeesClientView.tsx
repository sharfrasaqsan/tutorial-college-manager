"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CreditCard,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  Edit2,
  X,
  Phone,
  RefreshCw,
  Clock,
  ArrowRight,
  Filter,
  CheckCheck,
  Download,
  AlertTriangle,
  UserCheck,
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
import type { FeeRecord, Student, PaymentMethod, AdmissionFeeStatus } from "@/types";

interface FeesClientViewProps {
  initialYearId: string;
}

export function FeesClientView({ initialYearId }: FeesClientViewProps) {
  // Navigation Tabs
  // "grouped": Unpaid grouped by student for selected month
  // "pending": Unpaid for selected month & earlier (arrears) with tap-to-call
  // "all": Flat list of all monthly fee records (paid & unpaid)
  // "admission": Admission fees management
  const [activeTab, setActiveTab] = useState<"grouped" | "pending" | "all" | "admission">("grouped");

  // Selected Month (YYYY-MM)
  const currentMonthStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr());

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");

  // Data states
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [classesList, setClassesList] = useState<Array<{ id: string; name: string; grade: string }>>([]);
  const [gradesList, setGradesList] = useState<string[]>([]);
  const [monthlySummary, setMonthlySummary] = useState({
    totalExpected: 0,
    totalCollected: 0,
    totalUnpaid: 0,
    totalTeacherShare: 0,
    paidCount: 0,
    unpaidCount: 0,
    totalCount: 0,
  });

  // Pending view state
  const [pendingData, setPendingData] = useState<{
    pendingStudents: any[];
    unpaidAdmissionStudents: any[];
    totalPendingTuition: number;
    totalUnpaidAdmissionAmount: number;
  }>({
    pendingStudents: [],
    unpaidAdmissionStudents: [],
    totalPendingTuition: 0,
    totalUnpaidAdmissionAmount: 0,
  });
  const [loadingPending, setLoadingPending] = useState<boolean>(false);

  // Admission fees state
  const [admissionStudents, setAdmissionStudents] = useState<Array<Student & { grade?: string }>>([]);
  const [admissionSummary, setAdmissionSummary] = useState({
    paidCount: 0,
    unpaidCount: 0,
    notApplicableCount: 0,
    totalCollected: 0,
    totalCount: 0,
  });

  // BottomSheet State for a Student's Fees (Grouped View)
  const [selectedStudentSheet, setSelectedStudentSheet] = useState<{
    studentId: string;
    studentName: string;
    grade?: string;
    school?: string;
    guardianName?: string;
    guardianPhone?: string;
    fees: FeeRecord[];
  } | null>(null);

  // Payment form states inside sheet / modal
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("cash");
  const [selectedPaymentDate, setSelectedPaymentDate] = useState<string>("");
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);

  // Edit Mid-Month Joiner Fee Modal
  const [adjustFeeModal, setAdjustFeeModal] = useState<FeeRecord | null>(null);
  const [editAmount, setEditAmount] = useState<string>("");
  const [editTeacherShare, setEditTeacherShare] = useState<string>("");
  const [editNote, setEditNote] = useState<string>("");
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [submittingAdjust, setSubmittingAdjust] = useState<boolean>(false);

  // Admission Fee Modal
  const [admissionModalStudent, setAdmissionModalStudent] = useState<(Student & { grade?: string }) | null>(null);
  const [admStatus, setAdmStatus] = useState<AdmissionFeeStatus>("paid");
  const [admAmount, setAdmAmount] = useState<string>("2500");
  const [admMethod, setAdmMethod] = useState<PaymentMethod>("cash");
  const [admDate, setAdmDate] = useState<string>("");
  const [admReceiptNo, setAdmReceiptNo] = useState<string>("");
  const [submittingAdmission, setSubmittingAdmission] = useState<boolean>(false);

  // Printable Receipt Modal
  const [receiptModalNumber, setReceiptModalNumber] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [loadingReceipt, setLoadingReceipt] = useState<boolean>(false);

  // Toast / notification
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [yStr, mStr] = selectedMonth.split("-");
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) - 1;
    if (m < 1) {
      m = 12;
      y--;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, "0")}`);
  };

  const handleNextMonth = () => {
    const [yStr, mStr] = selectedMonth.split("-");
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10) + 1;
    if (m > 12) {
      m = 1;
      y++;
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, "0")}`);
  };

  const formatMonthTitle = (ym: string) => {
    const [y, m] = ym.split("-");
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // 1. Fetch monthly fees
  const fetchMonthlyFees = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const q = new URLSearchParams({
        yearId: initialYearId,
        month: selectedMonth,
      });

      const res = await fetch(`/api/owner/fees?${q.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load fee collections.");
      }

      const data = await res.json();
      setFees(data.fees || []);
      setMonthlySummary(data.summary || {});
      if (data.classes) setClassesList(data.classes);
      if (data.grades) setGradesList(data.grades);
    } catch (e: any) {
      showToast(e.message || "Failed to load monthly fees.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [initialYearId, selectedMonth]);

  // 2. Fetch pending arrears (selected month and earlier)
  const fetchPendingData = useCallback(async () => {
    setLoadingPending(true);
    try {
      const q = new URLSearchParams({
        yearId: initialYearId,
        upToMonth: selectedMonth,
      });
      const res = await fetch(`/api/owner/fees/pending?${q.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load pending fees.");
      }
      const data = await res.json();
      setPendingData(data);
    } catch (e: any) {
      showToast(e.message || "Failed to load pending arrears.", "error");
    } finally {
      setLoadingPending(false);
    }
  }, [initialYearId, selectedMonth]);

  // 3. Fetch admission fees
  const fetchAdmissionFees = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        yearId: initialYearId,
      });
      const res = await fetch(`/api/owner/fees/admission?${q.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load admission fees.");
      }
      const data = await res.json();
      setAdmissionStudents(data.students || []);
      setAdmissionSummary(data.summary || {});
    } catch (e: any) {
      showToast(e.message || "Failed to load admission fees.", "error");
    } finally {
      setLoading(false);
    }
  }, [initialYearId]);

  useEffect(() => {
    if (activeTab === "grouped" || activeTab === "all") {
      fetchMonthlyFees();
    } else if (activeTab === "pending") {
      fetchPendingData();
    } else if (activeTab === "admission") {
      fetchAdmissionFees();
    }
  }, [activeTab, fetchMonthlyFees, fetchPendingData, fetchAdmissionFees]);

  // Group unpaid fees by student for the current month
  const groupedUnpaidStudents = useMemo(() => {
    const map = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        grade?: string;
        school?: string;
        fees: FeeRecord[];
        totalUnpaidAmount: number;
      }
    >();

    const q = searchQuery.trim().toLowerCase();

    for (const f of fees) {
      if (f.status !== "unpaid") continue;

      if (selectedClass !== "all" && f.classId !== selectedClass) continue;
      if (selectedGrade !== "all" && f.grade !== selectedGrade) continue;

      if (q) {
        const matchName = (f.studentName || "").toLowerCase().includes(q);
        const matchClass = (f.className || "").toLowerCase().includes(q);
        if (!matchName && !matchClass) continue;
      }

      if (!map.has(f.studentId)) {
        map.set(f.studentId, {
          studentId: f.studentId,
          studentName: f.studentName || "Student",
          grade: f.grade,
          school: (f as any).school,
          fees: [],
          totalUnpaidAmount: 0,
        });
      }

      const entry = map.get(f.studentId)!;
      entry.fees.push(f);
      entry.totalUnpaidAmount += f.amount || 0;
    }

    return Array.from(map.values()).sort((a, b) =>
      a.studentName.localeCompare(b.studentName)
    );
  }, [fees, searchQuery, selectedClass, selectedGrade]);

  // Tap a student card to open BottomSheet
  const handleOpenStudentSheet = (studentGroup: {
    studentId: string;
    studentName: string;
    grade?: string;
    fees: FeeRecord[];
  }) => {
    // find all fees for this student in the month (including paid ones if any)
    const studentMonthFees = fees.filter((f) => f.studentId === studentGroup.studentId);
    setSelectedStudentSheet({
      studentId: studentGroup.studentId,
      studentName: studentGroup.studentName,
      grade: studentGroup.grade,
      fees: studentMonthFees,
    });
    setSelectedPaymentMethod("cash");
    setSelectedPaymentDate(new Date().toISOString().slice(0, 10));
  };

  // Mark a single class fee paid
  const handleMarkSingleFeePaid = async (feeId: string) => {
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/owner/fees/${feeId}?yearId=${initialYearId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paid",
          paymentMethod: selectedPaymentMethod,
          paidAt: selectedPaymentDate ? new Date(selectedPaymentDate).toISOString() : new Date().toISOString(),
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to mark fee paid.");

      showToast(`Payment recorded. Receipt: ${result.fee.receiptNo}`, "success");
      await fetchMonthlyFees(true);

      // Update local sheet state
      if (selectedStudentSheet) {
        setSelectedStudentSheet((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            fees: prev.fees.map((f) => (f.id === feeId ? result.fee : f)),
          };
        });
      }
    } catch (e: any) {
      showToast(e.message || "Failed to record payment.", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Mark All Paid for One Student
  const handleMarkAllPaidForStudent = async () => {
    if (!selectedStudentSheet) return;
    const unpaidFeeIds = selectedStudentSheet.fees
      .filter((f) => f.status === "unpaid")
      .map((f) => f.id);

    if (unpaidFeeIds.length === 0) {
      showToast("All class fees are already paid for this student.", "error");
      return;
    }

    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/owner/fees/batch-mark-paid?yearId=${initialYearId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeIds: unpaidFeeIds,
          paymentMethod: selectedPaymentMethod,
          paidAt: selectedPaymentDate ? new Date(selectedPaymentDate).toISOString() : new Date().toISOString(),
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Batch payment failed.");

      showToast(`Marked ${result.updatedCount} class fee(s) as paid!`, "success");
      await fetchMonthlyFees(true);
      setSelectedStudentSheet(null);
    } catch (e: any) {
      showToast(e.message || "Failed to mark all paid.", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Open Adjust Fee Modal (Mid-month joiners - requires note)
  const handleOpenAdjustFee = (fee: FeeRecord) => {
    setAdjustFeeModal(fee);
    setEditAmount(String(fee.amount));
    setEditTeacherShare(String(fee.teacherShare));
    setEditNote(fee.note || "");
    setAdjustError(null);
  };

  // Submit Adjust Fee with Note
  const handleSaveAdjustFee = async () => {
    if (!adjustFeeModal) return;

    const amountNum = parseFloat(editAmount);
    const teacherShareNum = parseFloat(editTeacherShare);

    if (isNaN(amountNum) || amountNum < 0) {
      setAdjustError("Please enter a valid non-negative fee amount.");
      return;
    }
    if (isNaN(teacherShareNum) || teacherShareNum < 0) {
      setAdjustError("Please enter a valid non-negative teacher share.");
      return;
    }
    if (teacherShareNum > amountNum) {
      setAdjustError("Teacher share cannot exceed the total monthly fee.");
      return;
    }
    if (!editNote.trim() || editNote.trim().length < 3) {
      setAdjustError("A short note explaining this adjustment is required (min 3 characters).");
      return;
    }

    setSubmittingAdjust(true);
    setAdjustError(null);

    try {
      const res = await fetch(`/api/owner/fees/${adjustFeeModal.id}?yearId=${initialYearId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountNum,
          teacherShare: teacherShareNum,
          note: editNote.trim(),
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to adjust fee amounts.");

      showToast("Fee amount updated with note.", "success");
      setAdjustFeeModal(null);
      await fetchMonthlyFees(true);

      if (selectedStudentSheet) {
        setSelectedStudentSheet((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            fees: prev.fees.map((f) => (f.id === adjustFeeModal.id ? result.fee : f)),
          };
        });
      }
    } catch (e: any) {
      setAdjustError(e.message || "Failed to save adjustments.");
    } finally {
      setSubmittingAdjust(false);
    }
  };

  // Revert single fee to unpaid
  const handleRevertUnpaid = async (fee: FeeRecord) => {
    if (!confirm(`Are you sure you want to revert payment for ${fee.studentName || "this student"}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/owner/fees/${fee.id}?yearId=${initialYearId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "unpaid" }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to revert fee status.");

      showToast("Fee reverted to unpaid.", "success");
      await fetchMonthlyFees(true);
      if (selectedStudentSheet) {
        setSelectedStudentSheet((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            fees: prev.fees.map((f) => (f.id === fee.id ? result.fee : f)),
          };
        });
      }
    } catch (e: any) {
      showToast(e.message || "Failed to revert fee.", "error");
    }
  };

  // Open Admission Fee Modal
  const handleOpenAdmissionModal = (student: Student & { grade?: string }) => {
    setAdmissionModalStudent(student);
    const existing = student.admissionFee;
    setAdmStatus(existing?.status || "paid");
    setAdmAmount(String(existing?.amount || 2500));
    setAdmMethod(existing?.method || "cash");
    setAdmDate(existing?.paidDate || new Date().toISOString().slice(0, 10));
    setAdmReceiptNo(existing?.receiptNo || "");
  };

  // Save Admission Fee
  const handleSaveAdmissionFee = async () => {
    if (!admissionModalStudent) return;
    setSubmittingAdmission(true);

    try {
      const payload: any = { status: admStatus };
      if (admStatus === "paid") {
        const amt = parseFloat(admAmount);
        if (isNaN(amt) || amt < 0) {
          throw new Error("Admission fee amount must be a positive number.");
        }
        payload.amount = amt;
        payload.method = admMethod;
        payload.paidDate = admDate || new Date().toISOString().slice(0, 10);
        payload.receiptNo = admReceiptNo.trim() || undefined;
      }

      const res = await fetch(
        `/api/owner/fees/admission/${admissionModalStudent.id}?yearId=${initialYearId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to update admission fee.");

      showToast(`Admission fee updated to ${admStatus}.`, "success");
      setAdmissionModalStudent(null);
      fetchAdmissionFees();
    } catch (e: any) {
      showToast(e.message || "Failed to update admission fee.", "error");
    } finally {
      setSubmittingAdmission(false);
    }
  };

  // View Receipt Preview
  const handleViewReceipt = async (receiptNo: string) => {
    setReceiptModalNumber(receiptNo);
    setLoadingReceipt(true);
    setReceiptData(null);

    try {
      const res = await fetch(`/api/owner/fees/receipt/${receiptNo}?yearId=${initialYearId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Receipt not found.");
      }
      const data = await res.json();
      setReceiptData(data.receipt);
    } catch (e: any) {
      showToast(e.message || "Failed to load receipt.", "error");
      setReceiptModalNumber(null);
    } finally {
      setLoadingReceipt(false);
    }
  };

  return (
    <div className="space-y-4 pb-16">
      {/* Toast Alert */}
      {message && (
        <div
          className={`p-3 rounded-md text-xs font-medium flex items-center justify-between border ${
            message.type === "success"
              ? "bg-[#E6F0EC] text-[#1F5C4D] border-[#C2DDD4]"
              : "bg-[#FBE9E7] text-[#A32A2A] border-[#F5C7C3]"
          }`}
        >
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="p-1 hover:opacity-75 focus:outline-none"
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Month Navigator Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-white p-3 rounded-md border border-[#E4E1DA]">
        <div className="flex items-center space-x-2">
          <Button
            variant="quiet"
            size="sm"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            className="h-9 w-9 p-0 flex items-center justify-center border border-[#E4E1DA]"
          >
            <ChevronLeft className="w-5 h-5 text-[#5F6670]" />
          </Button>
          <div className="px-3 py-1 font-semibold text-[#1C1F23] text-sm min-w-[170px] text-center bg-[#FAF9F6] border border-[#E4E1DA] rounded">
            {formatMonthTitle(selectedMonth)}
          </div>
          <Button
            variant="quiet"
            size="sm"
            onClick={handleNextMonth}
            aria-label="Next month"
            className="h-9 w-9 p-0 flex items-center justify-center border border-[#E4E1DA]"
          >
            <ChevronRight className="w-5 h-5 text-[#5F6670]" />
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchMonthlyFees(true)}
            disabled={refreshing}
            className="text-xs h-9 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Syncing..." : "Sync Fees"}
          </Button>
        </div>
      </div>

      {/* Financial Summary: Total Collected & Total Pending */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 border-[#C2DDD4] bg-[#E6F0EC]/30">
          <div className="text-xs text-[#1F5C4D] font-medium">Total Collected</div>
          <div className="text-lg font-bold text-[#1F5C4D] mt-1">
            {formatLKR(monthlySummary.totalCollected)}
          </div>
          <div className="text-[11px] text-[#1F5C4D] mt-0.5">
            {monthlySummary.paidCount} paid in {formatMonthTitle(selectedMonth)}
          </div>
        </Card>

        <Card className="p-3 border-[#F5C7C3] bg-[#FBE9E7]/30">
          <div className="text-xs text-[#A32A2A] font-medium">Total Pending</div>
          <div className="text-lg font-bold text-[#A32A2A] mt-1">
            {formatLKR(monthlySummary.totalUnpaid)}
          </div>
          <div className="text-[11px] text-[#A32A2A] mt-0.5">
            {monthlySummary.unpaidCount} unpaid in {formatMonthTitle(selectedMonth)}
          </div>
        </Card>

        <Card className="p-3 border-[#E4E1DA] bg-white">
          <div className="text-xs text-[#5F6670] font-medium">Total Expected</div>
          <div className="text-lg font-bold text-[#1C1F23] mt-1">
            {formatLKR(monthlySummary.totalExpected)}
          </div>
          <div className="text-[11px] text-[#5F6670] mt-0.5">
            {monthlySummary.totalCount} active student fees
          </div>
        </Card>

        <Card className="p-3 border-[#E4E1DA] bg-white">
          <div className="text-xs text-[#5F6670] font-medium">Teacher Share Accrued</div>
          <div className="text-lg font-bold text-[#1C1F23] mt-1">
            {formatLKR(monthlySummary.totalTeacherShare)}
          </div>
          <div className="text-[11px] text-[#5F6670] mt-0.5">Based on enrolled students</div>
        </Card>
      </div>

      {/* Main Feature Tabs */}
      <div className="flex border-b border-[#E4E1DA] space-x-1 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab("grouped")}
          className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "grouped"
              ? "border-[#1F5C4D] text-[#1F5C4D] font-bold"
              : "border-transparent text-[#5F6670] hover:text-[#1C1F23]"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Unpaid by Student
          {groupedUnpaidStudents.length > 0 && (
            <span className="text-[10px] font-bold bg-[#FBE9E7] text-[#A32A2A] px-1.5 py-0.2 rounded-full border border-[#F5C7C3]">
              {groupedUnpaidStudents.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("pending")}
          className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "pending"
              ? "border-[#1F5C4D] text-[#1F5C4D] font-bold"
              : "border-transparent text-[#5F6670] hover:text-[#1C1F23]"
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-[#9A5B00]" />
          Pending Arrears ({formatMonthTitle(selectedMonth)} & Earlier)
        </button>

        <button
          onClick={() => setActiveTab("all")}
          className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "all"
              ? "border-[#1F5C4D] text-[#1F5C4D] font-bold"
              : "border-transparent text-[#5F6670] hover:text-[#1C1F23]"
          }`}
        >
          <FileText className="w-4 h-4" />
          All Monthly Records ({fees.length})
        </button>

        <button
          onClick={() => setActiveTab("admission")}
          className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "admission"
              ? "border-[#1F5C4D] text-[#1F5C4D] font-bold"
              : "border-transparent text-[#5F6670] hover:text-[#1C1F23]"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Admission Fees
          {admissionSummary.unpaidCount > 0 && (
            <span className="text-[10px] font-bold bg-[#FBE9E7] text-[#A32A2A] px-1.5 py-0.2 rounded-full border border-[#F5C7C3]">
              {admissionSummary.unpaidCount}
            </span>
          )}
        </button>
      </div>

      {/* Search & Filter Bar */}
      {(activeTab === "grouped" || activeTab === "all") && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#5F6670] absolute left-3 top-3" />
            <Input
              placeholder="Search student or class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs h-9 pl-8"
            />
          </div>

          <div>
            <Select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="text-xs h-9"
            >
              <option value="all">All Classes</option>
              {classesList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="text-xs h-9"
            >
              <option value="all">All Grades</option>
              {gradesList.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {/* VIEW 1: UNPAID GROUPED BY STUDENT (Mandated in Prompt) */}
      {activeTab === "grouped" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#5F6670] px-1">
            <span>
              Tap a student to view classes, mark individual class paid, or <strong>Mark All Paid</strong>.
            </span>
            <span className="font-semibold text-[#A32A2A]">
              {groupedUnpaidStudents.length} student{groupedUnpaidStudents.length === 1 ? "" : "s"} unpaid
            </span>
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          ) : groupedUnpaidStudents.length === 0 ? (
            <EmptyState
              title="All student fees collected!"
              description={`There are no unpaid student fees for ${formatMonthTitle(selectedMonth)}.`}
              icon={<CheckCircle2 className="w-8 h-8 text-[#1F5C4D]" strokeWidth={1.5} />}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {groupedUnpaidStudents.map((grp) => (
                <div
                  key={grp.studentId}
                  onClick={() => handleOpenStudentSheet(grp)}
                  className="p-3.5 bg-white border border-[#E4E1DA] hover:border-[#1F5C4D] rounded-md cursor-pointer transition-colors space-y-2.5 group shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-sm text-[#1C1F23] group-hover:text-[#1F5C4D] transition-colors flex items-center gap-1.5">
                        {grp.studentName}
                        <ArrowRight className="w-3.5 h-3.5 text-[#5F6670] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="text-xs text-[#5F6670] mt-0.5">
                        {grp.grade || "Grade 10"} {grp.school ? `• ${grp.school}` : ""}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-[#A32A2A] tabular-nums">
                        {formatLKR(grp.totalUnpaidAmount)}
                      </div>
                      <div className="text-[11px] text-[#5F6670]">
                        {grp.fees.length} class{grp.fees.length === 1 ? "" : "es"} unpaid
                      </div>
                    </div>
                  </div>

                  {/* List of unpaid classes for this student */}
                  <div className="space-y-1 pt-1 border-t border-[#E4E1DA]/60">
                    {grp.fees.map((fee) => (
                      <div
                        key={fee.id}
                        className="flex items-center justify-between text-xs py-0.5 text-[#5F6670]"
                      >
                        <span className="truncate max-w-[200px] text-[#1C1F23] font-medium">
                          {fee.className || "Class Fee"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="tabular-nums font-semibold text-[#1C1F23]">
                            {formatLKR(fee.amount)}
                          </span>
                          <StatusChip status="unpaid" className="text-[10px] px-1.5 py-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: PENDING ARREARS VIEW (Current & Earlier Months with Tap-to-Call) */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          <div className="bg-[#FAF9F6] p-3 rounded-md border border-[#E4E1DA] text-xs text-[#5F6670] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <strong className="text-[#1C1F23]">Arrears Recovery View:</strong> Showing all unpaid student fees for{" "}
              <strong>{formatMonthTitle(selectedMonth)} and earlier</strong>.
            </div>
            <div className="font-bold text-[#A32A2A]">
              Total Pending Tuition: {formatLKR(pendingData.totalPendingTuition)}
            </div>
          </div>

          {loadingPending ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </div>
          ) : pendingData.pendingStudents.length === 0 ? (
            <EmptyState
              title="No pending arrears"
              description={`No outstanding student tuition fees found for ${formatMonthTitle(selectedMonth)} or earlier.`}
              icon={<CheckCircle2 className="w-8 h-8 text-[#1F5C4D]" strokeWidth={1.5} />}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {pendingData.pendingStudents.map((s) => (
                <Card
                  key={s.studentId}
                  className="p-3.5 bg-white border-[#E4E1DA] hover:border-[#A32A2A]/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#1C1F23]">{s.studentName}</span>
                        <span className="text-[11px] bg-[#FAF9F6] border border-[#E4E1DA] px-1.5 py-0.5 rounded text-[#5F6670]">
                          {s.grade}
                        </span>
                      </div>

                      <div className="text-xs text-[#5F6670] flex flex-wrap items-center gap-x-2">
                        <span>Guardian: <strong className="text-[#1C1F23]">{s.guardianName}</strong></span>
                        {s.guardianPhone && (
                          <a
                            href={`tel:${s.guardianPhone}`}
                            className="inline-flex items-center gap-1 font-semibold text-[#1F5C4D] bg-[#E6F0EC] px-2 py-0.5 rounded border border-[#C2DDD4] hover:bg-[#d5e7df] transition-colors"
                          >
                            <Phone className="w-3 h-3" />
                            {s.guardianPhone} (Tap to Call)
                          </a>
                        )}
                      </div>

                      {/* Arrears Breakdown */}
                      <div className="text-[11px] text-[#5F6670] pt-1 flex flex-wrap gap-1.5">
                        {s.unpaidFees.map((u: any) => (
                          <span
                            key={u.id}
                            className="bg-[#FBE9E7] text-[#A32A2A] px-2 py-0.5 rounded border border-[#F5C7C3]"
                          >
                            {u.month}: {u.className} ({formatLKR(u.amount)})
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-right sm:border-l sm:border-[#E4E1DA] sm:pl-4">
                      <div className="text-xs text-[#5F6670]">Total Arrears</div>
                      <div className="text-base font-bold text-[#A32A2A] tabular-nums mt-0.5">
                        {formatLKR(s.totalPendingAmount)}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Unpaid Admission Fees Section (Mandated in Prompt) */}
          <div className="pt-4 border-t border-[#E4E1DA] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1C1F23] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#9A5B00]" />
                Unpaid Admission Fees (Separate List)
              </h3>
              <span className="text-xs font-semibold text-[#A32A2A]">
                Total: {formatLKR(pendingData.totalUnpaidAdmissionAmount)}
              </span>
            </div>

            {pendingData.unpaidAdmissionStudents.length === 0 ? (
              <p className="text-xs text-[#5F6670]">No unpaid admission fees recorded.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {pendingData.unpaidAdmissionStudents.map((adm) => (
                  <div
                    key={adm.studentId}
                    className="p-3 bg-white border border-[#E4E1DA] rounded flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-[#1C1F23]">{adm.studentName}</div>
                      <div className="text-[11px] text-[#5F6670] mt-0.5">
                        Guardian: {adm.guardianName}{" "}
                        {adm.guardianPhone && (
                          <a
                            href={`tel:${adm.guardianPhone}`}
                            className="text-[#1F5C4D] hover:underline ml-1 font-medium"
                          >
                            ({adm.guardianPhone})
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#A32A2A]">{formatLKR(adm.amount)}</div>
                      <StatusChip status="unpaid" className="text-[10px] mt-0.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: ALL MONTHLY RECORDS */}
      {activeTab === "all" && (
        <div className="space-y-2.5">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : fees.length === 0 ? (
            <EmptyState
              title="No records found"
              description="No fee records match your current filter."
              icon={<CreditCard className="w-8 h-8 text-[#5F6670]" strokeWidth={1.5} />}
            />
          ) : (
            <>
              {/* Desktop Table View (>=1024px) */}
              <div className="hidden lg:block bg-white border border-[#E4E1DA] rounded-[6px] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF9F6] border-b border-[#E4E1DA] text-[#5F6670]">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Student</th>
                      <th className="py-2.5 px-3 font-semibold">Class</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Teacher Share</th>
                      <th className="py-2.5 px-3 font-semibold">Payment Details</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E1DA]">
                    {fees.map((fee) => {
                      const isPaid = fee.status === "paid";
                      return (
                        <tr key={fee.id} className="hover:bg-[#FAF9F6]/50 transition-colors">
                          <td className="py-3 px-3 font-medium text-[#1C1F23]">
                            <div>{fee.studentName}</div>
                            {fee.note && (
                              <div className="text-[11px] text-[#9A5B00] italic mt-0.5">
                                Note: {fee.note}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[#5F6670]">{fee.className}</td>
                          <td className="py-3 px-3">
                            <StatusChip status={fee.status} />
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-[#1C1F23] tabular-nums">
                            {formatLKR(fee.amount)}
                          </td>
                          <td className="py-3 px-3 text-right text-[#5F6670] tabular-nums">
                            {formatLKR(fee.teacherShare)}
                          </td>
                          <td className="py-3 px-3">
                            {isPaid ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="uppercase font-semibold text-[#1F5C4D]">
                                  {fee.paymentMethod || "Cash"}
                                </span>
                                {fee.paidAt && (
                                  <span className="text-[11px] text-[#5F6670]">
                                    • {new Date(fee.paidAt).toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                    })}
                                  </span>
                                )}
                                {fee.receiptNo && (
                                  <span className="font-mono bg-[#E6F0EC] text-[#1F5C4D] px-1.5 py-0.5 rounded border border-[#C2DDD4] text-[10px]">
                                    {fee.receiptNo}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#5F6670] italic">Unpaid</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isPaid ? (
                                <Button
                                  variant="quiet"
                                  size="sm"
                                  onClick={() => handleOpenAdjustFee(fee)}
                                  className="h-7 px-2 text-xs border border-[#E4E1DA]"
                                >
                                  <Edit2 className="w-3 h-3 mr-1" />
                                  Adjust
                                </Button>
                              ) : (
                                <>
                                  {fee.receiptNo && (
                                    <>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleViewReceipt(fee.receiptNo!)}
                                        className="h-7 px-2 text-xs"
                                      >
                                        <Printer className="w-3 h-3 mr-1" />
                                        Receipt
                                      </Button>
                                      <a
                                        href={`/api/owner/fees/receipt/${fee.receiptNo}/pdf`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="h-7 px-2 text-xs flex items-center gap-1 border border-[#C2DDD4] bg-[#E6F0EC] text-[#1F5C4D] rounded font-medium hover:bg-[#d0e4dc] transition-colors"
                                      >
                                        <Download className="w-3 h-3" />
                                        PDF
                                      </a>
                                    </>
                                  )}
                                  <Button
                                    variant="quiet"
                                    size="sm"
                                    onClick={() => handleRevertUnpaid(fee)}
                                    className="h-7 px-2 text-[11px] text-[#A32A2A] hover:bg-[#FBE9E7]"
                                  >
                                    Revert
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile/Tablet Card Stack (<1024px) */}
              <div className="space-y-2.5 block lg:hidden">
                {fees.map((fee) => {
                  const isPaid = fee.status === "paid";
                  return (
                    <Card
                      key={fee.id}
                      className="p-3 bg-white border-[#E4E1DA] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#1C1F23]">
                            {fee.studentName}
                          </span>
                          <StatusChip status={fee.status} />
                          <span className="text-[11px] text-[#5F6670]">{fee.className}</span>
                        </div>

                        {fee.note && (
                          <div className="text-[11px] text-[#9A5B00] italic">
                            Note: {fee.note}
                          </div>
                        )}

                        {isPaid && (
                          <div className="text-[11px] text-[#1F5C4D] flex items-center gap-2">
                            <span className="uppercase font-semibold">{fee.paymentMethod || "Cash"}</span>
                            {fee.paidAt && <span>• Paid on {new Date(fee.paidAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                            {fee.receiptNo && (
                              <span className="font-mono bg-[#E6F0EC] px-1.5 py-0.5 rounded border border-[#C2DDD4]">
                                {fee.receiptNo}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0">
                        <div className="text-right">
                          <div className="font-bold text-sm text-[#1C1F23]">
                            {formatLKR(fee.amount)}
                          </div>
                          <div className="text-[11px] text-[#5F6670]">
                            Share: {formatLKR(fee.teacherShare)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {!isPaid ? (
                            <>
                              <Button
                                variant="quiet"
                                size="sm"
                                onClick={() => handleOpenAdjustFee(fee)}
                                className="h-8 px-2 text-xs border border-[#E4E1DA]"
                              >
                                <Edit2 className="w-3 h-3 mr-1" />
                                Adjust
                              </Button>
                            </>
                          ) : (
                            <>
                              {fee.receiptNo && (
                                <>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleViewReceipt(fee.receiptNo!)}
                                    className="h-8 px-2 text-xs"
                                  >
                                    <Printer className="w-3 h-3 mr-1" />
                                    Receipt
                                  </Button>
                                  <a
                                    href={`/api/owner/fees/receipt/${fee.receiptNo}/pdf`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="h-8 px-2 text-xs flex items-center gap-1 border border-[#C2DDD4] bg-[#E6F0EC] text-[#1F5C4D] rounded font-medium hover:bg-[#d0e4dc] transition-colors"
                                  >
                                    <Download className="w-3 h-3" />
                                    PDF
                                  </a>
                                </>
                              )}
                              <Button
                                variant="quiet"
                                size="sm"
                                onClick={() => handleRevertUnpaid(fee)}
                                className="h-8 px-2 text-[11px] text-[#A32A2A] hover:bg-[#FBE9E7]"
                              >
                                Revert
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* VIEW 4: ADMISSION FEES VIEW */}
      {activeTab === "admission" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3 border-[#C2DDD4] bg-[#E6F0EC]/30">
              <div className="text-xs text-[#1F5C4D] font-medium">Admission Collected</div>
              <div className="text-lg font-bold text-[#1F5C4D] mt-1">
                {formatLKR(admissionSummary.totalCollected)}
              </div>
              <div className="text-[11px] text-[#1F5C4D] mt-0.5">
                {admissionSummary.paidCount} students paid
              </div>
            </Card>

            <Card className="p-3 border-[#F5C7C3] bg-[#FBE9E7]/30">
              <div className="text-xs text-[#A32A2A] font-medium">Unpaid Admissions</div>
              <div className="text-lg font-bold text-[#A32A2A] mt-1">
                {admissionSummary.unpaidCount}
              </div>
              <div className="text-[11px] text-[#A32A2A] mt-0.5">Pending collection</div>
            </Card>

            <Card className="p-3 border-[#E4E1DA] bg-white">
              <div className="text-xs text-[#5F6670] font-medium">Exempt / Not Applicable</div>
              <div className="text-lg font-bold text-[#1C1F23] mt-1">
                {admissionSummary.notApplicableCount}
              </div>
              <div className="text-[11px] text-[#5F6670] mt-0.5">Existing students</div>
            </Card>

            <Card className="p-3 border-[#E4E1DA] bg-white">
              <div className="text-xs text-[#5F6670] font-medium">Total Registered</div>
              <div className="text-lg font-bold text-[#1C1F23] mt-1">
                {admissionSummary.totalCount}
              </div>
              <div className="text-[11px] text-[#5F6670] mt-0.5">Permanent students</div>
            </Card>
          </div>

          <div className="space-y-2">
            {admissionStudents.map((s) => {
              const adm = s.admissionFee;
              const isPaid = adm?.status === "paid";
              return (
                <Card
                  key={s.id}
                  className="p-3.5 bg-white border-[#E4E1DA] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#1C1F23]">{s.name}</span>
                      <StatusChip status={adm?.status || "unpaid"} />
                      <span className="text-[11px] text-[#5F6670]">{s.grade}</span>
                    </div>

                    <div className="text-xs text-[#5F6670]">
                      Guardian: {s.guardianName}{" "}
                      {s.guardianPhone && (
                        <a
                          href={`tel:${s.guardianPhone}`}
                          className="text-[#1F5C4D] hover:underline ml-1 font-medium"
                        >
                          ({s.guardianPhone})
                        </a>
                      )}
                    </div>

                    {isPaid && adm?.receiptNo && (
                      <div className="text-[11px] text-[#1F5C4D] flex items-center gap-2">
                        <span className="font-mono bg-[#E6F0EC] px-1.5 py-0.5 rounded border border-[#C2DDD4]">
                          {adm.receiptNo}
                        </span>
                        <span>Paid on {adm.paidDate}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0">
                    <div className="text-right">
                      <div className="font-bold text-sm text-[#1C1F23]">
                        {formatLKR(isPaid ? adm.amount : adm?.amount || 2500)}
                      </div>
                      <div className="text-[11px] text-[#5F6670]">Admission Fee</div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant={isPaid ? "quiet" : "primary"}
                        size="sm"
                        onClick={() => handleOpenAdmissionModal(s)}
                        className="h-8 px-3 text-xs"
                      >
                        {isPaid ? "Edit" : "Mark Paid"}
                      </Button>
                      {isPaid && adm?.receiptNo && (
                        <a
                          href={`/api/owner/fees/receipt/${adm.receiptNo}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-8 px-2 text-xs flex items-center gap-1 border border-[#C2DDD4] bg-[#E6F0EC] text-[#1F5C4D] rounded font-medium hover:bg-[#d0e4dc] transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* BOTTOM SHEET: Student Fees & Mark All Paid (Mandated in Prompt) */}
      <BottomSheet
        open={!!selectedStudentSheet}
        onClose={() => setSelectedStudentSheet(null)}
        title={selectedStudentSheet ? `${selectedStudentSheet.studentName} — Class Fees` : "Student Fees"}
      >
        {selectedStudentSheet && (
          <div className="space-y-4 text-xs pb-4">
            <div className="bg-[#FAF9F6] p-3 rounded border border-[#E4E1DA] space-y-1">
              <div className="font-semibold text-sm text-[#1C1F23]">
                {selectedStudentSheet.studentName} ({selectedStudentSheet.grade || "Grade 10"})
              </div>
              <div className="text-[#5F6670]">
                Billing Month: <strong>{formatMonthTitle(selectedMonth)}</strong>
              </div>
            </div>

            {/* Payment Method & Date selector for marking paid */}
            <div className="p-3 bg-white border border-[#E4E1DA] rounded space-y-2.5">
              <div className="font-semibold text-[#1C1F23]">Payment Details for Settlement</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#5F6670] mb-1">Method</label>
                  <Select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value as PaymentMethod)}
                    className="h-9 text-xs"
                  >
                    <option value="cash">Cash Payment</option>
                    <option value="bank">Bank Transfer</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-[#5F6670] mb-1">Payment Date</label>
                  <Input
                    type="date"
                    value={selectedPaymentDate}
                    onChange={(e) => setSelectedPaymentDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Primary Action: Mark All Paid */}
              {selectedStudentSheet.fees.some((f) => f.status === "unpaid") && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleMarkAllPaidForStudent}
                  disabled={submittingAction}
                  className="w-full h-10 text-xs bg-[#1F5C4D] text-white hover:bg-[#164439] flex items-center justify-center gap-2 mt-2"
                >
                  <CheckCheck className="w-4 h-4" />
                  {submittingAction ? "Processing..." : `Mark All Paid for ${selectedStudentSheet.studentName}`}
                </Button>
              )}
            </div>

            {/* Class Fees breakdown for this student */}
            <div className="space-y-2">
              <div className="font-semibold text-[#1C1F23]">Individual Class Fees</div>
              {selectedStudentSheet.fees.map((fee) => {
                const isPaid = fee.status === "paid";
                return (
                  <div
                    key={fee.id}
                    className="p-3 bg-white border border-[#E4E1DA] rounded flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[#1C1F23]">{fee.className}</div>
                        <div className="text-[11px] text-[#5F6670]">
                          Share: {formatLKR(fee.teacherShare)}
                          {fee.note && <span className="text-[#9A5B00] ml-1">({fee.note})</span>}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-sm text-[#1C1F23]">
                          {formatLKR(fee.amount)}
                        </div>
                        <StatusChip status={fee.status} className="mt-0.5" />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E1DA]/60">
                      {!isPaid ? (
                        <>
                          <Button
                            variant="quiet"
                            size="sm"
                            onClick={() => handleOpenAdjustFee(fee)}
                            className="h-8 px-2 text-xs border border-[#E4E1DA]"
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Adjust
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleMarkSingleFeePaid(fee.id)}
                            disabled={submittingAction}
                            className="h-8 px-3 text-xs bg-[#1F5C4D] text-white"
                          >
                            Mark Paid
                          </Button>
                        </>
                      ) : (
                        <>
                          {fee.receiptNo && (
                            <a
                              href={`/api/owner/fees/receipt/${fee.receiptNo}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-8 px-2.5 text-xs flex items-center gap-1 border border-[#C2DDD4] bg-[#E6F0EC] text-[#1F5C4D] rounded font-medium"
                            >
                              <Download className="w-3 h-3" />
                              PDF
                            </a>
                          )}
                          <Button
                            variant="quiet"
                            size="sm"
                            onClick={() => handleRevertUnpaid(fee)}
                            className="h-8 px-2 text-[11px] text-[#A32A2A]"
                          >
                            Revert
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* MODAL: Adjust Mid-Month Joiner Fee (Requires Note) */}
      {adjustFeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg border border-[#E4E1DA] max-w-md w-full p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#E4E1DA] pb-3">
              <div>
                <h3 className="font-semibold text-base text-[#1C1F23]">Adjust Mid-Month Fee</h3>
                <p className="text-xs text-[#5F6670] mt-0.5">
                  {adjustFeeModal.studentName} — {adjustFeeModal.className || "Class"}
                </p>
              </div>
              <button
                onClick={() => setAdjustFeeModal(null)}
                className="p-1 text-[#5F6670] hover:text-[#1C1F23]"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {adjustError && (
              <div className="p-2.5 bg-[#FBE9E7] text-[#A32A2A] border border-[#F5C7C3] rounded text-xs flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{adjustError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#1C1F23] mb-1">
                  Adjusted Fee Amount (LKR) <span className="text-[#A32A2A]">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="h-9 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium text-[#1C1F23] mb-1">
                  Adjusted Teacher Share (LKR) <span className="text-[#A32A2A]">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={editTeacherShare}
                  onChange={(e) => setEditTeacherShare(e.target.value)}
                  className="h-9 text-xs font-semibold"
                />
                <p className="text-[11px] text-[#5F6670] mt-1">
                  Teacher share cannot exceed the total monthly fee.
                </p>
              </div>

              <div>
                <label className="block font-medium text-[#1C1F23] mb-1">
                  Reason / Short Note <span className="text-[#A32A2A]">*</span>
                </label>
                <Input
                  placeholder="e.g. Joined on 15th Nov, prorated 50%"
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="h-9 text-xs"
                />
                <p className="text-[11px] text-[#5F6670] mt-1">
                  A short note is required whenever adjusting a fee record.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#E4E1DA]">
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setAdjustFeeModal(null)}
                className="h-9 px-3"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveAdjustFee}
                disabled={submittingAdjust}
                className="h-9 px-4 bg-[#1F5C4D] text-white"
              >
                {submittingAdjust ? "Saving..." : "Save Adjustments"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Admission Fee Settlement */}
      {admissionModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg border border-[#E4E1DA] max-w-md w-full p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#E4E1DA] pb-3">
              <div>
                <h3 className="font-semibold text-base text-[#1C1F23]">Admission Fee Status</h3>
                <p className="text-xs text-[#5F6670] mt-0.5">{admissionModalStudent.name}</p>
              </div>
              <button
                onClick={() => setAdmissionModalStudent(null)}
                className="p-1 text-[#5F6670] hover:text-[#1C1F23]"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-[#1C1F23] mb-1">Admission Status</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdmStatus("paid")}
                    className={`py-2 px-2 rounded border text-center font-medium transition-colors text-xs ${
                      admStatus === "paid"
                        ? "bg-[#E6F0EC] text-[#1F5C4D] border-[#1F5C4D]"
                        : "bg-white text-[#5F6670] border-[#E4E1DA]"
                    }`}
                  >
                    Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdmStatus("unpaid")}
                    className={`py-2 px-2 rounded border text-center font-medium transition-colors text-xs ${
                      admStatus === "unpaid"
                        ? "bg-[#FBE9E7] text-[#A32A2A] border-[#A32A2A]"
                        : "bg-white text-[#5F6670] border-[#E4E1DA]"
                    }`}
                  >
                    Unpaid
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdmStatus("notApplicable")}
                    className={`py-2 px-2 rounded border text-center font-medium transition-colors text-xs ${
                      admStatus === "notApplicable"
                        ? "bg-[#FAF9F6] text-[#1C1F23] border-[#1C1F23] font-semibold"
                        : "bg-white text-[#5F6670] border-[#E4E1DA]"
                    }`}
                  >
                    Exempt / N/A
                  </button>
                </div>
              </div>

              {admStatus === "paid" && (
                <>
                  <div>
                    <label className="block font-medium text-[#1C1F23] mb-1">
                      Admission Amount (LKR)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="100"
                      value={admAmount}
                      onChange={(e) => setAdmAmount(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-[#1C1F23] mb-1">Payment Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAdmMethod("cash")}
                        className={`py-2 px-3 rounded border text-center font-medium transition-colors ${
                          admMethod === "cash"
                            ? "bg-[#E6F0EC] text-[#1F5C4D] border-[#1F5C4D]"
                            : "bg-white text-[#5F6670] border-[#E4E1DA]"
                        }`}
                      >
                        Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdmMethod("bank")}
                        className={`py-2 px-3 rounded border text-center font-medium transition-colors ${
                          admMethod === "bank"
                            ? "bg-[#E6F0EC] text-[#1F5C4D] border-[#1F5C4D]"
                            : "bg-white text-[#5F6670] border-[#E4E1DA]"
                        }`}
                      >
                        Bank Transfer
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-[#1C1F23] mb-1">Paid Date</label>
                    <Input
                      type="date"
                      value={admDate}
                      onChange={(e) => setAdmDate(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#E4E1DA]">
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setAdmissionModalStudent(null)}
                className="h-9 px-3"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveAdmissionFee}
                disabled={submittingAdmission}
                className="h-9 px-4 bg-[#1F5C4D] text-white"
              >
                {submittingAdmission ? "Saving..." : "Save Status"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Printable Receipt Preview */}
      {receiptModalNumber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg border border-[#E4E1DA] max-w-lg w-full p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            {loadingReceipt ? (
              <div className="py-12 space-y-3">
                <Skeleton className="h-6 w-1/2 mx-auto" />
                <Skeleton className="h-4 w-3/4 mx-auto" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : receiptData ? (
              <div className="space-y-4">
                <div className="text-center border-b border-[#E4E1DA] pb-4">
                  <h2 className="text-lg font-bold text-[#1C1F23]">
                    {receiptData.college?.name || "Tutorial College"}
                  </h2>
                  <p className="text-xs text-[#5F6670]">{receiptData.college?.address}</p>
                  <div className="inline-block mt-2 px-3 py-1 bg-[#FAF9F6] border border-[#E4E1DA] rounded text-xs font-semibold uppercase tracking-wider text-[#1F5C4D]">
                    Official Payment Receipt
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-1">
                  <div>
                    <span className="text-[#5F6670]">Receipt No:</span>{" "}
                    <span className="font-mono font-bold text-[#1C1F23]">
                      {receiptData.receiptNo}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#5F6670]">Date:</span>{" "}
                    <span className="font-medium text-[#1C1F23]">
                      {new Date(receiptData.date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#5F6670]">Student:</span>{" "}
                    <span className="font-bold text-[#1C1F23]">{receiptData.studentName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#5F6670]">Grade:</span>{" "}
                    <span className="font-medium text-[#1C1F23]">{receiptData.studentGrade}</span>
                  </div>
                </div>

                <div className="border border-[#E4E1DA] rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF9F6] border-b border-[#E4E1DA] text-[#5F6670]">
                      <tr>
                        <th className="py-2 px-3 font-semibold">Description</th>
                        <th className="py-2 px-3 font-semibold text-right">Amount (LKR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-3 px-3 text-[#1C1F23]">
                          <div className="font-medium">{receiptData.description}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-sm text-[#1C1F23]">
                          {receiptData.amountFormatted}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot className="bg-[#FAF9F6] border-t border-[#E4E1DA]">
                      <tr>
                        <th className="py-2.5 px-3 font-bold text-sm text-[#1C1F23]">Total Paid</th>
                        <th className="py-2.5 px-3 font-bold text-sm text-right text-[#1F5C4D]">
                          {receiptData.amountFormatted}
                        </th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-[#A32A2A]">
                Receipt data could not be loaded.
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-[#E4E1DA]">
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setReceiptModalNumber(null)}
                className="h-9 px-4"
              >
                Close
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => window.print()}
                  className="h-9 px-3 border border-[#E4E1DA] text-xs"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  Print
                </Button>
                {receiptModalNumber && (
                  <a
                    href={`/api/owner/fees/receipt/${receiptModalNumber}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-3 text-xs bg-[#1F5C4D] text-white rounded font-medium hover:bg-[#164439] flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
