"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast, type ToastVariant } from "@/components/ui/Toast";
import { MoneyText } from "@/components/ui/MoneyText";
import { Pagination } from "@/components/ui/Pagination";
import {
  ArrowLeft,
  GraduationCap,
  School,
  MapPin,
  User,
  Phone,
  Calendar,
  CreditCard,
  BookOpen,
  Edit,
  History,
  ShieldCheck,
  Trash2,
  Clock,
} from "lucide-react";
import type { Student, AcademicGrade, AdmissionFeeStatus, PaymentMethod, FeeRecord, ClassItem } from "@/types";
import { formatColomboDate, getWeekdayName, formatTimeRange } from "@/lib/dates";
import { getDeduplicatedSubjectAbbreviations } from "@/lib/students";
import { getClassColor } from "@/lib/class-colors";
import { ClassBadge } from "@/components/ui/ClassBadge";

interface EnrolledClass {
  id: string;
  name: string;
  grade: string;
  subject: string;
  teacherName?: string;
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params?.id as string;

  const [student, setStudent] = useState<(Student & { grade: string }) | null>(null);
  const [enrolledClasses, setEnrolledClasses] = useState<EnrolledClass[]>([]);
  const [feeHistory, setFeeHistory] = useState<FeeRecord[]>([]);
  const [yearId, setYearId] = useState<string>("2026");
  const [grades, setGrades] = useState<AcademicGrade[]>([]);
  const [loading, setLoading] = useState(true);

