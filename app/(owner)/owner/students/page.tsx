"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
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
import { DataTable, type ColumnDef } from "@/components/ui/DataTable";
import {
  GraduationCap,
  Plus,
  Phone,
  School,
  Calendar,
  ChevronRight,
  Edit,
  User,
  ShieldAlert,
} from "lucide-react";
import type { Student, AcademicGrade, AdmissionFeeStatus, PaymentMethod } from "@/types";
import { formatColomboDate } from "@/lib/dates";

export default function OwnerStudentsPage() {
  const [students, setStudents] = useState<Array<Student & { grade: string }>>([]);
  const [grades, setGrades] = useState<AcademicGrade[]>([]);
  const [activeYear, setActiveYear] = useState<string>("2026");
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("all");

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<ToastVariant>("info");

  // Add / Edit BottomSheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<(Student & { grade: string }) | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formSchool, setFormSchool] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formGuardianName, setFormGuardianName] = useState("");
  const [formGuardianPhone, setFormGuardianPhone] = useState("");
  const [formStudentPhone, setFormStudentPhone] = useState("");
  const [formGrade, setFormGrade] = useState("Grade 10");

  // Admission Fee
  const [formFeeStatus, setFormFeeStatus] = useState<AdmissionFeeStatus>("unpaid");
  const [formFeeAmount, setFormFeeAmount] = useState<number>(2000);
  const [formFeeMethod, setFormFeeMethod] = useState<PaymentMethod>("cash");
  const [formFeePaidDate, setFormFeePaidDate] = useState("");
  const [formFeeReceiptNo, setFormFeeReceiptNo] = useState("");

  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    loadStudents();
    loadGrades();
  }, [selectedGrade]);

  async function loadStudents() {
    try {
      setLoading(true);
      const url = new URL("/api/owner/students", window.location.origin);
      if (selectedGrade && selectedGrade !== "all") {
        url.searchParams.set("grade", selectedGrade);
      }
      if (search.trim()) {
        url.searchParams.set("search", search.trim());
      }

      const res = await fetch(url.toString());
      const data = await res.json();
      if (res.ok) {
        setStudents(data.students || []);
        if (data.yearId) setActiveYear(data.yearId);
      } else {
        showToast(data.error || "Failed to load students.", "danger");
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
        if (sortedGrades.length > 0 && !formGrade) {
          setFormGrade(sortedGrades[0].name);
        }
      }
    } catch {}
  }

  function showToast(message: string, variant: ToastVariant = "info") {
    setToastMessage(message);
    setToastVariant(variant);
  }

  function openAddSheet() {
    setEditingStudent(null);
    setFormName("");
    setFormSchool("");
    setFormAddress("");
    setFormGuardianName("");
    setFormGuardianPhone("");
    setFormStudentPhone("");
    setFormGrade(grades[9]?.name || "Grade 10");
    setFormFeeStatus("unpaid");
    setFormFeeAmount(2000);
    setFormFeeMethod("cash");
    setFormFeePaidDate("");
    setFormFeeReceiptNo("");
    setFormError("");
    setSheetOpen(true);
  }

  function openEditSheet(student: Student & { grade: string }) {
    setEditingStudent(student);
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

  async function handleSaveStudent(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!formName.trim()) {
      setFormError("Student full name is required.");
      return;
    }
    if (!formSchool.trim()) {
      setFormError("School name is required.");
      return;
    }
    if (!formAddress.trim()) {
      setFormError("Address is required.");
      return;
    }
    if (!formGuardianName.trim()) {
      setFormError("Guardian name is required.");
      return;
    }
    if (!formGuardianPhone.trim()) {
      setFormError("Guardian phone number is required.");
      return;
    }
    if (!formGrade.trim()) {
      setFormError("Grade level is required.");
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
        yearId: activeYear,
        admissionFee: {
          amount: Number(formFeeAmount) || 0,
          status: formFeeStatus,
          method: formFeeStatus === "paid" ? formFeeMethod : undefined,
          paidDate: formFeeStatus === "paid" && formFeePaidDate ? formFeePaidDate : undefined,
          receiptNo: formFeeStatus === "paid" && formFeeReceiptNo ? formFeeReceiptNo.trim() : undefined,
        },
      };

      if (editingStudent) {
        // Edit student
        const res = await fetch(`/api/owner/students/${editingStudent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          setSheetOpen(false);
          showToast("Student profile updated successfully.", "success");
          loadStudents();
        } else {
          setFormError(data.error || "Failed to update student.");
        }
      } else {
        // Create new student
        const res = await fetch("/api/owner/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          setSheetOpen(false);
          showToast("Student registered successfully.", "success");
          loadStudents();
        } else {
          setFormError(data.error || "Failed to register student.");
        }
      }
    } catch {
      setFormError("Server connection error while saving student.");
    } finally {
      setFormSaving(false);
    }
  }

  // Filter students locally on search query as user types
  const filteredStudents = students.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const nameMatch = s.name.toLowerCase().includes(q);
    const schoolMatch = s.school.toLowerCase().includes(q);
    const guardMatch = s.guardianName.toLowerCase().includes(q);
    const phoneMatch =
      s.guardianPhone.toLowerCase().includes(q) || (s.studentPhone && s.studentPhone.includes(q));
    return nameMatch || schoolMatch || guardMatch || phoneMatch;
  });

  const columns: ColumnDef<Student & { grade: string }>[] = [
    {
      key: "name",
      header: "Student",
      sortable: true,
      render: (s) => (
        <div>
          <Link
            href={`/owner/students/${s.id}`}
            className="font-semibold text-sm text-[#1C1F23] hover:text-[#1F5C4D] transition-colors"
          >
            {s.name}
          </Link>
          <div className="text-[11px] text-[#5F6670] mt-0.5">
            Joined {formatColomboDate(s.joinedAt)}
          </div>
        </div>
      ),
    },
    {
      key: "grade",
      header: "Grade",
      sortable: true,
      render: (s) => (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#E6F0EC] text-[#1F5C4D] border border-[#1F5C4D]/20">
          {s.grade}
        </span>
      ),
    },
    {
      key: "school",
      header: "School",
      sortable: true,
      render: (s) => <span className="text-xs text-[#5F6670]">{s.school}</span>,
    },
    {
      key: "guardianName",
      header: "Guardian & Phone",
      render: (s) => (
        <div>
          <div className="font-medium text-[#1C1F23]">{s.guardianName}</div>
          <div className="text-[11px] text-[#5F6670] tabular-nums">{s.guardianPhone}</div>
        </div>
      ),
    },
    {
      key: "admissionFee",
      header: "Admission Fee",
      render: (s) => {
        const fee = s.admissionFee;
        const feeStatus = fee?.status || "unpaid";
        const feeChipStatus =
          feeStatus === "paid" ? "success" : feeStatus === "unpaid" ? "warning" : "neutral";
        const feeLabel =
          feeStatus === "paid" ? "Paid" : feeStatus === "unpaid" ? "Unpaid" : "N/A";
        return (
          <div className="flex flex-col gap-0.5">
            <StatusChip status={feeChipStatus} label={feeLabel} />
            {feeStatus === "paid" && fee?.amount ? (
              <span className="text-[11px] text-[#5F6670] tabular-nums">
                <MoneyText amount={fee.amount} />
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (s) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="secondary"
            className="text-xs h-7 px-2"
            onClick={(e) => {
              e.stopPropagation();
              openEditSheet(s);
            }}
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit</span>
          </Button>
          <Link href={`/owner/students/${s.id}`}>
            <Button variant="secondary" className="text-xs h-7 px-2 text-[#1F5C4D]">
              <span>Profile</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <OwnerShell pageTitle={`Students (${activeYear})`}>
      <PageContainer variant="default">
        <PageHeader
          title={`Student Directory (${activeYear})`}
          subtitle="Manage permanent student records, grade assignments and admission fees"
          action={
            <Button variant="primary" onClick={openAddSheet} className="gap-1.5">
              <Plus className="w-4 h-4" strokeWidth={2} />
              <span>Add Student</span>
            </Button>
          }
        />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="flex-1">
          <Input
            type="search"
            placeholder="Search by student name, school, guardian or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="w-full sm:w-48 shrink-0">
          <Select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
          >
            <option value="all">All Grades</option>
            {grades.map((g) => (
              <option key={g.id} value={g.name}>
                {g.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Count Indicator */}
      <div className="flex items-center justify-between text-xs text-[#5F6670] mb-3 px-1">
        <span>
          Showing <strong>{filteredStudents.length}</strong> students in Year {activeYear}
        </span>
        {selectedGrade !== "all" && (
          <span className="bg-[#E6F0EC] text-[#1F5C4D] px-2 py-0.5 rounded font-medium">
            {selectedGrade}
          </span>
        )}
      </div>

      {/* Student List */}
      <DataTable
        data={filteredStudents}
        columns={columns}
        keyExtractor={(s) => s.id}
        loading={loading}
        emptyState={
          <EmptyState
            title={search || selectedGrade !== "all" ? "No matching students found" : "No students registered"}
            description={
              search || selectedGrade !== "all"
                ? "Try adjusting your search query or grade filter."
                : `Add your first student for Academic Year ${activeYear}.`
            }
            icon={<GraduationCap className="w-8 h-8" strokeWidth={1.75} />}
            action={
              !search && selectedGrade === "all" ? (
                <Button variant="primary" onClick={openAddSheet}>
                  Add Student
                </Button>
              ) : undefined
            }
          />
        }
        renderMobileCard={(student) => {
          const fee = student.admissionFee;
          const feeStatus = fee?.status || "unpaid";
          const feeChipStatus =
            feeStatus === "paid" ? "success" : feeStatus === "unpaid" ? "warning" : "neutral";
          const feeLabel =
            feeStatus === "paid" ? "Admission Paid" : feeStatus === "unpaid" ? "Admission Unpaid" : "N/A";

          return (
            <Card className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/owner/students/${student.id}`}
                      className="font-semibold text-sm text-[#1C1F23] hover:text-[#1F5C4D] transition-colors"
                    >
                      {student.name}
                    </Link>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#E6F0EC] text-[#1F5C4D] border border-[#1F5C4D]/20">
                      {student.grade}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#5F6670] mt-1">
                    <School className="w-3.5 h-3.5 text-[#5F6670] shrink-0" strokeWidth={1.75} />
                    <span className="truncate">{student.school}</span>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1">
                  <StatusChip status={feeChipStatus} label={feeLabel} />
                  {feeStatus === "paid" && fee?.amount ? (
                    <span className="text-[11px] text-[#5F6670] tabular-nums">
                      <MoneyText amount={fee.amount} />
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#5F6670] pt-2 border-t border-[#E4E1DA] bg-[#FAF9F6] p-2.5 rounded">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#5F6670] shrink-0" strokeWidth={1.75} />
                  <span>
                    Guardian: <strong className="text-[#1C1F23]">{student.guardianName}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 tabular-nums">
                  <Phone className="w-3.5 h-3.5 text-[#5F6670] shrink-0" strokeWidth={1.75} />
                  <span>{student.guardianPhone}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <div className="flex items-center gap-1 text-[11px] text-[#5F6670]">
                  <Calendar className="w-3 h-3" strokeWidth={1.75} />
                  <span>Joined: {formatColomboDate(student.joinedAt)}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="quiet"
                    onClick={() => openEditSheet(student)}
                    className="text-xs h-7 px-2 gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>Edit</span>
                  </Button>

                  <Link href={`/owner/students/${student.id}`}>
                    <Button variant="secondary" className="text-xs h-7 px-2 gap-1 text-[#1F5C4D]">
                      <span>Profile</span>
                      <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          );
        }}
      />

      {/* Add / Edit Student Bottom Sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingStudent ? "Edit Student Record" : "Register Student"}
      >
        <form onSubmit={handleSaveStudent} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 text-xs text-[#A32A2A] bg-[#FBE9E7] border border-[#A32A2A]/20 rounded">
              {formError}
            </div>
          )}

          {editingStudent && (
            <div className="p-2.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded text-xs flex items-center gap-2 text-[#5F6670]">
              <ShieldAlert className="w-4 h-4 text-[#1F5C4D] shrink-0" strokeWidth={1.75} />
              <span>
                Permanent registration: <strong>Joined {formatColomboDate(editingStudent.joinedAt)}</strong>. (Immutable)
              </span>
            </div>
          )}

          <Field id="student-name" label="Full Name" required>
            <Input
              type="text"
              placeholder="e.g. Kasun Mihiranga Perera"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="student-school" label="School Attending" required>
              <Input
                type="text"
                placeholder="e.g. Ananda College"
                value={formSchool}
                onChange={(e) => setFormSchool(e.target.value)}
                required
              />
            </Field>

            <Field id="student-grade" label={`Grade for Year ${activeYear}`} required>
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

          <Field id="student-address" label="Residential Address" required>
            <Input
              type="text"
              placeholder="e.g. No 45, High Level Road, Nugegoda"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="student-guardian-name" label="Guardian Full Name" required>
              <Input
                type="text"
                placeholder="e.g. Sunil Perera"
                value={formGuardianName}
                onChange={(e) => setFormGuardianName(e.target.value)}
                required
              />
            </Field>

            <Field id="student-guardian-phone" label="Guardian Contact Phone" required>
              <Input
                type="tel"
                placeholder="e.g. 077 123 4567"
                value={formGuardianPhone}
                onChange={(e) => setFormGuardianPhone(e.target.value)}
                required
              />
            </Field>
          </div>

          <Field id="student-phone" label="Student Phone Number" hint="Optional. Direct contact number for older students.">
            <Input
              type="tel"
              placeholder="e.g. 071 987 6543 (optional)"
              value={formStudentPhone}
              onChange={(e) => setFormStudentPhone(e.target.value)}
            />
          </Field>

          {/* Admission Fee Card */}
          <div className="p-3.5 border border-[#E4E1DA] rounded bg-[#FAF9F6] flex flex-col gap-3">
            <div>
              <h4 className="font-semibold text-xs text-[#1C1F23]">Admission Fee</h4>
              <p className="text-[11px] text-[#5F6670]">One-time fee per student (defaults to unpaid for new students)</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="student-fee-status" label="Fee Status" required>
                <Select
                  value={formFeeStatus}
                  onChange={(e) => setFormFeeStatus(e.target.value as AdmissionFeeStatus)}
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="notApplicable">Not Applicable</option>
                </Select>
              </Field>

              <Field id="student-fee-amount" label="Amount (LKR)">
                <Input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="2000"
                  value={formFeeAmount}
                  onChange={(e) => setFormFeeAmount(Number(e.target.value))}
                />
              </Field>
            </div>

            {formFeeStatus === "paid" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#E4E1DA]">
                <Field id="student-fee-method" label="Payment Method">
                  <Select
                    value={formFeeMethod}
                    onChange={(e) => setFormFeeMethod(e.target.value as PaymentMethod)}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank">Bank Deposit / Transfer</option>
                  </Select>
                </Field>

                <Field id="student-fee-date" label="Paid Date">
                  <Input
                    type="date"
                    value={formFeePaidDate}
                    onChange={(e) => setFormFeePaidDate(e.target.value)}
                  />
                </Field>

                <Field id="student-fee-receipt" label="Receipt No.">
                  <Input
                    type="text"
                    placeholder="e.g. REC-1042"
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
              {formSaving ? "Saving..." : editingStudent ? "Update Student" : "Register Student"}
            </Button>
          </div>
        </form>
      </BottomSheet>

      {toastMessage && (
        <Toast
          message={toastMessage}
          variant={toastVariant}
          onDismiss={() => setToastMessage("")}
          floating
        />
      )}
      </PageContainer>
    </OwnerShell>
  );
}
