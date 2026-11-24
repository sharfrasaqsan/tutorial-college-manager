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
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Toast, type ToastVariant } from "@/components/ui/Toast";
import { MoneyText } from "@/components/ui/MoneyText";
import {
  BookOpen,
  Plus,
  Users,
  ChevronRight,
  GraduationCap,
  Calendar,
  AlertCircle,
  Coins,
} from "lucide-react";
import type { ClassItem, AcademicGrade, AcademicSubject, Teacher } from "@/types";
import { calculateOwnerShare, generateClassName } from "@/lib/classes";
import { getCurrentMonthKey } from "@/lib/dates";

export default function OwnerClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [grades, setGrades] = useState<AcademicGrade[]>([]);
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activeYear, setActiveYear] = useState<string>("2026");
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [search, setSearch] = useState("");

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<ToastVariant>("info");

  // Create Class Sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formGrade, setFormGrade] = useState("Grade 10");
  const [formSubject, setFormSubject] = useState("");
  const [formTeacherId, setFormTeacherId] = useState("");
  const [showAllTeachers, setShowAllTeachers] = useState(false);

  // Terms
  const [formFee, setFormFee] = useState<number>(3000);
  const [formTeacherShare, setFormTeacherShare] = useState<number>(2000);
  const [formRequiredSessions, setFormRequiredSessions] = useState<number>(8);
  const [formEffectiveMonth, setFormEffectiveMonth] = useState<string>(getCurrentMonthKey());

  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    loadClasses();
    loadMetadata();
  }, []);

  async function loadClasses() {
    try {
      setLoading(true);
      const res = await fetch("/api/owner/classes");
      const data = await res.json();
      if (res.ok) {
        setClasses(data.classes || []);
        if (data.yearId) setActiveYear(data.yearId);
      } else {
        showToast(data.error || "Failed to load classes.", "danger");
      }
    } catch {
      showToast("Unable to connect to server.", "danger");
    } finally {
      setLoading(false);
    }
  }

  async function loadMetadata() {
    try {
      // 1. Grades & Subjects
      const acadRes = await fetch("/api/owner/settings/academic");
      const acadData = await acadRes.json();
      if (acadRes.ok) {
        if (acadData.grades) {
          const sorted = (acadData.grades as AcademicGrade[])
            .filter((g) => !g.hidden)
            .sort((a, b) => a.order - b.order);
          setGrades(sorted);
        }
        if (acadData.subjects) {
          const activeSubjs = (acadData.subjects as AcademicSubject[]).filter((s) => !s.hidden);
          setSubjects(activeSubjs);
          if (activeSubjs.length > 0 && !formSubject) {
            setFormSubject(activeSubjs[0].name);
          }
        }
      }

      // 2. Teachers
      const teachRes = await fetch("/api/owner/teachers");
      const teachData = await teachRes.json();
      if (teachRes.ok && teachData.teachers) {
        const activeTeachers = (teachData.teachers as Teacher[]).filter((t) => t.active);
        setTeachers(activeTeachers);
        if (activeTeachers.length > 0 && !formTeacherId) {
          setFormTeacherId(activeTeachers[0].id);
        }
      }
    } catch {}
  }

  function showToast(message: string, variant: ToastVariant = "info") {
    setToastMessage(message);
    setToastVariant(variant);
  }

  function openCreateSheet() {
    if (grades.length > 0) setFormGrade(grades[9]?.name || grades[0].name);
    if (subjects.length > 0) setFormSubject(subjects[0].name);
    setShowAllTeachers(false);
    setFormFee(3000);
    setFormTeacherShare(2000);
    setFormRequiredSessions(8);
    setFormEffectiveMonth(getCurrentMonthKey());
    setFormError("");
    setSheetOpen(true);
  }

  // Teacher filtering based on selected subject
  const matchingTeachers = teachers.filter((t) =>
    t.subjects?.some((s) => s.toLowerCase() === formSubject.toLowerCase())
  );
  const displayedTeachers = showAllTeachers || matchingTeachers.length === 0 ? teachers : matchingTeachers;

  // Computed owner share
  const computedOwnerShare = calculateOwnerShare(Number(formFee) || 0, Number(formTeacherShare) || 0);
  const isTeacherShareInvalid = Number(formTeacherShare) > Number(formFee);

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!formGrade.trim() || !formSubject.trim() || !formTeacherId.trim()) {
      setFormError("Please select grade, subject, and teacher.");
      return;
    }

    if (isTeacherShareInvalid) {
      setFormError("Teacher share cannot exceed the monthly class fee.");
      return;
    }

    try {
      setFormSaving(true);
      const res = await fetch("/api/owner/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearId: activeYear,
          grade: formGrade.trim(),
          subject: formSubject.trim(),
          teacherId: formTeacherId.trim(),
          terms: {
            monthlyFee: Number(formFee) || 0,
            teacherSharePerStudent: Number(formTeacherShare) || 0,
            requiredSessionsPerMonth: Number(formRequiredSessions) || 8,
            effectiveFromMonth: formEffectiveMonth.trim(),
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSheetOpen(false);
        showToast(`Created ${data.classItem.name} successfully.`, "success");
        loadClasses();
      } else {
        setFormError(data.error || "Failed to create class.");
      }
    } catch {
      setFormError("Connection error while creating class.");
    } finally {
      setFormSaving(false);
    }
  }

  const filteredClasses = classes.filter((c) => {
    if (selectedGrade !== "all" && c.grade !== selectedGrade) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const nameMatch = c.name.toLowerCase().includes(q);
      const teacherMatch = c.teacherName?.toLowerCase().includes(q);
      return nameMatch || teacherMatch;
    }
    return true;
  });

  return (
    <OwnerShell pageTitle={`Classes (${activeYear})`}>
      <PageContainer variant="default">
        <PageHeader
          title={`Classes & Curriculum (${activeYear})`}
          subtitle="Manage grade and subject combinations, teacher allocations and fee terms"
          action={
            <div className="flex items-center gap-2">
              <Link href="/owner/timetable">
                <Button variant="secondary" className="gap-1.5 text-xs h-9">
                  <Calendar className="w-4 h-4" strokeWidth={1.75} />
                  <span>Timetable</span>
                </Button>
              </Link>
              <Button variant="primary" onClick={openCreateSheet} className="gap-1.5 text-xs h-9">
                <Plus className="w-4 h-4" strokeWidth={2} />
                <span>Create Class</span>
              </Button>
            </div>
          }
        />

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="flex-1">
          <Input
            type="search"
            placeholder="Search classes or teachers..."
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

      {/* Classes List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton height="160px" />
          <Skeleton height="160px" />
          <Skeleton height="160px" />
        </div>
      ) : filteredClasses.length === 0 ? (
        <EmptyState
          title={search || selectedGrade !== "all" ? "No matching classes found" : "No classes registered yet"}
          description={
            search || selectedGrade !== "all"
              ? "Try adjusting your grade filter or search query."
              : `Create your first class for Academic Year ${activeYear}.`
          }
          icon={<BookOpen className="w-8 h-8" strokeWidth={1.75} />}
          action={
            !search && selectedGrade === "all" ? (
              <Button variant="primary" onClick={openCreateSheet}>
                Create Class
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClasses.map((cls) => {
            const terms = cls.currentTerms || {
              monthlyFee: 0,
              teacherSharePerStudent: 0,
              requiredSessionsPerMonth: 8,
              effectiveFromMonth: "",
            };
            return (
              <Card key={cls.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/owner/classes/${cls.id}`}
                      className="font-semibold text-base text-[#1C1F23] hover:text-[#1F5C4D] transition-colors"
                    >
                      {cls.name}
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs text-[#5F6670] mt-0.5">
                      <GraduationCap className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>{cls.teacherName || "Unassigned Teacher"}</span>
                    </div>
                  </div>

                  {/* Student Count Badge */}
                  <Link href={`/owner/classes/${cls.id}`}>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-[#E6F0EC] text-[#1F5C4D] border border-[#1F5C4D]/20 hover:bg-[#C2DDD4] transition-colors">
                      <Users className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span className="tabular-nums font-semibold">
                        {cls.enrolledStudentCount ?? 0}
                      </span>
                      <span>students</span>
                    </span>
                  </Link>
                </div>

                {/* Terms Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-[#FAF9F6] p-2.5 rounded border border-[#E4E1DA]">
                  <div>
                    <span className="text-[#5F6670] block">Monthly Fee</span>
                    <span className="font-semibold text-[#1C1F23] tabular-nums mt-0.5 block">
                      <MoneyText amount={terms.monthlyFee} />
                    </span>
                  </div>

                  <div>
                    <span className="text-[#5F6670] block">Teacher Share</span>
                    <span className="font-medium text-[#1C1F23] tabular-nums mt-0.5 block">
                      <MoneyText amount={terms.teacherSharePerStudent} />
                    </span>
                  </div>

                  <div>
                    <span className="text-[#5F6670] block">College Share</span>
                    <span className="font-medium text-[#1F5C4D] tabular-nums mt-0.5 block">
                      <MoneyText amount={terms.ownerShare ?? (terms.monthlyFee - terms.teacherSharePerStudent)} />
                    </span>
                  </div>

                  <div>
                    <span className="text-[#5F6670] block">Sessions / Month</span>
                    <span className="font-medium text-[#1C1F23] tabular-nums mt-0.5 block">
                      {terms.requiredSessionsPerMonth} sessions
                    </span>
                  </div>
                </div>

                {/* Footer link */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-[11px] text-[#5F6670]">
                    Effective from: <strong>{terms.effectiveFromMonth}</strong>
                  </span>

                  <Link href={`/owner/classes/${cls.id}`}>
                    <Button variant="secondary" className="text-xs h-7 px-2.5 gap-1 text-[#1F5C4D]">
                      <span>Class Details &amp; Students</span>
                      <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Class Bottom Sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Create New Class"
      >
        <form onSubmit={handleCreateClass} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 text-xs text-[#A32A2A] bg-[#FBE9E7] border border-[#A32A2A]/20 rounded">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="create-class-grade" label="Grade Level" required>
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

            <Field id="create-class-subject" label="Subject" required>
              <Select
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                required
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="p-2.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded text-xs">
            <span className="text-[#5F6670]">Generated Class Name:</span>
            <strong className="text-[#1C1F23] ml-2 font-semibold">
              {generateClassName(formGrade, formSubject)}
            </strong>
          </div>

          {/* Teacher Selection */}
          <Field
            id="create-class-teacher"
            label="Assigned Teacher"
            hint={
              matchingTeachers.length > 0 && !showAllTeachers
                ? `Showing ${matchingTeachers.length} teacher(s) who teach ${formSubject}.`
                : "Showing all active teachers."
            }
            required
          >
            <div className="flex flex-col gap-1.5">
              <Select
                value={formTeacherId}
                onChange={(e) => setFormTeacherId(e.target.value)}
                required
              >
                <option value="">-- Choose a teacher --</option>
                {displayedTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.subjects && t.subjects.length > 0 ? `(${t.subjects.join(", ")})` : ""}
                  </option>
                ))}
              </Select>

              {matchingTeachers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllTeachers(!showAllTeachers)}
                  className="text-left text-[11px] text-[#1F5C4D] hover:underline self-start"
                >
                  {showAllTeachers
                    ? `Filter to teachers who teach ${formSubject}`
                    : `Show all active teachers (${teachers.length})`}
                </button>
              )}
            </div>
          </Field>

          {/* Class Terms Card */}
          <div className="p-3.5 border border-[#E4E1DA] rounded bg-[#FAF9F6] flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
              <h4 className="font-semibold text-xs text-[#1C1F23]">Class Terms &amp; Rates</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="create-class-fee" label="Monthly Student Fee (LKR)" required>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={formFee}
                  onChange={(e) => setFormFee(Number(e.target.value))}
                  required
                />
              </Field>

              <Field id="create-class-share" label="Teacher Share / Student (LKR)" required>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={formTeacherShare}
                  onChange={(e) => setFormTeacherShare(Number(e.target.value))}
                  required
                />
              </Field>
            </div>

            {/* Computed Owner Share Line */}
            <div className="p-2 bg-white rounded border border-[#E4E1DA] text-xs flex items-center justify-between">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E4E1DA]">
              <Field id="create-class-sessions" label="Required Sessions / Month" required>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={formRequiredSessions}
                  onChange={(e) => setFormRequiredSessions(Number(e.target.value))}
                  required
                />
              </Field>

              <Field id="create-class-effective-month" label="Effective From Month (YYYY-MM)" required>
                <Input
                  type="month"
                  value={formEffectiveMonth}
                  onChange={(e) => setFormEffectiveMonth(e.target.value)}
                  required
                />
              </Field>
            </div>
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
              disabled={formSaving || isTeacherShareInvalid}
              className="flex-1"
            >
              {formSaving ? "Creating..." : "Create Class"}
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