  // Classes state for enrolment
  const [availableClasses, setAvailableClasses] = useState<ClassItem[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Edit BottomSheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSchool, setFormSchool] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formGuardianName, setFormGuardianName] = useState("");
  const [formGuardianPhone, setFormGuardianPhone] = useState("");
  const [formStudentPhone, setFormStudentPhone] = useState("");
  const [formGrade, setFormGrade] = useState("Grade 06");

  const [formFeeStatus, setFormFeeStatus] = useState<AdmissionFeeStatus>("unpaid");
  const [formFeeAmount, setFormFeeAmount] = useState<number>(2000);
  const [formFeeMethod, setFormFeeMethod] = useState<PaymentMethod>("cash");
  const [formFeePaidDate, setFormFeePaidDate] = useState("");
  const [formFeeReceiptNo, setFormFeeReceiptNo] = useState("");

  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<ToastVariant>("info");

  // Fee History Pagination
  const [feePage, setFeePage] = useState(1);
  const [feePageSize, setFeePageSize] = useState(8);

  useEffect(() => {
    if (studentId) {
      loadStudentDetail();
      loadGrades();
    }
  }, [studentId]);

  async function loadClasses(targetYear?: string) {
    try {
      setLoadingClasses(true);
      const y = targetYear || yearId || "2026";
      const res = await fetch(`/api/owner/classes?yearId=${y}`);
      const data = await res.json();
      if (res.ok && data.classes) {
        setAvailableClasses(data.classes);
      }
    } catch {
    } finally {
      setLoadingClasses(false);
    }
  }

  async function loadStudentDetail(targetYear?: string) {
    try {
      setLoading(true);
      const y = targetYear || yearId || "2027";
      const res = await fetch(`/api/owner/students/${studentId}?yearId=${y}`);
      const data = await res.json();
      if (res.ok) {
        setStudent(data.student);
        const enrolled = data.enrolledClasses || [];
        setEnrolledClasses(enrolled);
        setSelectedClassIds(enrolled.map((c: any) => c.id));
        setFeeHistory(data.feeHistory || []);
        const yRes = data.yearId || y;
        setYearId(yRes);
        loadClasses(yRes);
      } else {
        showToast(data.error || "Student not found.", "danger");
      }
    } catch {
      showToast("Unable to connect to server.", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function loadGrades() {
    try {
      const res = await fetch("/api/owner/settings/academic");
      const data = await res.json();
      if (res.ok && data.grades) {
        const sortedGrades = (data.grades as AcademicGrade[])
          .filter((g) => !g.hidden)
          .sort((a, b) => a.order - b.order);
        setGrades(sortedGrades);
        if (sortedGrades.length > 0) {
          setFormGrade((curr) => {
            if (!curr) return sortedGrades[0].name;
            const match = sortedGrades.find((g) => g.name.toLowerCase() === curr.toLowerCase());
            return match ? match.name : curr;
          });
        }
      }
    } catch {}
  }

  function showToast(message: string, variant: ToastVariant = "info") {
    setToastMessage(message);
    setToastVariant(variant);
  }

  function handleGradeChange(newGrade: string) {
    setFormGrade(newGrade);
    // Automatically prune selected classes that do not belong to the newly chosen grade
    setSelectedClassIds((prev) => {
      return prev.filter((id) => {
        const c = availableClasses.find((cls) => cls.id === id);
        return c && c.grade.trim().toLowerCase() === newGrade.trim().toLowerCase();
      });
    });
  }

  function openEditSheet() {
    if (!student) return;
    setFormName(student.name);
    setFormSchool(student.school);
    setFormAddress(student.address);
    setFormGuardianName(student.guardianName);
    setFormGuardianPhone(student.guardianPhone);
    setFormStudentPhone(student.studentPhone || "");
    const matchingGrade = grades.find(
      (g) => g.name.toLowerCase() === (student.grade || "").toLowerCase()
    );
    const studentGrade = matchingGrade
      ? matchingGrade.name
      : student.grade && student.grade !== "Not Enrolled"
      ? student.grade
      : grades[0]?.name || "Grade 06";
    setFormGrade(studentGrade);
    setSelectedClassIds(enrolledClasses.map((c) => c.id));

    // Freshly fetch student's currently enrolled classes for the active academic year
    const targetYear = yearId || "2027";
    setLoadingClasses(true);
    fetch(`/api/owner/students/${studentId}?yearId=${targetYear}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.enrolledClasses && Array.isArray(data.enrolledClasses)) {
          setEnrolledClasses(data.enrolledClasses);
          setSelectedClassIds(data.enrolledClasses.map((c: any) => c.id));
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoadingClasses(false);
      });

    const fee = student.admissionFee || {};
    setFormFeeStatus(fee.status || "unpaid");
    setFormFeeAmount(fee.amount ?? 2000);
    setFormFeeMethod(fee.method || "cash");
    setFormFeePaidDate(fee.paidDate || "");
    setFormFeeReceiptNo(fee.receiptNo || "");

    setFormError("");
    setSheetOpen(true);
  }

  // Filter available classes to show ONLY classes related to the selected grade
  const relatedClasses = useMemo(() => {
    return availableClasses.filter(
      (c) => c.active !== false && c.grade.trim().toLowerCase() === formGrade.trim().toLowerCase()
    );
  }, [availableClasses, formGrade]);

  // Total monthly fee of all currently selected classes
  const selectedClassesTotalMonthlyFee = useMemo(() => {
    return availableClasses
      .filter((c) => selectedClassIds.includes(c.id))
      .reduce((sum, c) => sum + (c.currentTerms?.monthlyFee || 0), 0);
  }, [availableClasses, selectedClassIds]);

  async function handleUpdateStudent(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!formName.trim() || !formSchool.trim() || !formAddress.trim() || !formGuardianName.trim() || !formGuardianPhone.trim() || !formGrade.trim()) {
      setFormError("Please fill in all mandatory fields.");
      return;
    }

    try {
      setFormSaving(true);
      const payload = {
        name: formName.trim(),
        school: formSchool.trim(),
        address: formAddress.trim(),
        guardianName: formGuardianName.trim(),
        guardianPhone: formGuardianPhone.trim(),
        studentPhone: formStudentPhone.trim() || undefined,
        grade: formGrade.trim(),
        yearId,
        enrolledClassIds: selectedClassIds,
        admissionFee: {
          amount: Number(formFeeAmount) || 0,
          status: formFeeStatus,
          method: formFeeStatus === "paid" ? formFeeMethod : undefined,
          paidDate: formFeeStatus === "paid" && formFeePaidDate ? formFeePaidDate : undefined,
          receiptNo: formFeeStatus === "paid" && formFeeReceiptNo ? formFeeReceiptNo.trim() : undefined,
        },
      };

      const res = await fetch(`/api/owner/students/${studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setSheetOpen(false);
        showToast(data.message || "Student profile updated successfully.", "success");
        loadStudentDetail();
      } else {
        setFormError(data.error || "Failed to update student profile.");
      }
    } catch {
      setFormError("Server error while updating student profile.");
    } finally {
      setFormSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!student) return;
    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/owner/students/${student.id}?yearId=${yearId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Deleted ${student.name} successfully.`, "success");
        setDeleteDialogOpen(false);
        router.push("/owner/students");
      } else {
        showToast(data.error || "Failed to delete student.", "danger");
      }
    } catch {
      showToast("Connection error while deleting student.", "danger");
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return (
      <OwnerShell pageTitle="Student Profile">
        <div className="flex flex-col gap-4">
          <Skeleton height="40px" width="160px" />
          <Skeleton height="160px" />
          <Skeleton height="120px" />
        </div>
      </OwnerShell>
    );
  }

  if (!student) {
    return (
      <OwnerShell pageTitle="Student Not Found">
        <EmptyState
          title="Student Record Not Found"
          description="The student you requested does not exist or may have been deleted."
          icon={<GraduationCap className="w-8 h-8" strokeWidth={1.75} />}
          action={
            <Button variant="primary" onClick={() => router.push("/owner/students")}>
              Return to Students
            </Button>
          }
        />
      </OwnerShell>
    );
  }

  const fee = student.admissionFee;
  const feeStatus = fee?.status || "unpaid";
  const feeChipStatus =
    feeStatus === "paid" ? "success" : feeStatus === "unpaid" ? "warning" : "neutral";
  const feeLabel =
    feeStatus === "paid" ? "Admission Paid" : feeStatus === "unpaid" ? "Admission Unpaid" : "Not Applicable";

  return (
    <OwnerShell pageTitle={student.name}>
      {/* Back Button */}
      <div className="mb-3">
        <Link
          href="/owner/students"
          className="inline-flex items-center gap-1.5 text-xs text-[#5F6670] hover:text-[#1C1F23] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          <span>Back to Student Directory</span>
        </Link>
      </div>

      <PageHeader
        title={student.name}
        subtitle={`${student.school} • ${student.grade} (${yearId})`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={openEditSheet} className="gap-1.5 text-xs h-9">
              <Edit className="w-4 h-4" strokeWidth={1.75} />
              <span>Edit Profile</span>
            </Button>
            <Button
              variant="danger"
              onClick={() => setDeleteDialogOpen(true)}
              className="gap-1.5 text-xs h-9"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              <span>Delete Student</span>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Profile & Admission Fee */}
        <div className="lg:col-span-5 space-y-4">
          {/* Profile Card */}
          <Card className="p-4 flex flex-col gap-3">
          <CardHeader className="p-0 border-b border-[#E4E1DA] pb-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                <CardTitle>Student Information</CardTitle>
              </div>
              <span className="text-[11px] font-mono text-[#5F6670]">ID: {student.id.substring(0, 10)}</span>
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[#5F6670] block">School</span>
              <span className="font-medium text-[#1C1F23] flex items-center gap-1.5 mt-0.5">
                <School className="w-3.5 h-3.5 text-[#5F6670]" strokeWidth={1.75} />
                {student.school}
              </span>
            </div>

            <div>
              <span className="text-[#5F6670] block">Grade for Year {yearId}</span>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="font-medium text-[#1F5C4D] flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-[#1F5C4D]" strokeWidth={1.75} />
                  {student.grade}
                </span>
                {(() => {
                  const subjectAbbrs = getDeduplicatedSubjectAbbreviations(
                    student.enrolledSubjects || enrolledClasses.map((c) => c.subject)
                  );
                  if (subjectAbbrs.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1 items-center">
                      {subjectAbbrs.map((abbr) => {
                        const theme = getClassColor({ subject: abbr });
                        return (
                          <span
                            key={abbr}
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide border select-none"
                            style={{
                              backgroundColor: theme.badgeBg,
                              borderColor: theme.badgeBorder,
                              color: theme.badgeText,
                            }}
                            title={abbr}
                          >
                            {abbr}
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="sm:col-span-2">
              <span className="text-[#5F6670] block">Residential Address</span>
              <span className="font-medium text-[#1C1F23] flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#5F6670] shrink-0" strokeWidth={1.75} />
                {student.address}
              </span>
            </div>

            <div>
              <span className="text-[#5F6670] block">Guardian</span>
              <span className="font-medium text-[#1C1F23] mt-0.5 block">{student.guardianName}</span>
              <span className="text-[#5F6670] tabular-nums flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-[#5F6670]" strokeWidth={1.75} />
                {student.guardianPhone}
              </span>
            </div>

            {student.studentPhone && (
              <div>
                <span className="text-[#5F6670] block">Student Direct Phone</span>
                <span className="font-medium text-[#1C1F23] tabular-nums flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3 text-[#5F6670]" strokeWidth={1.75} />
                  {student.studentPhone}
                </span>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#E4E1DA] flex items-center justify-between text-xs text-[#5F6670]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1F5C4D]" strokeWidth={1.75} />
              <span>
                Joined College: <strong>{formatColomboDate(student.joinedAt)}</strong>
              </span>
            </div>
            <span className="text-[11px] italic">Permanent record</span>
          </div>
        </Card>

        {/* Admission Fee Card */}
        <Card className="p-4 flex flex-col gap-3">
          <CardHeader className="p-0 border-b border-[#E4E1DA] pb-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                <CardTitle>Admission Fee</CardTitle>
              </div>
              <StatusChip status={feeChipStatus} label={feeLabel} />
            </div>
          </CardHeader>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[#5F6670] block">Amount</span>
              <span className="font-semibold text-sm text-[#1C1F23] tabular-nums mt-0.5 block">
                <MoneyText amount={fee?.amount ?? 0} />
              </span>
            </div>

            <div>
              <span className="text-[#5F6670] block">Status</span>
              <span className="font-medium text-[#1C1F23] capitalize mt-0.5 block">
                {feeStatus === "notApplicable" ? "Not Applicable" : feeStatus}
              </span>
            </div>

            {feeStatus === "paid" && (
              <>
                <div>
                  <span className="text-[#5F6670] block">Payment Method</span>
                  <span className="font-medium text-[#1C1F23] capitalize mt-0.5 block">
                    {fee?.method || "Cash"}
                  </span>
                </div>

                <div>
                  <span className="text-[#5F6670] block">Paid Date</span>
                  <span className="font-medium text-[#1C1F23] mt-0.5 block">
                    {fee?.paidDate ? formatColomboDate(fee.paidDate) : "Recorded"}
                  </span>
                </div>

                {fee?.receiptNo && (
                  <div className="col-span-2">
                    <span className="text-[#5F6670] block">Receipt Number</span>
                    <span className="font-mono text-xs text-[#1C1F23] mt-0.5 block">
                      {fee.receiptNo}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Right Column: Enrolled Classes & Fee History */}
      <div className="lg:col-span-7 space-y-4">
        {/* Current Classes in Active Year */}
        <Card className="p-4 flex flex-col gap-3">
          <CardHeader className="p-0 border-b border-[#E4E1DA] pb-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                <CardTitle>Enrolled Classes ({yearId})</CardTitle>
              </div>
              <span className="text-xs text-[#5F6670]">
                {enrolledClasses.length} class{enrolledClasses.length === 1 ? "" : "es"}
              </span>
            </div>
          </CardHeader>

          {enrolledClasses.length === 0 ? (
            <div className="py-4 text-center text-xs text-[#5F6670]">
              <p>Student is not currently enrolled in any classes for Year {yearId}.</p>
              <Link href="/owner/classes" className="inline-block mt-2 text-[#1F5C4D] font-medium hover:underline">
                Manage Class Enrolments &rarr;
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#E4E1DA]">
              {enrolledClasses.map((cls) => (
                <div key={cls.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-[#1C1F23]">{cls.name}</span>
                    <span className="text-[#5F6670] block">Teacher: {cls.teacherName || "Unassigned"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ClassBadge subject={cls.subject} name={cls.name} size="xs" />
                    <span className="px-2 py-0.5 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-[#5F6670]">
                      {cls.grade}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Fee History */}
        <Card className="p-4 flex flex-col gap-3">
          <CardHeader className="p-0 border-b border-[#E4E1DA] pb-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                <CardTitle>Fee History ({yearId})</CardTitle>
              </div>
              <span className="text-xs text-[#5F6670]">
                {feeHistory.length} record{feeHistory.length === 1 ? "" : "s"}
              </span>
            </div>
          </CardHeader>

          {feeHistory.length === 0 ? (
            <div className="py-6 text-center text-xs text-[#5F6670] bg-[#FAF9F6] rounded border border-[#E4E1DA] p-4">
              <Calendar className="w-6 h-6 text-[#5F6670] mx-auto mb-1.5 opacity-60" strokeWidth={1.75} />
              <p className="font-medium text-[#1C1F23]">No fee records found for this year</p>
              <p className="mt-1 text-[11px] text-[#5F6670] max-w-sm mx-auto">
                Fee records are created when the student is enrolled or when the Fees screen is opened for a month.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              <div className="divide-y divide-[#E4E1DA]">
                {feeHistory
                  .slice((feePage - 1) * feePageSize, feePage * feePageSize)
                  .map((fee) => {
                  const isPaid = fee.status === "paid";
                  return (
                    <div key={fee.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#1C1F23]">{fee.className || "Class Fee"}</span>
                          <StatusChip status={fee.status} />
                          <span className="text-[11px] font-mono bg-[#FAF9F6] border border-[#E4E1DA] px-1.5 py-0.5 rounded text-[#5F6670]">
                            {fee.month}
                          </span>
                        </div>

                        {fee.note && (
                          <div className="text-[11px] text-[#9A5B00] italic">
                            Note: {fee.note}
                          </div>
                        )}

                        {isPaid && (
                          <div className="text-[11px] text-[#1F5C4D] flex items-center gap-2">
                            <span className="uppercase font-semibold tracking-wider">{fee.paymentMethod || "Cash"}</span>
                            {fee.paidAt && <span>• {new Date(fee.paidAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>}
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
                            <MoneyText amount={fee.amount} />
                          </div>
                          <div className="text-[11px] text-[#5F6670]">
                            Share: <MoneyText amount={fee.teacherShare} />
                          </div>
                        </div>

                        {isPaid && fee.receiptNo && (
                          <a
                            href={`/api/owner/fees/receipt/${fee.receiptNo}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-xs font-medium text-[#1F5C4D] bg-[#E6F0EC] hover:bg-[#d0e4dc] border border-[#C2DDD4] rounded flex items-center gap-1 transition-colors"
                          >
                            PDF
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Pagination
                currentPage={feePage}
                totalItems={feeHistory.length}
                pageSize={feePageSize}
                onPageChange={setFeePage}
                pageSizeOptions={[8, 16, 24]}
                onPageSizeChange={setFeePageSize}
                itemLabel="records"
                compact
              />
            </div>
          )}
        </Card>
      </div>
    </div>

      {/* Edit Student Bottom Sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Edit Student Record"
      >
        <form onSubmit={handleUpdateStudent} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 text-xs text-[#A32A2A] bg-[#FBE9E7] border border-[#A32A2A]/20 rounded">
              {formError}
            </div>
          )}

          <div className="p-2.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded text-xs flex items-center gap-2 text-[#5F6670]">
            <ShieldCheck className="w-4 h-4 text-[#1F5C4D] shrink-0" strokeWidth={1.75} />
            <span>
              Joined College: <strong>{formatColomboDate(student.joinedAt)}</strong>. (Immutable creation date)
            </span>
          </div>

          <Field id="edit-detail-name" label="Full Name" required>
            <Input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="edit-detail-school" label="School Attending" required>
              <Input
                type="text"
                value={formSchool}
                onChange={(e) => setFormSchool(e.target.value)}
                required
              />
            </Field>

            <Field id="edit-detail-grade" label={`Grade for Year ${yearId}`} required>
              <Select
                value={formGrade}
                onChange={(e) => handleGradeChange(e.target.value)}
                required
              >
                {grades.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
                {!grades.some((g) => g.name === formGrade) && formGrade && (
                  <option value={formGrade}>{formGrade}</option>
                )}
              </Select>
            </Field>
          </div>

          <Field id="edit-detail-address" label="Residential Address" required>
            <Input
              type="text"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="edit-detail-guardian-name" label="Guardian Full Name" required>
              <Input
                type="text"
                value={formGuardianName}
                onChange={(e) => setFormGuardianName(e.target.value)}
                required
              />
            </Field>

            <Field id="edit-detail-guardian-phone" label="Guardian Contact Phone" required>
              <Input
                type="tel"
                value={formGuardianPhone}
                onChange={(e) => setFormGuardianPhone(e.target.value)}
                required
              />
            </Field>
          </div>

          <Field id="edit-detail-student-phone" label="Student Direct Phone" hint="Optional.">
            <Input
              type="tel"
              value={formStudentPhone}
              onChange={(e) => setFormStudentPhone(e.target.value)}
            />
          </Field>

          {/* Enrolling Classes Selection Card - Shows ONLY classes related to the selected grade */}
          <div className="p-3.5 border border-[#E4E1DA] rounded bg-[#FAF9F6] flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-xs text-[#1C1F23]">Enrolling Classes</h4>
                  <span className="bg-[#E6F0EC] text-[#1F5C4D] border border-[#1F5C4D]/20 px-2 py-0.5 rounded text-[10px] font-semibold tabular-nums">
                    {selectedClassIds.length} selected
                  </span>
                  {selectedClassIds.length > 0 && selectedClassesTotalMonthlyFee > 0 && (
                    <span className="bg-[#FFFFFF] text-[#1F5C4D] border border-[#1F5C4D]/30 px-2 py-0.5 rounded text-[10px] font-bold tabular-nums shadow-xs">
                      Total: <MoneyText amount={selectedClassesTotalMonthlyFee} />/mo
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#5F6670] mt-0.5">
                  Showing classes for <strong className="text-[#1C1F23]">{formGrade || "selected grade"}</strong> in Year {yearId}
                </p>
              </div>

              {relatedClasses.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const relatedIds = relatedClasses.map((c) => c.id);
                    const allSelected = relatedIds.every((id) => selectedClassIds.includes(id));
                    if (allSelected) {
                      setSelectedClassIds((prev) => prev.filter((id) => !relatedIds.includes(id)));
                    } else {
                      setSelectedClassIds((prev) => Array.from(new Set([...prev, ...relatedIds])));
                    }
                  }}
                  className="text-[11px] text-[#1F5C4D] hover:underline font-medium shrink-0 pt-0.5 cursor-pointer"
                >
                  {relatedClasses.every((c) => selectedClassIds.includes(c.id))
                    ? "Deselect All"
                    : "Select All"}
                </button>
              )}
            </div>

            {loadingClasses ? (
              <div className="flex flex-col gap-2">
                <Skeleton height="56px" />
                <Skeleton height="56px" />
              </div>
            ) : relatedClasses.length === 0 ? (
              <div className="p-4 bg-[#FFFFFF] border border-[#E4E1DA] rounded text-center text-xs text-[#5F6670]">
                <BookOpen className="w-5 h-5 mx-auto mb-1 text-[#5F6670]/60" strokeWidth={1.5} />
                <p className="font-medium text-[#1C1F23]">No active classes found for {formGrade}</p>
                <p className="text-[11px] mt-0.5 text-[#5F6670]">
                  Classes created for {formGrade} in Academic Year {yearId} will appear here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-0.5">
                {relatedClasses.map((cls) => {
                  const isSelected = selectedClassIds.includes(cls.id);
                  const fee = cls.currentTerms?.monthlyFee;
                  const slots = cls.slots || [];

                  return (
                    <div
                      key={cls.id}
                      onClick={() => {
                        setSelectedClassIds((prev) =>
                          isSelected ? prev.filter((id) => id !== cls.id) : [...prev, cls.id]
                        );
                      }}
                      className={`p-2.5 rounded border transition-colors cursor-pointer select-none flex items-start gap-3 ${
                        isSelected
                          ? "bg-[#E6F0EC] border-[#1F5C4D]/40 text-[#1C1F23]"
                          : "bg-[#FFFFFF] border-[#E4E1DA] hover:border-[#1F5C4D]/30 text-[#1C1F23]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // handled by parent div onClick
                        className="mt-0.5 w-4 h-4 rounded text-[#1F5C4D] focus:ring-[#1F5C4D] border-[#E4E1DA] cursor-pointer shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-xs text-[#1C1F23] truncate">
                            {cls.name || `${cls.grade} ${cls.subject}`}
                          </span>
                          {fee ? (
                            <span className="text-[11px] font-semibold text-[#1F5C4D] tabular-nums shrink-0">
                              <MoneyText amount={fee} />/mo
                            </span>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-[#5F6670]">
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3 h-3 text-[#1F5C4D] shrink-0" strokeWidth={1.75} />
                            <span className="truncate">{cls.teacherName || "Unassigned"}</span>
                          </span>

                          {slots.length > 0 ? (
                            <span className="flex items-center gap-1 text-[11px]">
                              <Clock className="w-3 h-3 text-[#5F6670] shrink-0" strokeWidth={1.75} />
                              <span className="tabular-nums font-mono text-[10.5px]">
                                {slots
                                  .map((s) => `${getWeekdayName(s.weekday).slice(0, 3)} ${formatTimeRange(s.startTime, s.endTime)}`)
                                  .join(", ")}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[#5F6670]/80 italic">No schedule set</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedClassIds.length > 0 && (
              <div className="pt-2.5 border-t border-[#E4E1DA] flex items-center justify-between text-xs">
                <span className="text-[#5F6670] text-[11px] font-medium">
                  Total Monthly Fee ({selectedClassIds.length} {selectedClassIds.length === 1 ? "class" : "classes"}):
                </span>
                <span className="font-bold text-[#1F5C4D] tabular-nums text-xs">
                  <MoneyText amount={selectedClassesTotalMonthlyFee} />/mo
                </span>
              </div>
            )}
          </div>

          {/* Admission Fee */}
          <div className="p-3.5 border border-[#E4E1DA] rounded bg-[#FAF9F6] flex flex-col gap-3">
            <h4 className="font-semibold text-xs text-[#1C1F23]">Admission Fee</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="edit-detail-fee-status" label="Fee Status" required>
                <Select
                  value={formFeeStatus}
                  onChange={(e) => setFormFeeStatus(e.target.value as AdmissionFeeStatus)}
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="notApplicable">Not Applicable</option>
                </Select>
              </Field>

              <Field id="edit-detail-fee-amount" label="Amount (LKR)">
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={formFeeAmount}
                  onChange={(e) => setFormFeeAmount(Number(e.target.value))}
                />
              </Field>
            </div>

            {formFeeStatus === "paid" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#E4E1DA]">
                <Field id="edit-detail-fee-method" label="Method">
                  <Select
                    value={formFeeMethod}
                    onChange={(e) => setFormFeeMethod(e.target.value as PaymentMethod)}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                  </Select>
                </Field>

                <Field id="edit-detail-fee-date" label="Paid Date">
                  <Input
                    type="date"
                    value={formFeePaidDate}
                    onChange={(e) => setFormFeePaidDate(e.target.value)}
                  />
                </Field>

                <Field id="edit-detail-fee-receipt" label="Receipt No.">
                  <Input
                    type="text"
                    value={formFeeReceiptNo}
                    onChange={(e) => setFormFeeReceiptNo(e.target.value)}
                  />
                </Field>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSheetOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={formSaving}
              className="flex-1"
            >
              {formSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </BottomSheet>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Student"
        description={`Are you sure you want to delete ${student.name}? If this student has paid fees or recorded attendance, their financial records will be safely preserved and they will be removed from all active class enrolments and the roster. If they have no history, their record will be permanently deleted.`}
        confirmLabel="Delete Student"
        variant="danger"
        loading={deleteLoading}
      />

      {toastMessage && (
        <Toast
          message={toastMessage}
          variant={toastVariant}
          onDismiss={() => setToastMessage("")}
        />
      )}
    </OwnerShell>
  );
}
