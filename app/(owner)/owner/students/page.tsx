"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast, type ToastVariant } from "@/components/ui/Toast";
import { MoneyText } from "@/components/ui/MoneyText";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
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
  Trash2,
  BookOpen,
  Clock,
  Check,
} from "lucide-react";
import type { Student, AcademicGrade, AdmissionFeeStatus, PaymentMethod, ClassItem } from "@/types";
import { formatColomboDate, formatTimeRange, getWeekdayName } from "@/lib/dates";
import { getDeduplicatedSubjectAbbreviations } from "@/lib/students";
import { getClassColor } from "@/lib/class-colors";

export default function OwnerStudentsPage() {
  const [students, setStudents] = useState<Array<Student & { grade: string }>>([]);
  const [grades, setGrades] = useState<AcademicGrade[]>([]);
  const [activeYear, setActiveYear] = useState<string>("");
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

  // Delete Confirmation state
  const [deletingStudent, setDeletingStudent] = useState<(Student & { grade: string }) | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formSchool, setFormSchool] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formGuardianName, setFormGuardianName] = useState("");
  const [formGuardianPhone, setFormGuardianPhone] = useState("");
  const [formStudentPhone, setFormStudentPhone] = useState("");
  const [formGrade, setFormGrade] = useState("Grade 06");

  // Classes state for enrolment
  const [availableClasses, setAvailableClasses] = useState<ClassItem[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

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
    loadClasses();
  }, [selectedGrade]);

  async function loadClasses(yearToLoad?: string) {
    try {
      setLoadingClasses(true);
      const y = yearToLoad || activeYear;
      if (!y) return;
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
        if (data.yearId) {
          setActiveYear(data.yearId);
          loadClasses(data.yearId);
        }
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
    setSelectedClassIds((prev) =>
      prev.filter((cId) => {
        const c = availableClasses.find((item) => item.id === cId);
        return c && c.grade.trim().toLowerCase() === newGrade.trim().toLowerCase();
      })
    );
  }

  function openAddSheet() {
    setEditingStudent(null);
    setFormName("");
    setFormSchool("");
    setFormAddress("");
    setFormGuardianName("");
    setFormGuardianPhone("");
    setFormStudentPhone("");
    const initialGrade = grades[0]?.name || "Grade 06";
    setFormGrade(initialGrade);
    setSelectedClassIds([]);
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
    const matchingGrade = grades.find(
      (g) => g.name.toLowerCase() === (student.grade || "").toLowerCase()
    );
    const chosenGrade = matchingGrade
      ? matchingGrade.name
      : student.grade && student.grade !== "Not Enrolled"
      ? student.grade
      : grades[0]?.name || "Grade 06";
    setFormGrade(chosenGrade);
    setSelectedClassIds([]);

    // Fetch student's currently enrolled classes for the active academic year
    const targetYear = activeYear || "2027";
    setLoadingClasses(true);
    fetch(`/api/owner/students/${student.id}?yearId=${targetYear}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.enrolledClasses && Array.isArray(data.enrolledClasses)) {
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
        enrolledClassIds: selectedClassIds,
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
          showToast(data.message || "Student profile updated successfully.", "success");
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
          showToast(data.message || "Student registered successfully.", "success");
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

  async function handleConfirmDelete() {
    if (!deletingStudent) return;
    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/owner/students/${deletingStudent.id}?yearId=${activeYear}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Deleted ${deletingStudent.name} successfully.`, "success");
        setDeletingStudent(null);
        loadStudents();
      } else {
        showToast(data.error || "Failed to delete student.", "danger");
      }
    } catch {
      showToast("Connection error while deleting student.", "danger");
    } finally {
      setDeleteLoading(false);
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

  // Filter available classes to show ONLY classes related to the selected grade
  const relatedClasses = availableClasses.filter(
    (c) => c.active !== false && c.grade.trim().toLowerCase() === formGrade.trim().toLowerCase()
  );

  // Total monthly fee of all currently selected classes
  const selectedClassesTotalMonthlyFee = availableClasses
    .filter((c) => selectedClassIds.includes(c.id))
    .reduce((sum, c) => sum + (c.currentTerms?.monthlyFee || 0), 0);

  return (
    <OwnerShell pageTitle={activeYear ? `Students (${activeYear})` : "Students"}>
      <PageHeader
        title={activeYear ? `Student Directory (${activeYear})` : "Student Directory"}
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
          Total: <strong>{filteredStudents.length}</strong> students in Year {activeYear}
        </span>
        {selectedGrade !== "all" && (
          <span className="bg-[#E6F0EC] text-[#1F5C4D] px-2 py-0.5 rounded font-medium">
            {selectedGrade}
          </span>
        )}
      </div>

      {/* Student List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton height="96px" />
          <Skeleton height="96px" />
          <Skeleton height="96px" />
        </div>
      ) : (
        <DataTable
          data={filteredStudents}
          keyExtractor={(s) => s.id}
          pageSize={10}
          pageSizeOptions={[10, 20, 50]}
          itemLabel="students"
          columns={[
            {
              key: "name",
              header: "Student & School",
              render: (student) => (
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link
                      href={`/owner/students/${student.id}`}
                      className="font-semibold text-sm text-[#1C1F23] hover:text-[#1F5C4D] transition-colors"
                    >
                      {student.name}
                    </Link>
                    {student.admissionFee?.status === "unpaid" && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] shrink-0"
                        title="Admission Fee Unpaid"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] shrink-0" />
                        <span>Admission Unpaid</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#5F6670] mt-0.5">
                    <School className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                    <span className="truncate">{student.school || "School Not Specified"}</span>
                  </div>
                </div>
              ),
            },
            {
              key: "grade",
              header: "Grade & Subjects",
              render: (student) => {
                const subjectAbbrs = getDeduplicatedSubjectAbbreviations(student.enrolledSubjects);
                return (
                  <div className="flex flex-col items-start gap-1">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-medium bg-[#E6F0EC] text-[#1F5C4D] border border-[#1F5C4D]/20">
                      {student.grade}
                    </span>
                    {subjectAbbrs.length > 0 && (
                      <div className="flex flex-wrap gap-1 items-center max-w-[180px]">
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
                    )}
                  </div>
                );
              },
            },
            {
              key: "guardian",
              header: "Guardian Contact",
              render: (student) => (
                <div className="text-xs">
                  <div className="font-medium text-[#1C1F23]">{student.guardianName}</div>
                  <div className="text-[#5F6670] tabular-nums flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-[#5F6670]" />
                    <span>{student.guardianPhone}</span>
                  </div>
                </div>
              ),
            },
            {
              key: "joinedAt",
              header: "Joined Date",
              render: (student) => (
                <span className="text-xs text-[#5F6670] tabular-nums">
                  {formatColomboDate(student.joinedAt)}
                </span>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              align: "right",
              render: (student) => (
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditSheet(student)}
                    title={`Edit ${student.name}`}
                    aria-label={`Edit ${student.name}`}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-[#5F6670] hover:text-[#1F5C4D] hover:bg-[#E6F0EC] border border-[#E4E1DA] hover:border-[#1F5C4D]/30 transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingStudent(student)}
                    title={`Delete ${student.name}`}
                    aria-label={`Delete ${student.name}`}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7] border border-[#E4E1DA] hover:border-[#A32A2A]/30 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                  <Link href={`/owner/students/${student.id}`}>
                    <Button variant="secondary" className="text-xs h-8 px-2.5 gap-1 text-[#1F5C4D]">
                      <span>Profile</span>
                      <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </Button>
                  </Link>
                </div>
              ),
            },
          ]}
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
          renderCard={(student) => {
            const isUnpaid = student.admissionFee?.status === "unpaid";

            return (
              <Card key={student.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
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

                    {(() => {
                      const subjectAbbrs = getDeduplicatedSubjectAbbreviations(student.enrolledSubjects);
                      if (subjectAbbrs.length === 0) return null;
                      return (
                        <div className="flex flex-wrap gap-1 items-center mt-1">
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
                              >
                                {abbr}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}

                    <div className="flex items-center gap-1.5 text-xs text-[#5F6670] mt-1">
                      <School className="w-3.5 h-3.5 text-[#5F6670] shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{student.school}</span>
                    </div>
                  </div>

                  {isUnpaid && (
                    <div className="shrink-0">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] shrink-0"
                        title="Admission Fee Unpaid"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] shrink-0" />
                        <span>Admission Unpaid</span>
                      </span>
                    </div>
                  )}
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

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditSheet(student)}
                      title={`Edit ${student.name}`}
                      aria-label={`Edit ${student.name}`}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-[#5F6670] hover:text-[#1F5C4D] hover:bg-[#E6F0EC] border border-[#E4E1DA] hover:border-[#1F5C4D]/30 transition-colors cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingStudent(student)}
                      title={`Delete ${student.name}`}
                      aria-label={`Delete ${student.name}`}
                      className="w-8 h-8 rounded-md flex items-center justify-center text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7] border border-[#E4E1DA] hover:border-[#A32A2A]/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>

                    <Link href={`/owner/students/${student.id}`}>
                      <Button variant="secondary" className="text-xs h-8 px-2.5 gap-1 text-[#1F5C4D]">
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
      )}

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
                  Showing classes for <strong className="text-[#1C1F23]">{formGrade || "selected grade"}</strong> in Year {activeYear}
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
                  Classes created for {formGrade} in Academic Year {activeYear} will appear here.
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

      <ConfirmDialog
        open={Boolean(deletingStudent)}
        onClose={() => setDeletingStudent(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Student"
        description={`Are you sure you want to delete ${deletingStudent?.name || "this student"}? If this student has paid fees or recorded attendance, their financial records will be safely preserved and they will be removed from all active class enrolments and the roster. If they have no history, their record will be permanently deleted.`}
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
