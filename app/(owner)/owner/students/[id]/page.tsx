"use client";

import React, { useState, useEffect } from "react";
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
import { Toast, type ToastVariant } from "@/components/ui/Toast";
import { MoneyText } from "@/components/ui/MoneyText";
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
} from "lucide-react";
import type { Student, AcademicGrade, AdmissionFeeStatus, PaymentMethod, FeeRecord } from "@/types";
import { formatColomboDate } from "@/lib/dates";

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

  // Edit BottomSheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formSchool, setFormSchool] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formGuardianName, setFormGuardianName] = useState("");
  const [formGuardianPhone, setFormGuardianPhone] = useState("");
  const [formStudentPhone, setFormStudentPhone] = useState("");
  const [formGrade, setFormGrade] = useState("");

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

  useEffect(() => {
    if (studentId) {
      loadStudentDetail();
      loadGrades();
    }
  }, [studentId]);

  async function loadStudentDetail() {
    try {
      setLoading(true);
      const res = await fetch(`/api/owner/students/${studentId}`);
      const data = await res.json();
      if (res.ok) {
        setStudent(data.student);
        setEnrolledClasses(data.enrolledClasses || []);
        setFeeHistory(data.feeHistory || []);
        if (data.yearId) setYearId(data.yearId);
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
        setGrades(
          (data.grades as AcademicGrade[])
            .filter((g) => !g.hidden)
            .sort((a, b) => a.order - b.order)
        );
      }
    } catch {}
  }

  function showToast(message: string, variant: ToastVariant = "info") {
    setToastMessage(message);
    setToastVariant(variant);
  }

  function openEditSheet() {
    if (!student) return;
    setFormName(student.name);
    setFormSchool(student.school);
    setFormAddress(student.address);
    setFormGuardianName(student.guardianName);
    setFormGuardianPhone(student.guardianPhone);
    setFormStudentPhone(student.studentPhone || "");
    setFormGrade(student.grade || "Grade 10");

    const fee = student.admissionFee || {};
    setFormFeeStatus(fee.status || "unpaid");
    setFormFeeAmount(fee.amount ?? 2000);
    setFormFeeMethod(fee.method || "cash");
    setFormFeePaidDate(fee.paidDate || "");
    setFormFeeReceiptNo(fee.receiptNo || "");

    setFormError("");
    setSheetOpen(true);
  }

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
        showToast("Student profile updated successfully.", "success");
        loadStudentDetail();
      } else {
        setFormError(data.error || "Failed to update student.");
      }
    } catch {
      setFormError("Connection error while updating student.");
    } finally {
      setFormSaving(false);
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
          <Button variant="secondary" onClick={openEditSheet} className="gap-1.5">
            <Edit className="w-4 h-4" strokeWidth={1.75} />
            <span>Edit Profile</span>
          </Button>
        }
      />

      <div className="flex flex-col gap-4">
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
              <span className="font-medium text-[#1F5C4D] flex items-center gap-1.5 mt-0.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#1F5C4D]" strokeWidth={1.75} />
                {student.grade}
              </span>
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
                  <span className="px-2 py-0.5 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-[#5F6670]">
                    {cls.grade}
                  </span>
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
            <div className="divide-y divide-[#E4E1DA]">
              {feeHistory.map((fee) => {
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
          )}
        </Card>
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
                onChange={(e) => setFormGrade(e.target.value)}
                required
              >
                {grades.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
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
