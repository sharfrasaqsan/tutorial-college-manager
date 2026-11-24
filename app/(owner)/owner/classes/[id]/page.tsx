"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast, type ToastVariant } from "@/components/ui/Toast";
import { MoneyText } from "@/components/ui/MoneyText";
import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Users,
  Coins,
  History,
  Calendar,
  Plus,
  UserMinus,
  Edit,
  Clock,
  AlertCircle,
  School,
  Check,
} from "lucide-react";
import type { ClassItem, ClassTerms, ClassEnrolment, Student } from "@/types";
import { calculateOwnerShare } from "@/lib/classes";
import { getCurrentMonthKey, formatMonthDisplay } from "@/lib/dates";

export default function OwnerClassDetailPage() {
  const params = useParams();
  const router = useRouter();
  const classId = params?.id as string;

  const [classItem, setClassItem] = useState<ClassItem | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<ClassEnrolment[]>([]);
  const [sessionProgress, setSessionProgress] = useState<{
    month: string;
    heldSessions: number;
    requiredSessions: number;
    status: string;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<ToastVariant>("info");

  // Update Terms Sheet
  const [termsSheetOpen, setTermsSheetOpen] = useState(false);
  const [editFee, setEditFee] = useState<number>(3000);
  const [editTeacherShare, setEditTeacherShare] = useState<number>(2000);
  const [editRequiredSessions, setEditRequiredSessions] = useState<number>(8);
  const [editEffectiveMonth, setEditEffectiveMonth] = useState<string>(getCurrentMonthKey());
  const [termsSaving, setTermsSaving] = useState(false);
  const [termsError, setTermsError] = useState("");

  // Enroll Students Sheet
  const [enrollSheetOpen, setEnrollSheetOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<Array<Student & { grade: string }>>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [enrollJoinedMonth, setEnrollJoinedMonth] = useState<string>(getCurrentMonthKey());
  const [showAllGrades, setShowAllGrades] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState("");

  // Remove Enrolment Dialog
  const [removeDialogStudent, setRemoveDialogStudent] = useState<ClassEnrolment | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (classId) {
      loadClassDetail();
    }
  }, [classId]);

  async function loadClassDetail() {
    try {
      setLoading(true);
      const res = await fetch(`/api/owner/classes/${classId}`);
      const data = await res.json();
      if (res.ok) {
        setClassItem(data.classItem);
        setEnrolledStudents(data.enrolledStudents || []);
        setSessionProgress(data.sessionProgress || null);
      } else {
        showToast(data.error || "Failed to load class.", "danger");
      }
    } catch {
      showToast("Unable to connect to server.", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function loadAllStudentsForEnrolment() {
    try {
      const yearId = classItem?.yearId || "2026";
      const res = await fetch(`/api/owner/students?yearId=${yearId}`);
      const data = await res.json();
      if (res.ok && data.students) {
        setAllStudents(data.students);
      }
    } catch {}
  }

  function showToast(message: string, variant: ToastVariant = "info") {
    setToastMessage(message);
    setToastVariant(variant);
  }

  function openTermsSheet() {
    if (!classItem) return;
    const current = classItem.currentTerms || {
      monthlyFee: 0,
      teacherSharePerStudent: 0,
      requiredSessionsPerMonth: 8,
      effectiveFromMonth: getCurrentMonthKey(),
    };
    setEditFee(current.monthlyFee);
    setEditTeacherShare(current.teacherSharePerStudent);
    setEditRequiredSessions(current.requiredSessionsPerMonth);
    setEditEffectiveMonth(getCurrentMonthKey());
    setTermsError("");
    setTermsSheetOpen(true);
  }

  function openEnrollSheet() {
    loadAllStudentsForEnrolment();
    setSelectedStudentIds([]);
    setEnrollJoinedMonth(getCurrentMonthKey());
    setShowAllGrades(false);
    setEnrollError("");
    setEnrollSheetOpen(true);
  }

  function toggleStudentSelection(studentId: string) {
    if (selectedStudentIds.includes(studentId)) {
      setSelectedStudentIds(selectedStudentIds.filter((id) => id !== studentId));
    } else {
      setSelectedStudentIds([...selectedStudentIds, studentId]);
    }
  }

  const computedOwnerShare = calculateOwnerShare(Number(editFee) || 0, Number(editTeacherShare) || 0);
  const isTeacherShareInvalid = Number(editTeacherShare) > Number(editFee);

  async function handleUpdateTerms(e: React.FormEvent) {
    e.preventDefault();
    setTermsError("");

    if (isTeacherShareInvalid) {
      setTermsError("Teacher share cannot exceed the monthly class fee.");
      return;
    }

    try {
      setTermsSaving(true);
      const res = await fetch(`/api/owner/classes/${classId}/terms?yearId=${classItem?.yearId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyFee: Number(editFee) || 0,
          teacherSharePerStudent: Number(editTeacherShare) || 0,
          requiredSessionsPerMonth: Number(editRequiredSessions) || 8,
          effectiveFromMonth: editEffectiveMonth.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTermsSheetOpen(false);
        showToast(data.message || "Terms updated successfully.", "success");
        loadClassDetail();
      } else {
        setTermsError(data.error || "Failed to update terms.");
      }
    } catch {
      setTermsError("Server connection error while saving terms.");
    } finally {
      setTermsSaving(false);
    }
  }

  async function handleBatchEnroll(e: React.FormEvent) {
    e.preventDefault();
    setEnrollError("");

    if (selectedStudentIds.length === 0) {
      setEnrollError("Please select at least one student to enroll.");
      return;
    }

    try {
      setEnrolling(true);
      const res = await fetch(`/api/owner/classes/${classId}/enrolments?yearId=${classItem?.yearId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudentIds,
          joinedMonth: enrollJoinedMonth.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setEnrollSheetOpen(false);
        showToast(data.message || "Students enrolled successfully.", "success");
        loadClassDetail();
      } else {
        setEnrollError(data.error || "Failed to enroll students.");
      }
    } catch {
      setEnrollError("Connection error while enrolling students.");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleRemoveStudent() {
    if (!removeDialogStudent) return;

    try {
      setRemoving(true);
      const res = await fetch(
        `/api/owner/classes/${classId}/enrolments/${removeDialogStudent.studentId}?yearId=${classItem?.yearId}`,
        { method: "DELETE" }
      );
      const data = await res.json();

      if (res.ok) {
        showToast(`${removeDialogStudent.studentName} removed from class.`, "success");
        setRemoveDialogStudent(null);
        loadClassDetail();
      } else {
        showToast(data.error || "Failed to remove student.", "danger");
      }
    } catch {
      showToast("Server error removing student.", "danger");
    } finally {
      setRemoving(false);
    }
  }

  if (loading) {
    return (
      <OwnerShell pageTitle="Class Detail">
        <div className="flex flex-col gap-4">
          <Skeleton height="36px" width="160px" />
          <Skeleton height="140px" />
          <Skeleton height="180px" />
        </div>
      </OwnerShell>
    );
  }

  if (!classItem) {
    return (
      <OwnerShell pageTitle="Class Not Found">
        <EmptyState
          title="Class Not Found"
          description="The class you requested does not exist or may have been deleted."
          icon={<BookOpen className="w-8 h-8" strokeWidth={1.75} />}
          action={
            <Button variant="primary" onClick={() => router.push("/owner/classes")}>
              Return to Classes
            </Button>
          }
        />
      </OwnerShell>
    );
  }

  const terms = classItem.currentTerms || {
    monthlyFee: 0,
    teacherSharePerStudent: 0,
    requiredSessionsPerMonth: 8,
    effectiveFromMonth: "",
  };
  const enrolledStudentIds = new Set(enrolledStudents.map((e) => e.studentId));

  // Filter students for enrolment modal: matching grade first
  const matchingGradeStudents = allStudents.filter(
    (s) => s.grade.toLowerCase() === classItem.grade.toLowerCase()
  );
  const otherStudents = allStudents.filter(
    (s) => s.grade.toLowerCase() !== classItem.grade.toLowerCase()
  );
  const displayEnrolmentCandidates = showAllGrades
    ? [...matchingGradeStudents, ...otherStudents]
    : matchingGradeStudents;

  return (
    <OwnerShell pageTitle={classItem.name}>
      {/* Back Link */}
      <div className="mb-3">
        <Link
          href="/owner/classes"
          className="inline-flex items-center gap-1.5 text-xs text-[#5F6670] hover:text-[#1C1F23] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
          <span>Back to Classes Directory</span>
        </Link>
      </div>

      <PageHeader
        title={classItem.name}
        subtitle={`${classItem.grade} • Teacher: ${classItem.teacherName || "Unassigned"} • Year ${classItem.yearId}`}
        action={
          <Button variant="primary" onClick={openEnrollSheet} className="gap-1.5">
            <Plus className="w-4 h-4" strokeWidth={2} />
            <span>Enroll Students</span>
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Details & Fee Terms */}
        <div className="lg:col-span-5 space-y-4">
          {/* Class Overview & Teacher Card */}
          <Card className="p-4 flex flex-col gap-3">
            <CardHeader className="p-0 pb-2.5 border-b border-[#E4E1DA]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                  <CardTitle>Class Information</CardTitle>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-[#E6F0EC] text-[#1F5C4D] border border-[#1F5C4D]/20">
                  {classItem.grade}
                </span>
              </div>
            </CardHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#5F6670] block">Assigned Teacher</span>
                <span className="font-medium text-[#1C1F23] flex items-center gap-1.5 mt-0.5">
                  <GraduationCap className="w-3.5 h-3.5 text-[#1F5C4D]" strokeWidth={1.75} />
                  {classItem.teacherName || "Unassigned"}
                </span>
              </div>

              <div>
                <span className="text-[#5F6670] block">Subject</span>
                <span className="font-medium text-[#1C1F23] mt-0.5 block">{classItem.subject}</span>
              </div>
            </div>
          </Card>

          {/* Current Active Terms Card */}
          <Card className="p-4 flex flex-col gap-3">
            <CardHeader className="p-0 pb-2.5 border-b border-[#E4E1DA]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                  <CardTitle>Active Terms ({terms.effectiveFromMonth})</CardTitle>
                </div>
                <Button variant="secondary" onClick={openTermsSheet} className="text-xs h-7 px-2.5 gap-1">
                  <Edit className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Update Terms</span>
                </Button>
              </div>
            </CardHeader>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#5F6670] block">Monthly Fee / Student</span>
                <span className="font-semibold text-sm text-[#1C1F23] tabular-nums mt-0.5 block">
                  <MoneyText amount={terms.monthlyFee} />
                </span>
              </div>

              <div>
                <span className="text-[#5F6670] block">Teacher Share / Student</span>
                <span className="font-semibold text-sm text-[#1C1F23] tabular-nums mt-0.5 block">
                  <MoneyText amount={terms.teacherSharePerStudent} />
                </span>
              </div>

              <div>
                <span className="text-[#5F6670] block">College Share / Student</span>
                <span className="font-semibold text-sm text-[#1F5C4D] tabular-nums mt-0.5 block">
                  <MoneyText amount={terms.ownerShare ?? (terms.monthlyFee - terms.teacherSharePerStudent)} />
                </span>
              </div>

              <div>
                <span className="text-[#5F6670] block">Required Sessions</span>
                <span className="font-semibold text-sm text-[#1C1F23] tabular-nums mt-0.5 block">
                  {terms.requiredSessionsPerMonth} sessions / mo
                </span>
              </div>
            </div>

            {/* Terms History Section */}
            {classItem.termsHistory && classItem.termsHistory.length > 1 && (
              <div className="pt-2.5 border-t border-[#E4E1DA]">
                <div className="flex items-center gap-1.5 text-xs text-[#5F6670] font-medium mb-2">
                  <History className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Versioned Terms History ({classItem.termsHistory.length} versions)</span>
                </div>
                <div className="divide-y divide-[#E4E1DA] text-[11px]">
                  {classItem.termsHistory.map((h: ClassTerms, i: number) => (
                    <div key={i} className="py-1.5 flex items-center justify-between">
                      <span>
                        Effective <strong>{h.effectiveFromMonth}</strong>: Fee <MoneyText amount={h.monthlyFee} /> • Teacher <MoneyText amount={h.teacherSharePerStudent} />
                      </span>
                      <span className="text-[#5F6670]">Req: {h.requiredSessionsPerMonth} sess</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Monthly Session Progress */}
          <Card className="p-4 flex flex-col gap-3">
            <CardHeader className="p-0 pb-2.5 border-b border-[#E4E1DA]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                  <CardTitle>Session Progress ({sessionProgress ? formatMonthDisplay(sessionProgress.month) : "Current Month"})</CardTitle>
                </div>
                <StatusChip status="neutral" label="Scheduled" />
              </div>
            </CardHeader>

            <div className="flex items-center justify-between text-xs bg-[#FAF9F6] p-3 rounded border border-[#E4E1DA]">
              <div>
                <span className="font-semibold text-sm text-[#1C1F23]">
                  {sessionProgress?.heldSessions ?? 0} of {terms.requiredSessionsPerMonth} sessions held
                </span>
                <p className="text-[11px] text-[#5F6670] mt-0.5">
                  Monthly timetable sessions and attendance status
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-[#5F6670]">Target</span>
                <span className="font-semibold text-sm text-[#1C1F23] block tabular-nums">
                  {terms.requiredSessionsPerMonth} req
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Enrolled Students List */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="p-4 flex flex-col gap-3">
            <CardHeader className="p-0 pb-2.5 border-b border-[#E4E1DA]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                  <CardTitle>Enrolled Students</CardTitle>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-[#1C1F23]">
                  {enrolledStudents.length} student{enrolledStudents.length === 1 ? "" : "s"}
                </span>
              </div>
            </CardHeader>

            {enrolledStudents.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#5F6670]">
                <Users className="w-6 h-6 mx-auto mb-2 opacity-50 text-[#5F6670]" strokeWidth={1.75} />
                <p className="font-medium text-[#1C1F23]">No students enrolled yet</p>
                <p className="text-[11px] text-[#5F6670] mt-1">
                  Click "Enroll Students" above to allocate students to this class.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E4E1DA]">
                {enrolledStudents.map((enrolment) => (
                  <div key={enrolment.studentId} className="py-3 flex items-center justify-between gap-3 text-xs hover:bg-[#FAF9F6]/50 px-1 rounded transition-colors">
                    <div>
                      <Link
                        href={`/owner/students/${enrolment.studentId}`}
                        className="font-semibold text-[#1C1F23] hover:text-[#1F5C4D] transition-colors"
                      >
                        {enrolment.studentName}
                      </Link>
                      <div className="flex items-center gap-2 text-[11px] text-[#5F6670] mt-0.5">
                        {enrolment.studentSchool && <span>{enrolment.studentSchool}</span>}
                        <span>•</span>
                        <span>Enrolled in {enrolment.joinedMonth}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[11px] rounded bg-[#FAF9F6] border border-[#E4E1DA] text-[#5F6670]">
                        {enrolment.studentGrade}
                      </span>

                      <button
                        type="button"
                        onClick={() => setRemoveDialogStudent(enrolment)}
                        className="p-1.5 text-[#5F6670] hover:text-[#A32A2A] rounded hover:bg-[#FBE9E7] transition-colors"
                        title="Remove from class"
                      >
                        <UserMinus className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Update Terms Bottom Sheet */}
      <BottomSheet
        open={termsSheetOpen}
        onClose={() => setTermsSheetOpen(false)}
        title="Update Class Terms (New Version)"
      >
        <form onSubmit={handleUpdateTerms} className="flex flex-col gap-4">
          {termsError && (
            <div className="p-3 text-xs text-[#A32A2A] bg-[#FBE9E7] border border-[#A32A2A]/20 rounded">
              {termsError}
            </div>
          )}

          <div className="p-2.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded text-xs text-[#5F6670]">
            <p>
              Changes will apply starting from the chosen effective month. Past months retain their existing terms for historical fees and salaries.
            </p>
          </div>

          <Field id="edit-terms-month" label="Effective From Month (YYYY-MM)" required>
            <Input
              type="month"
              value={editEffectiveMonth}
              onChange={(e) => setEditEffectiveMonth(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="edit-terms-fee" label="Monthly Fee / Student (LKR)" required>
              <Input
                type="number"
                min="0"
                step="100"
                value={editFee}
                onChange={(e) => setEditFee(Number(e.target.value))}
                required
              />
            </Field>

            <Field id="edit-terms-share" label="Teacher Share / Student (LKR)" required>
              <Input
                type="number"
                min="0"
                step="100"
                value={editTeacherShare}
                onChange={(e) => setEditTeacherShare(Number(e.target.value))}
                required
              />
            </Field>
          </div>

          {/* Computed College Share */}
          <div className="p-2.5 bg-white rounded border border-[#E4E1DA] text-xs flex items-center justify-between">
            <span className="text-[#5F6670]">Computed College Share / Student:</span>
            <strong className="text-[#1F5C4D] tabular-nums font-semibold">
              <MoneyText amount={computedOwnerShare} />
            </strong>
          </div>

          {isTeacherShareInvalid && (
            <div className="flex items-center gap-1.5 p-2 bg-[#FBE9E7] text-[#A32A2A] rounded text-xs border border-[#A32A2A]/20">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
              <span>Teacher share cannot exceed the monthly class fee.</span>
            </div>
          )}

          <Field id="edit-terms-sessions" label="Required Sessions / Month" required>
            <Input
              type="number"
              min="1"
              max="31"
              value={editRequiredSessions}
              onChange={(e) => setEditRequiredSessions(Number(e.target.value))}
              required
            />
          </Field>

          <div className="flex gap-2 pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setTermsSheetOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={termsSaving || isTeacherShareInvalid}
              className="flex-1"
            >
              {termsSaving ? "Updating..." : "Save Terms Version"}
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Enroll Students Bottom Sheet */}
      <BottomSheet
        open={enrollSheetOpen}
        onClose={() => setEnrollSheetOpen(false)}
        title={`Enroll Students into ${classItem.name}`}
      >
        <form onSubmit={handleBatchEnroll} className="flex flex-col gap-4">
          {enrollError && (
            <div className="p-3 text-xs text-[#A32A2A] bg-[#FBE9E7] border border-[#A32A2A]/20 rounded">
              {enrollError}
            </div>
          )}

          <Field id="enroll-joined-month" label="Enrolment Effective Month (YYYY-MM)" required>
            <Input
              type="month"
              value={enrollJoinedMonth}
              onChange={(e) => setEnrollJoinedMonth(e.target.value)}
              required
            />
          </Field>

          {/* Filter Switch */}
          <div className="flex items-center justify-between p-2.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded text-xs">
            <div>
              <span className="font-semibold text-[#1C1F23]">
                {showAllGrades
                  ? `Showing all registered students (${allStudents.length})`
                  : `Showing matching ${classItem.grade} students (${matchingGradeStudents.length})`}
              </span>
              <p className="text-[11px] text-[#5F6670]">
                {showAllGrades
                  ? "Students from any grade can be enrolled."
                  : "Filter is active to show students in matching grade first."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAllGrades(!showAllGrades)}
              className="text-xs text-[#1F5C4D] font-medium hover:underline shrink-0"
            >
              {showAllGrades ? `Filter to ${classItem.grade}` : "Show all grades"}
            </button>
          </div>

          {/* Student Selector List */}
          <div className="border border-[#E4E1DA] rounded max-h-60 overflow-y-auto divide-y divide-[#E4E1DA] text-xs">
            {displayEnrolmentCandidates.length === 0 ? (
              <div className="p-4 text-center text-[#5F6670]">
                No students available in this category.
              </div>
            ) : (
              displayEnrolmentCandidates.map((student) => {
                const isAlreadyEnrolled = enrolledStudentIds.has(student.id);
                const isSelected = selectedStudentIds.includes(student.id);

                return (
                  <label
                    key={student.id}
                    className={`flex items-center justify-between p-2.5 cursor-pointer hover:bg-[#FAF9F6] transition-colors ${
                      isAlreadyEnrolled ? "opacity-50 cursor-not-allowed bg-gray-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isAlreadyEnrolled || isSelected}
                        disabled={isAlreadyEnrolled}
                        onChange={() => toggleStudentSelection(student.id)}
                        className="w-4 h-4 accent-[#1F5C4D] rounded cursor-pointer"
                      />
                      <div>
                        <span className="font-medium text-[#1C1F23]">{student.name}</span>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#5F6670]">
                          <span>{student.school}</span>
                          <span>•</span>
                          <span>{student.grade}</span>
                        </div>
                      </div>
                    </div>

                    {isAlreadyEnrolled && (
                      <span className="text-[11px] font-medium text-[#1F5C4D]">
                        Already Enrolled
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          <div className="text-xs text-[#5F6670] flex items-center justify-between">
            <span>
              <strong>{selectedStudentIds.length}</strong> new student(s) selected
            </span>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEnrollSheetOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={enrolling || selectedStudentIds.length === 0}
              className="flex-1"
            >
              {enrolling ? "Enrolling..." : `Enroll ${selectedStudentIds.length} Student(s)`}
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Remove Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(removeDialogStudent)}
        title="Remove Student from Class"
        description={`Are you sure you want to remove ${removeDialogStudent?.studentName} from ${classItem.name}? This student can be re-enrolled at any time.`}
        confirmLabel={removing ? "Removing..." : "Remove Student"}
        cancelLabel="Cancel"
        variant="danger"
        loading={removing}
        onConfirm={handleRemoveStudent}
        onClose={() => setRemoveDialogStudent(null)}
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
