"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { StatusChip } from "@/components/ui/StatusChip";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { ArrowLeft, Plus, Edit2, Eye, EyeOff, BookOpen, GraduationCap, Trash2 } from "lucide-react";
import type { AcademicGrade, AcademicSubject } from "@/types";

export default function AcademicSettingsPage() {
  const [grades, setGrades] = useState<AcademicGrade[]>([]);
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"grades" | "subjects">("grades");

  // Modal states
  const [addGradeModal, setAddGradeModal] = useState(false);
  const [newGradeName, setNewGradeName] = useState("");

  const [renameGradeModal, setRenameGradeModal] = useState(false);
  const [targetGrade, setTargetGrade] = useState<AcademicGrade | null>(null);
  const [renameGradeValue, setRenameGradeValue] = useState("");

  const [addSubjectModal, setAddSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");

  const [renameSubjectModal, setRenameSubjectModal] = useState(false);
  const [targetSubject, setTargetSubject] = useState<AcademicSubject | null>(null);
  const [renameSubjectValue, setRenameSubjectValue] = useState("");

  // Delete targets
  const [deleteGradeTarget, setDeleteGradeTarget] = useState<AcademicGrade | null>(null);
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState<AcademicSubject | null>(null);

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadAcademic() {
      try {
        const res = await fetch("/api/owner/settings/academic");
        if (res.ok) {
          const data = await res.json();
          setGrades(data.grades || []);
          setSubjects(data.subjects || []);
        }
      } catch (err) {
        console.error("Failed to load academic settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAcademic();
  }, []);

  async function handleAction(payload: any, successText: string) {
    // 1. Snapshot previous state for rollback on error
    const previousGrades = grades;
    const previousSubjects = subjects;

    // 2. Instant Optimistic UI Update (<16ms, 0 latency)
    if (payload.action === "deleteGrade") {
      setGrades((prev) => {
        const next = prev.filter((g) => g.id !== payload.id);
        return next.map((g, idx) => ({ ...g, order: idx + 1 }));
      });
    } else if (payload.action === "deleteSubject") {
      setSubjects((prev) => prev.filter((s) => s.id !== payload.id));
    } else if (payload.action === "toggleGradeHidden") {
      setGrades((prev) =>
        prev.map((g) => (g.id === payload.id ? { ...g, hidden: payload.hidden } : g))
      );
    } else if (payload.action === "toggleSubjectHidden") {
      setSubjects((prev) =>
        prev.map((s) => (s.id === payload.id ? { ...s, hidden: payload.hidden } : s))
      );
    } else if (payload.action === "renameGrade") {
      setGrades((prev) =>
        prev.map((g) => (g.id === payload.id ? { ...g, name: payload.name.trim() } : g))
      );
    } else if (payload.action === "renameSubject") {
      setSubjects((prev) =>
        prev.map((s) => (s.id === payload.id ? { ...s, name: payload.name.trim() } : s))
      );
    }

    // Instantly close modals and reset input fields
    setAddGradeModal(false);
    setRenameGradeModal(false);
    setAddSubjectModal(false);
    setRenameSubjectModal(false);
    setDeleteGradeTarget(null);
    setDeleteSubjectTarget(null);
    setNewGradeName("");
    setNewSubjectName("");

    setSuccessMessage(successText);
    setErrorMessage("");

    // 3. Asynchronous Database Persistence
    try {
      const res = await fetch("/api/owner/settings/academic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Action failed.");
      }

      // Reconcile with verified server state
      if (Array.isArray(data.grades)) setGrades(data.grades);
      if (Array.isArray(data.subjects)) setSubjects(data.subjects);
    } catch (err: any) {
      // Revert optimistic updates if server errors
      setGrades(previousGrades);
      setSubjects(previousSubjects);
      setSuccessMessage("");
      setErrorMessage(err.message || "Failed to update settings. Changes reverted.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OwnerShell pageTitle="Grades & Subjects" maxWidth="wide">
      <div className="max-w-5xl mx-auto space-y-5 pb-12">
        <div>
          <Link
            href="/owner/more"
            className="inline-flex items-center text-xs font-medium text-[#1F5C4D] hover:underline min-h-[36px]"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} />
            Back to More
          </Link>
        </div>

        <PageHeader
          title="Grades & Subjects"
          subtitle="Manage college academic grade tiers and available subjects"
        />

        {successMessage && (
          <div>
            <Toast message={successMessage} variant="success" onDismiss={() => setSuccessMessage("")} />
          </div>
        )}
        {errorMessage && (
          <div>
            <Toast message={errorMessage} variant="danger" onDismiss={() => setErrorMessage("")} />
          </div>
        )}

        {/* Segmented Switcher */}
        <div className="grid grid-cols-2 p-1 bg-[#F0EFEB] rounded-[6px] border border-[#E4E1DA] mb-2 max-w-md">
          <button
            type="button"
            onClick={() => setActiveTab("grades")}
            className={`min-h-[38px] flex items-center justify-center gap-1.5 text-xs font-semibold rounded-[4px] transition-colors ${
              activeTab === "grades"
                ? "bg-[#FFFFFF] text-[#1C1F23] shadow-none border border-[#E4E1DA]"
                : "text-[#5F6670] hover:text-[#1C1F23]"
            }`}
          >
            <GraduationCap className="w-4 h-4" strokeWidth={1.75} />
            <span>Grades ({grades.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("subjects")}
            className={`min-h-[38px] flex items-center justify-center gap-1.5 text-xs font-semibold rounded-[4px] transition-colors ${
              activeTab === "subjects"
                ? "bg-[#FFFFFF] text-[#1C1F23] shadow-none border border-[#E4E1DA]"
                : "text-[#5F6670] hover:text-[#1C1F23]"
            }`}
          >
            <BookOpen className="w-4 h-4" strokeWidth={1.75} />
            <span>Subjects ({subjects.length})</span>
          </button>
        </div>

        {/* TAB 1: GRADES */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} height="52px" />
            ))}
          </div>
        ) : activeTab === "grades" && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <p className="text-xs text-[#5F6670]">
                Configure the academic grade tiers offered by your institution.
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setNewGradeName("");
                  setAddGradeModal(true);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} />
                Add Grade
              </Button>
            </div>

            {grades.length === 0 ? (
              <Card className="text-center p-6 text-xs text-[#5F6670]">
                No grade tiers configured yet. Click &quot;Add Grade&quot; to create your first academic grade level (e.g. Grade 1, Grade 10, O/L, A/L).
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {grades.map((grade) => (
                  <div
                    key={grade.id}
                    className="bg-white border border-[#E4E1DA] rounded-[6px] flex items-center justify-between p-3.5 min-h-[48px] hover:bg-[#FAF9F6] transition-colors shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#1C1F23]">
                        {grade.name}
                      </span>
                      {grade.hidden && (
                        <StatusChip status="notApplicable" label="Hidden" />
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetGrade(grade);
                          setRenameGradeValue(grade.name);
                          setRenameGradeModal(true);
                        }}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#5F6670] hover:text-[#1C1F23]"
                        aria-label={`Rename ${grade.name}`}
                      >
                        <Edit2 className="w-4 h-4" strokeWidth={1.75} />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleAction(
                            {
                              action: "toggleGradeHidden",
                              id: grade.id,
                              hidden: !grade.hidden,
                            },
                            `${grade.name} ${grade.hidden ? "unhidden" : "hidden"} successfully.`
                          )
                        }
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#5F6670] hover:text-[#1C1F23]"
                        aria-label={grade.hidden ? `Unhide ${grade.name}` : `Hide ${grade.name}`}
                      >
                        {grade.hidden ? (
                          <EyeOff className="w-4 h-4 text-[#A32A2A]" strokeWidth={1.75} />
                        ) : (
                          <Eye className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteGradeTarget(grade)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7]/60 rounded-[4px] transition-colors"
                        aria-label={`Delete ${grade.name}`}
                        title={`Delete ${grade.name}`}
                      >
                        <Trash2 className="w-4 h-4 text-[#A32A2A]" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SUBJECTS */}
        {!loading && activeTab === "subjects" && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <p className="text-xs text-[#5F6670]">
                Curriculum subjects taught by your teachers.
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setNewSubjectName("");
                  setAddSubjectModal(true);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} />
                Add Subject
              </Button>
            </div>

            {subjects.length === 0 ? (
              <Card className="text-center p-6 text-xs text-[#5F6670]">
                No subjects created yet. Click "Add Subject" to begin adding your curriculum courses (e.g. Mathematics, Science, English).
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {subjects.map((subject) => (
                  <div
                    key={subject.id}
                    className="bg-white border border-[#E4E1DA] rounded-[6px] flex items-center justify-between p-3.5 min-h-[48px] hover:bg-[#FAF9F6] transition-colors shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#1C1F23]">
                        {subject.name}
                      </span>
                      {subject.hidden && (
                        <StatusChip status="notApplicable" label="Hidden" />
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetSubject(subject);
                          setRenameSubjectValue(subject.name);
                          setRenameSubjectModal(true);
                        }}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#5F6670] hover:text-[#1C1F23]"
                        aria-label={`Rename ${subject.name}`}
                      >
                        <Edit2 className="w-4 h-4" strokeWidth={1.75} />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleAction(
                            {
                              action: "toggleSubjectHidden",
                              id: subject.id,
                              hidden: !subject.hidden,
                            },
                            `${subject.name} ${subject.hidden ? "unhidden" : "hidden"} successfully.`
                          )
                        }
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#5F6670] hover:text-[#1C1F23]"
                        aria-label={subject.hidden ? `Unhide ${subject.name}` : `Hide ${subject.name}`}
                      >
                        {subject.hidden ? (
                          <EyeOff className="w-4 h-4 text-[#A32A2A]" strokeWidth={1.75} />
                        ) : (
                          <Eye className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteSubjectTarget(subject)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7]/60 rounded-[4px] transition-colors"
                        aria-label={`Delete ${subject.name}`}
                        title={`Delete ${subject.name}`}
                      >
                        <Trash2 className="w-4 h-4 text-[#A32A2A]" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Grade Modal */}
      <BottomSheet
        open={addGradeModal}
        onClose={() => setAddGradeModal(false)}
        title="Add Grade Level"
        description="Enter the name of the new academic grade."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newGradeName.trim()) {
              handleAction(
                { action: "addGrade", name: newGradeName.trim() },
                `Grade "${newGradeName.trim()}" added.`
              );
            }
          }}
          className="flex flex-col gap-4 py-2"
        >
          <Field id="new-grade-input" label="Grade Name" required>
            <Input
              value={newGradeName}
              onChange={(e) => setNewGradeName(e.target.value)}
              placeholder="e.g. Advanced Level Year 1"
              disabled={saving}
            />
          </Field>
          <Button type="submit" variant="primary" fullWidth loading={saving} disabled={saving || !newGradeName.trim()}>
            Create Grade
          </Button>
        </form>
      </BottomSheet>

      {/* Rename Grade Modal */}
      <BottomSheet
        open={renameGradeModal}
        onClose={() => setRenameGradeModal(false)}
        title="Rename Grade"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (targetGrade && renameGradeValue.trim()) {
              handleAction(
                { action: "renameGrade", id: targetGrade.id, name: renameGradeValue.trim() },
                `Grade renamed to "${renameGradeValue.trim()}".`
              );
            }
          }}
          className="flex flex-col gap-4 py-2"
        >
          <Field id="rename-grade-input" label="Grade Name" required>
            <Input
              value={renameGradeValue}
              onChange={(e) => setRenameGradeValue(e.target.value)}
              disabled={saving}
            />
          </Field>
          <Button type="submit" variant="primary" fullWidth loading={saving} disabled={saving || !renameGradeValue.trim()}>
            Save New Name
          </Button>
        </form>
      </BottomSheet>

      {/* Add Subject Modal */}
      <BottomSheet
        open={addSubjectModal}
        onClose={() => setAddSubjectModal(false)}
        title="Add Curriculum Subject"
        description="Enter the name of the new teaching subject."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newSubjectName.trim()) {
              handleAction(
                { action: "addSubject", name: newSubjectName.trim() },
                `Subject "${newSubjectName.trim()}" added.`
              );
            }
          }}
          className="flex flex-col gap-4 py-2"
        >
          <Field id="new-sub-input" label="Subject Name" required>
            <Input
              value={newSubjectName}
              onChange={(e) => setNewSubjectName(e.target.value)}
              placeholder="e.g. Physics"
              disabled={saving}
            />
          </Field>
          <Button type="submit" variant="primary" fullWidth loading={saving} disabled={saving || !newSubjectName.trim()}>
            Create Subject
          </Button>
        </form>
      </BottomSheet>

      {/* Rename Subject Modal */}
      <BottomSheet
        open={renameSubjectModal}
        onClose={() => setRenameSubjectModal(false)}
        title="Rename Subject"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (targetSubject && renameSubjectValue.trim()) {
              handleAction(
                { action: "renameSubject", id: targetSubject.id, name: renameSubjectValue.trim() },
                `Subject renamed to "${renameSubjectValue.trim()}".`
              );
            }
          }}
          className="flex flex-col gap-4 py-2"
        >
          <Field id="rename-sub-input" label="Subject Name" required>
            <Input
              value={renameSubjectValue}
              onChange={(e) => setRenameSubjectValue(e.target.value)}
              disabled={saving}
            />
          </Field>
          <Button type="submit" variant="primary" fullWidth loading={saving} disabled={saving || !renameSubjectValue.trim()}>
            Save New Name
          </Button>
        </form>
      </BottomSheet>

      {/* Delete Grade Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(deleteGradeTarget)}
        onClose={() => setDeleteGradeTarget(null)}
        onConfirm={() => {
          if (!deleteGradeTarget) return;
          const target = deleteGradeTarget;
          setDeleteGradeTarget(null);
          handleAction(
            { action: "deleteGrade", id: target.id },
            `${target.name} deleted successfully.`
          );
        }}
        title={`Delete ${deleteGradeTarget?.name || "Grade"}?`}
        description={`Are you sure you want to permanently delete ${deleteGradeTarget?.name}? It will be removed from future grade selections. Existing classes and student records will not be altered.`}
        confirmLabel="Delete Grade"
        cancelLabel="Cancel"
        variant="danger"
        loading={saving}
      />

      {/* Delete Subject Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(deleteSubjectTarget)}
        onClose={() => setDeleteSubjectTarget(null)}
        onConfirm={() => {
          if (!deleteSubjectTarget) return;
          const target = deleteSubjectTarget;
          setDeleteSubjectTarget(null);
          handleAction(
            { action: "deleteSubject", id: target.id },
            `${target.name} deleted successfully.`
          );
        }}
        title={`Delete ${deleteSubjectTarget?.name || "Subject"}?`}
        description={`Are you sure you want to permanently delete ${deleteSubjectTarget?.name}? It will be removed from future subject selections. Existing classes and teacher assignments will not be altered.`}
        confirmLabel="Delete Subject"
        cancelLabel="Cancel"
        variant="danger"
        loading={saving}
      />
    </OwnerShell>
  );
}
