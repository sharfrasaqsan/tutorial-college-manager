"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { Pagination } from "@/components/ui/Pagination";
import { getClassColor, getAvailableClassColor, getUsedClassColors } from "@/lib/class-colors";
import { ClassBadge } from "@/components/ui/ClassBadge";
import { ColorPicker } from "@/components/ui/ColorPicker";
import {
  BookOpen,
  Plus,
  Users,
  ChevronRight,
  GraduationCap,
  Calendar,
  AlertCircle,
  Coins,
  Clock,
  Edit2,
  Trash2,
  X,
} from "lucide-react";
import type { ClassItem, AcademicGrade, AcademicSubject, Teacher, TimetableSlot, TimeInterval, ClassTeacherAssignment } from "@/types";
import { calculateOwnerShare, generateClassName } from "@/lib/classes";
import { checkClash, doIntervalsOverlap } from "@/lib/clash";
import {
  getCurrentMonthKey,
  WEEKDAY_ORDER,
  getWeekdayName,
  formatTimeDisplay,
  formatTimeRange,
} from "@/lib/dates";

interface SessionDraft {
  id?: string;
  weekday: number;
  startTime: string;
  endTime: string;
}

export default function OwnerClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [grades, setGrades] = useState<AcademicGrade[]>([]);
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activeYear, setActiveYear] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [search, setSearch] = useState("");

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<ToastVariant>("info");

  // Create Class Sheet (No prefilled default values)
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formGrade, setFormGrade] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formTeacherId, setFormTeacherId] = useState("");
  const [formIsMultiTeacher, setFormIsMultiTeacher] = useState(false);
  const [formCoTeachers, setFormCoTeachers] = useState<Array<{ teacherId: string; splitPercentage: number }>>([
    { teacherId: "", splitPercentage: 50 },
    { teacherId: "", splitPercentage: 50 },
  ]);
  const [formColor, setFormColor] = useState<string>("blue");
  const [userPickedColor, setUserPickedColor] = useState(false);

  // Create Terms (Clean, empty by default)
  const [formFee, setFormFee] = useState<string>("");
  const [formTeacherShare, setFormTeacherShare] = useState<string>("");
  const [formRequiredSessions, setFormRequiredSessions] = useState<string>("");
  const [formEffectiveMonth, setFormEffectiveMonth] = useState<string>(getCurrentMonthKey());

  // Multiple Weekly Sessions for Create Class
  const [formSchedules, setFormSchedules] = useState<SessionDraft[]>([]);

  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Edit Class Sheet
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [editGrade, setEditGrade] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [editIsMultiTeacher, setEditIsMultiTeacher] = useState(false);
  const [editCoTeachers, setEditCoTeachers] = useState<Array<{ teacherId: string; splitPercentage: number }>>([
    { teacherId: "", splitPercentage: 50 },
    { teacherId: "", splitPercentage: 50 },
  ]);
  const [editColor, setEditColor] = useState<string>("blue");
  const [editFee, setEditFee] = useState<string>("");
  const [editTeacherShare, setEditTeacherShare] = useState<string>("");
  const [editRequiredSessions, setEditRequiredSessions] = useState<string>("");
  const [editEffectiveMonth, setEditEffectiveMonth] = useState<string>(getCurrentMonthKey());
  const [editSchedules, setEditSchedules] = useState<SessionDraft[]>([]);

  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete Class Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingClass, setDeletingClass] = useState<ClassItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Concurrent Grade Schedule Confirmation Dialog
  const [confirmGradeDialogOpen, setConfirmGradeDialogOpen] = useState(false);
  const [gradeDialogDetails, setGradeDialogDetails] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

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
      // 1. Grades & Subjects (No auto-selecting defaults)
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
        }
      }

      // 2. Teachers (No auto-selecting defaults)
      const teachRes = await fetch("/api/owner/teachers");
      const teachData = await teachRes.json();
      if (teachRes.ok && teachData.teachers) {
        const activeTeachers = (teachData.teachers as Teacher[]).filter((t) => t.active);
        setTeachers(activeTeachers);
      }
    } catch {}
  }

  function showToast(message: string, variant: ToastVariant = "info") {
    setToastMessage(message);
    setToastVariant(variant);
  }

  // Opens Create Sheet with 100% clean/empty form and automatically selected non-repeating color
  function openCreateSheet() {
    setUserPickedColor(false);
    setFormGrade("");
    setFormSubject("");
    setFormTeacherId("");
    setFormIsMultiTeacher(false);
    setFormCoTeachers([
      { teacherId: "", splitPercentage: 50 },
      { teacherId: "", splitPercentage: 50 },
    ]);
    const autoColor = getAvailableClassColor(classes);
    setFormColor(autoColor);
    setFormFee("");
    setFormTeacherShare("");
    setFormRequiredSessions("");
    setFormEffectiveMonth(getCurrentMonthKey());
    setFormSchedules([]);
    setFormError("");
    setSheetOpen(true);
  }

  function handleFormEqualizeSplit(count: number) {
    if (count === 2) {
      setFormCoTeachers((prev) => [
        { teacherId: prev[0]?.teacherId || "", splitPercentage: 50 },
        { teacherId: prev[1]?.teacherId || "", splitPercentage: 50 },
      ]);
    } else if (count === 3) {
      setFormCoTeachers((prev) => [
        { teacherId: prev[0]?.teacherId || "", splitPercentage: 34 },
        { teacherId: prev[1]?.teacherId || "", splitPercentage: 33 },
        { teacherId: prev[2]?.teacherId || "", splitPercentage: 33 },
      ]);
    }
  }

  function handleFormAddTeacher() {
    if (formCoTeachers.length >= 3) return;
    const next = [...formCoTeachers, { teacherId: "", splitPercentage: 0 }];
    if (next.length === 3) {
      next[0].splitPercentage = 34;
      next[1].splitPercentage = 33;
      next[2].splitPercentage = 33;
    }
    setFormCoTeachers(next);
  }

  function handleFormRemoveTeacher(idx: number) {
    if (formCoTeachers.length <= 2) return;
    const next = formCoTeachers.filter((_, i) => i !== idx);
    next[0].splitPercentage = 50;
    next[1].splitPercentage = 50;
    setFormCoTeachers(next);
  }

  function handleFormCoTeacherChange(idx: number, field: "teacherId" | "splitPercentage", value: any) {
    setFormCoTeachers((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  }

  function handleEditEqualizeSplit(count: number) {
    if (count === 2) {
      setEditCoTeachers((prev) => [
        { teacherId: prev[0]?.teacherId || "", splitPercentage: 50 },
        { teacherId: prev[1]?.teacherId || "", splitPercentage: 50 },
      ]);
    } else if (count === 3) {
      setEditCoTeachers((prev) => [
        { teacherId: prev[0]?.teacherId || "", splitPercentage: 34 },
        { teacherId: prev[1]?.teacherId || "", splitPercentage: 33 },
        { teacherId: prev[2]?.teacherId || "", splitPercentage: 33 },
      ]);
    }
  }

  function handleEditAddTeacher() {
    if (editCoTeachers.length >= 3) return;
    const next = [...editCoTeachers, { teacherId: "", splitPercentage: 0 }];
    if (next.length === 3) {
      next[0].splitPercentage = 34;
      next[1].splitPercentage = 33;
      next[2].splitPercentage = 33;
    }
    setEditCoTeachers(next);
  }

  function handleEditRemoveTeacher(idx: number) {
    if (editCoTeachers.length <= 2) return;
    const next = editCoTeachers.filter((_, i) => i !== idx);
    next[0].splitPercentage = 50;
    next[1].splitPercentage = 50;
    setEditCoTeachers(next);
  }

  function handleEditCoTeacherChange(idx: number, field: "teacherId" | "splitPercentage", value: any) {
    setEditCoTeachers((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  }

  function addCreateScheduleSession() {
    setFormSchedules([
      ...formSchedules,
      {
        weekday: 1, // Default Monday (1st day of the week)
        startTime: "",
        endTime: "",
      },
    ]);
  }

  function updateCreateSchedule(index: number, field: keyof SessionDraft, value: any) {
    const updated = [...formSchedules];
    updated[index] = { ...updated[index], [field]: value };
    setFormSchedules(updated);
  }

  function removeCreateSchedule(index: number) {
    setFormSchedules(formSchedules.filter((_, i) => i !== index));
  }

  function openEditSheet(cls: ClassItem) {
    setEditingClass(cls);
    setEditGrade(cls.grade);
    setEditSubject(cls.subject);
    setEditTeacherId(cls.teacherId);
    if (cls.isMultiTeacher && cls.teachers && cls.teachers.length > 0) {
      setEditIsMultiTeacher(true);
      setEditCoTeachers(
        cls.teachers.map((t) => ({
          teacherId: t.teacherId,
          splitPercentage: t.splitPercentage,
        }))
      );
    } else {
      setEditIsMultiTeacher(false);
      setEditCoTeachers([
        { teacherId: cls.teacherId || "", splitPercentage: 50 },
        { teacherId: "", splitPercentage: 50 },
      ]);
    }
    setEditColor(cls.color || getClassColor(cls).id);

    const terms = cls.currentTerms;
    setEditFee(terms?.monthlyFee !== undefined ? String(terms.monthlyFee) : "");
    setEditTeacherShare(terms?.teacherSharePerStudent !== undefined ? String(terms.teacherSharePerStudent) : "");
    setEditRequiredSessions(terms?.requiredSessionsPerMonth !== undefined ? String(terms.requiredSessionsPerMonth) : "");
    setEditEffectiveMonth(terms?.effectiveFromMonth || getCurrentMonthKey());

    // Populate all existing sessions
    const existingSlots: TimetableSlot[] = cls.slots || (cls.slot ? [cls.slot] : []);
    setEditSchedules(
      existingSlots.map((s) => ({
        id: s.id,
        weekday: s.weekday,
        startTime: s.startTime,
        endTime: s.endTime,
      }))
    );

    setEditError("");
    setEditSheetOpen(true);
  }

  function addEditScheduleSession() {
    setEditSchedules([
      ...editSchedules,
      {
        weekday: 1, // Default Monday (1st day of the week)
        startTime: "",
        endTime: "",
      },
    ]);
  }

  function updateEditSchedule(index: number, field: keyof SessionDraft, value: any) {
    const updated = [...editSchedules];
    updated[index] = { ...updated[index], [field]: value };
    setEditSchedules(updated);
  }

  function removeEditSchedule(index: number) {
    setEditSchedules(editSchedules.filter((_, i) => i !== index));
  }

  function openDeleteDialog(cls: ClassItem) {
    setDeletingClass(cls);
    setDeleteDialogOpen(true);
  }

  // Teacher filtering for Create Sheet: strictly teachers who teach the selected subject
  const matchingTeachers = useMemo(() => {
    if (!formSubject) return [];
    return teachers.filter((t) =>
      t.subjects?.some((s) => s.toLowerCase() === formSubject.toLowerCase())
    );
  }, [teachers, formSubject]);

  const displayedTeachers = matchingTeachers;

  function handleFormGradeChange(newGrade: string) {
    setFormGrade(newGrade);
    if (!userPickedColor) {
      const autoColor = getAvailableClassColor(classes, {
        grade: newGrade,
        subject: formSubject,
      });
      setFormColor(autoColor);
    }
  }

  function handleFormSubjectChange(newSubj: string) {
    setFormSubject(newSubj);
    if (!userPickedColor) {
      const autoColor = getAvailableClassColor(classes, {
        grade: formGrade,
        subject: newSubj,
      });
      setFormColor(autoColor);
    }
    if (formTeacherId) {
      const currentTeacher = teachers.find((t) => t.id === formTeacherId);
      const teachesNew = currentTeacher?.subjects?.some(
        (s) => s.toLowerCase() === newSubj.toLowerCase()
      );
      if (!teachesNew) {
        setFormTeacherId("");
      }
    }
  }

  // Teacher filtering for Edit Sheet: matching teachers plus currently assigned teacher
  const editMatchingTeachers = useMemo(() => {
    if (!editSubject) return [];
    return teachers.filter((t) =>
      t.subjects?.some((s) => s.toLowerCase() === editSubject.toLowerCase())
    );
  }, [teachers, editSubject]);

  const editDisplayedTeachers = useMemo(() => {
    if (!editSubject) return [];
    const list = [...editMatchingTeachers];
    if (editingClass?.teacherId && !list.some((t) => t.id === editingClass.teacherId)) {
      const current = teachers.find((t) => t.id === editingClass.teacherId);
      if (current) list.push(current);
    }
    return list;
  }, [editSubject, teachers, editMatchingTeachers, editingClass]);

  function handleEditSubjectChange(newSubj: string) {
    setEditSubject(newSubj);
    if (editTeacherId) {
      const currentTeacher = teachers.find((t) => t.id === editTeacherId);
      const teachesNew = currentTeacher?.subjects?.some(
        (s) => s.toLowerCase() === newSubj.toLowerCase()
      );
      if (!teachesNew && editTeacherId !== editingClass?.teacherId) {
        setEditTeacherId("");
      }
    }
  }

  // Computed shares
  const numFormFee = Number(formFee) || 0;
  const numFormTeacherShare = Number(formTeacherShare) || 0;
  const computedOwnerShare = calculateOwnerShare(numFormFee, numFormTeacherShare);
  const isTeacherShareInvalid = numFormTeacherShare > numFormFee;

  const numEditFee = Number(editFee) || 0;
  const numEditTeacherShare = Number(editTeacherShare) || 0;
  const editComputedOwnerShare = calculateOwnerShare(numEditFee, numEditTeacherShare);
  const isEditTeacherShareInvalid = numEditTeacherShare > numEditFee;

  // Map all existing active classes and slots to intervals for instantaneous pre-flight clash detection
  const existingIntervals: TimeInterval[] = useMemo(() => {
    const list: TimeInterval[] = [];
    for (const c of classes) {
      if (!c.active) continue;
      const classSlots = c.slots || (c.slot ? [c.slot] : []);
      for (const s of classSlots) {
        list.push({
          id: s.id,
          classId: c.id,
          className: c.name,
          grade: c.grade,
          teacherId: (c.teacherId || s.teacherId || "").trim(),
          teacherName: c.teacherName || s.teacherName || "",
          teacherIds: c.teacherIds || s.teacherIds || (c.teacherId ? [c.teacherId] : []),
          teachers: c.teachers || s.teachers,
          isMultiTeacher: c.isMultiTeacher || s.isMultiTeacher,
          weekday: Number(s.weekday),
          startTime: s.startTime,
          endTime: s.endTime,
        });
      }
    }
    return list;
  }, [classes]);

  // Live clash and warning detection for Create Class form
  const { formClashes, formGradeWarnings } = useMemo(() => {
    const clashes: Record<number, string> = {};
    const gradeWarnings: Record<number, string> = {};
    const selectedTeacher = teachers.find((t) => t.id === formTeacherId.trim());

    // 1. Check intra-draft collisions
    for (let i = 0; i < formSchedules.length; i++) {
      for (let j = i + 1; j < formSchedules.length; j++) {
        const a = formSchedules[i];
        const b = formSchedules[j];
        if (
          Number(a.weekday) === Number(b.weekday) &&
          a.startTime &&
          a.endTime &&
          b.startTime &&
          b.endTime &&
          doIntervalsOverlap(a.startTime, a.endTime, b.startTime, b.endTime)
        ) {
          const msg = `Session #${i + 1} and Session #${j + 1} overlap on ${getWeekdayName(a.weekday)}.`;
          if (!clashes[i]) clashes[i] = msg;
          if (!clashes[j]) clashes[j] = msg;
        }
      }
    }

    const activeTeacherIds = formIsMultiTeacher
      ? formCoTeachers.map((t) => t.teacherId.trim()).filter(Boolean)
      : (formTeacherId.trim() ? [formTeacherId.trim()] : []);

    // 2. Check collisions against existing teacher classes and room capacity
    formSchedules.forEach((sch, idx) => {
      if (clashes[idx]) return;
      if (!sch.startTime || !sch.endTime) return;
      if (sch.startTime >= sch.endTime) {
        clashes[idx] = "End time must be after start time.";
        return;
      }
      if (activeTeacherIds.length === 0) return;

      const candidateTeachers: ClassTeacherAssignment[] = formIsMultiTeacher
        ? formCoTeachers
            .filter((t) => t.teacherId.trim())
            .map((t, i) => ({
              teacherId: t.teacherId.trim(),
              teacherName: teachers.find((te) => te.id === t.teacherId.trim())?.name || "Teacher",
              splitPercentage: Number(t.splitPercentage) || 0,
              role: i === 0 ? "primary" : "co_teacher",
            }))
        : [
            {
              teacherId: formTeacherId.trim(),
              teacherName: selectedTeacher?.name || "The teacher",
              splitPercentage: 100,
              role: "primary",
            },
          ];

      const candidate: TimeInterval = {
        id: `draft-${idx}`,
        classId: "new-class",
        className: generateClassName(formGrade, formSubject) || "New Class",
        grade: formGrade,
        teacherId: activeTeacherIds[0],
        teacherName: candidateTeachers[0]?.teacherName || "The teacher",
        teacherIds: activeTeacherIds,
        teachers: candidateTeachers,
        isMultiTeacher: formIsMultiTeacher,
        weekday: Number(sch.weekday),
        startTime: sch.startTime,
        endTime: sch.endTime,
      };

      const result = checkClash(candidate, existingIntervals);
      if (result.hasClash && result.message) {
        clashes[idx] = result.message;
      } else if (result.hasGradeWarning && result.warningMessage) {
        gradeWarnings[idx] = result.warningMessage;
      }
    });

    return { formClashes: clashes, formGradeWarnings: gradeWarnings };
  }, [formSchedules, formTeacherId, formIsMultiTeacher, formCoTeachers, formGrade, formSubject, teachers, existingIntervals]);

  const hasFormClashes = Object.keys(formClashes).length > 0;
  const hasFormGradeWarnings = Object.keys(formGradeWarnings).length > 0;

  // Live clash and warning detection for Edit Class form
  const { editClashes, editGradeWarnings } = useMemo(() => {
    if (!editingClass) return { editClashes: {}, editGradeWarnings: {} };
    const clashes: Record<number, string> = {};
    const gradeWarnings: Record<number, string> = {};
    const selectedTeacher = teachers.find((t) => t.id === editTeacherId.trim());
    const otherIntervals = existingIntervals.filter((item) => item.classId !== editingClass.id);

    // 1. Check intra-draft collisions
    for (let i = 0; i < editSchedules.length; i++) {
      for (let j = i + 1; j < editSchedules.length; j++) {
        const a = editSchedules[i];
        const b = editSchedules[j];
        if (
          Number(a.weekday) === Number(b.weekday) &&
          a.startTime &&
          a.endTime &&
          b.startTime &&
          b.endTime &&
          doIntervalsOverlap(a.startTime, a.endTime, b.startTime, b.endTime)
        ) {
          const msg = `Session #${i + 1} and Session #${j + 1} overlap on ${getWeekdayName(a.weekday)}.`;
          if (!clashes[i]) clashes[i] = msg;
          if (!clashes[j]) clashes[j] = msg;
        }
      }
    }

    const activeTeacherIds = editIsMultiTeacher
      ? editCoTeachers.map((t) => t.teacherId.trim()).filter(Boolean)
      : (editTeacherId.trim() ? [editTeacherId.trim()] : []);

    // 2. Check collisions against other existing classes
    editSchedules.forEach((sch, idx) => {
      if (clashes[idx]) return;
      if (!sch.startTime || !sch.endTime) return;
      if (sch.startTime >= sch.endTime) {
        clashes[idx] = "End time must be after start time.";
        return;
      }
      if (activeTeacherIds.length === 0) return;

      const candidateTeachers: ClassTeacherAssignment[] = editIsMultiTeacher
        ? editCoTeachers
            .filter((t) => t.teacherId.trim())
            .map((t, i) => ({
              teacherId: t.teacherId.trim(),
              teacherName: teachers.find((te) => te.id === t.teacherId.trim())?.name || "Teacher",
              splitPercentage: Number(t.splitPercentage) || 0,
              role: i === 0 ? "primary" : "co_teacher",
            }))
        : [
            {
              teacherId: editTeacherId.trim(),
              teacherName: selectedTeacher?.name || "The teacher",
              splitPercentage: 100,
              role: "primary",
            },
          ];

      const candidate: TimeInterval = {
        id: sch.id || `edit-draft-${idx}`,
        classId: editingClass.id,
        className: generateClassName(editGrade, editSubject) || editingClass.name,
        grade: editGrade,
        teacherId: activeTeacherIds[0],
        teacherName: candidateTeachers[0]?.teacherName || "The teacher",
        teacherIds: activeTeacherIds,
        teachers: candidateTeachers,
        isMultiTeacher: editIsMultiTeacher,
        weekday: Number(sch.weekday),
        startTime: sch.startTime,
        endTime: sch.endTime,
      };

      const result = checkClash(candidate, otherIntervals);
      if (result.hasClash && result.message) {
        clashes[idx] = result.message;
      } else if (result.hasGradeWarning && result.warningMessage) {
        gradeWarnings[idx] = result.warningMessage;
      }
    });

    return { editClashes: clashes, editGradeWarnings: gradeWarnings };
  }, [editSchedules, editTeacherId, editIsMultiTeacher, editCoTeachers, editGrade, editSubject, editingClass, teachers, existingIntervals]);

  const hasEditClashes = Object.keys(editClashes).length > 0;
  const hasEditGradeWarnings = Object.keys(editGradeWarnings).length > 0;

  // Live duplicate class detection for Create Class form
  const formDuplicateClass = useMemo(() => {
    if (!formGrade.trim() || !formSubject.trim()) return null;
    const normGrade = formGrade.trim().toLowerCase();
    const normSubject = formSubject.trim().toLowerCase();
    const normTeacher = formTeacherId.trim();

    // Check exact match (Grade + Subject + Teacher)
    if (normTeacher) {
      const exactMatch = classes.find(
        (c) =>
          c.active &&
          c.grade.trim().toLowerCase() === normGrade &&
          c.subject.trim().toLowerCase() === normSubject &&
          (c.teacherId || "").trim() === normTeacher
      );
      if (exactMatch) {
        return {
          isDuplicate: true,
          isExactMatch: true,
          matchedClass: exactMatch,
          message: `A class for ${formGrade.trim()} ${formSubject.trim()} assigned to ${
            exactMatch.teacherName || "this teacher"
          } has already been created for this academic year.`,
        };
      }
    }

    // Check match for Grade + Subject in the academic year
    const gradeSubjectMatch = classes.find(
      (c) =>
        c.active &&
        c.grade.trim().toLowerCase() === normGrade &&
        c.subject.trim().toLowerCase() === normSubject
    );
    if (gradeSubjectMatch) {
      const teacherInfo = gradeSubjectMatch.teacherName
        ? ` (assigned to ${gradeSubjectMatch.teacherName})`
        : "";
      return {
        isDuplicate: true,
        isExactMatch: false,
        matchedClass: gradeSubjectMatch,
        message: `A class for ${formGrade.trim()} ${formSubject.trim()}${teacherInfo} has already been created for this academic year.`,
      };
    }

    return null;
  }, [classes, formGrade, formSubject, formTeacherId]);

  // Live duplicate class detection for Edit Class form
  const editDuplicateClass = useMemo(() => {
    if (!editingClass || !editGrade.trim() || !editSubject.trim()) return null;
    const normGrade = editGrade.trim().toLowerCase();
    const normSubject = editSubject.trim().toLowerCase();
    const normTeacher = editTeacherId.trim();

    const otherClasses = classes.filter((c) => c.id !== editingClass.id);

    // Check exact match (Grade + Subject + Teacher)
    if (normTeacher) {
      const exactMatch = otherClasses.find(
        (c) =>
          c.active &&
          c.grade.trim().toLowerCase() === normGrade &&
          c.subject.trim().toLowerCase() === normSubject &&
          (c.teacherId || "").trim() === normTeacher
      );
      if (exactMatch) {
        return {
          isDuplicate: true,
          isExactMatch: true,
          matchedClass: exactMatch,
          message: `A class for ${editGrade.trim()} ${editSubject.trim()} assigned to ${
            exactMatch.teacherName || "this teacher"
          } has already been created for this academic year.`,
        };
      }
    }

    // Check match for Grade + Subject
    const gradeSubjectMatch = otherClasses.find(
      (c) =>
        c.active &&
        c.grade.trim().toLowerCase() === normGrade &&
        c.subject.trim().toLowerCase() === normSubject
    );
    if (gradeSubjectMatch) {
      const teacherInfo = gradeSubjectMatch.teacherName
        ? ` (assigned to ${gradeSubjectMatch.teacherName})`
        : "";
      return {
        isDuplicate: true,
        isExactMatch: false,
        matchedClass: gradeSubjectMatch,
        message: `A class for ${editGrade.trim()} ${editSubject.trim()}${teacherInfo} has already been created for this academic year.`,
      };
    }

    return null;
  }, [classes, editingClass, editGrade, editSubject, editTeacherId]);

  async function executeCreateClass() {
    try {
      setFormSaving(true);
      const payload: any = {
        yearId: activeYear,
        grade: formGrade.trim(),
        subject: formSubject.trim(),
        color: formColor,
        terms: {
          monthlyFee: numFormFee,
          teacherSharePerStudent: numFormTeacherShare,
          requiredSessionsPerMonth: Number(formRequiredSessions) || 8,
          effectiveFromMonth: formEffectiveMonth.trim(),
        },
      };

      if (formIsMultiTeacher) {
        payload.isMultiTeacher = true;
        payload.teacherId = formCoTeachers[0].teacherId.trim();
        payload.teachers = formCoTeachers.map((t, idx) => ({
          teacherId: t.teacherId.trim(),
          splitPercentage: Number(t.splitPercentage) || 0,
          role: idx === 0 ? "primary" : "co_teacher",
        }));
        payload.teacherIds = formCoTeachers.map((t) => t.teacherId.trim());
      } else {
        payload.isMultiTeacher = false;
        payload.teacherId = formTeacherId.trim();
        payload.teachers = [];
        payload.teacherIds = [formTeacherId.trim()];
      }

      if (formSchedules.length > 0) {
        payload.schedules = formSchedules.map((s) => ({
          weekday: Number(s.weekday),
          startTime: s.startTime,
          endTime: s.endTime,
        }));
      }

      const res = await fetch("/api/owner/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSheetOpen(false);
        showToast(data.message || `Created ${data.classItem?.name} successfully.`, "success");
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

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!formGrade.trim()) {
      setFormError("Please select a grade level.");
      return;
    }
    if (!formSubject.trim()) {
      setFormError("Please select a subject.");
      return;
    }
    if (formIsMultiTeacher) {
      if (formCoTeachers.length < 2 || formCoTeachers.length > 3) {
        setFormError("A co-taught class requires 2 or 3 teachers.");
        return;
      }
      for (let i = 0; i < formCoTeachers.length; i++) {
        if (!formCoTeachers[i].teacherId.trim()) {
          setFormError(`Please select a teacher for Teacher #${i + 1}.`);
          return;
        }
      }
      const ids = formCoTeachers.map((t) => t.teacherId.trim());
      if (new Set(ids).size !== ids.length) {
        setFormError("Each assigned co-teacher must be unique.");
        return;
      }
      const totalSplit = formCoTeachers.reduce((sum, t) => sum + (Number(t.splitPercentage) || 0), 0);
      if (totalSplit !== 100) {
        setFormError(`Co-teacher revenue splits must sum to exactly 100%. (Current sum: ${totalSplit}%)`);
        return;
      }
    } else {
      if (!formTeacherId.trim()) {
        setFormError("Please assign a teacher.");
        return;
      }
    }
    if (formFee === "" || isNaN(Number(formFee))) {
      setFormError("Please enter a valid monthly student fee.");
      return;
    }
    if (formTeacherShare === "" || isNaN(Number(formTeacherShare))) {
      setFormError("Please enter a valid teacher share.");
      return;
    }
    if (isTeacherShareInvalid) {
      setFormError("Teacher share cannot exceed the monthly class fee.");
      return;
    }

    if (formDuplicateClass) {
      setFormError(formDuplicateClass.message);
      return;
    }

    if (hasFormClashes) {
      setFormError("Please resolve scheduling conflicts before creating this class.");
      return;
    }

    // Validate schedule sessions if added
    for (let i = 0; i < formSchedules.length; i++) {
      const s = formSchedules[i];
      if (!s.startTime || !s.endTime) {
        setFormError(`Please set start and end time for session #${i + 1}.`);
        return;
      }
      if (s.startTime >= s.endTime) {
        setFormError(`Session #${i + 1}: Start time must be earlier than end time.`);
        return;
      }
    }

    // If soft concurrent grade warnings exist, request explicit confirmation before creating
    if (hasFormGradeWarnings) {
      const warningsList = Object.values(formGradeWarnings).join("\n• ");
      setGradeDialogDetails({
        title: "Concurrent Grade Schedule",
        description: `Overlapping session(s) detected for ${formGrade}:\n\n• ${warningsList}\n\nStudents cannot attend both classes simultaneously. Proceed with scheduling?`,
        action: executeCreateClass,
      });
      setConfirmGradeDialogOpen(true);
      return;
    }

    await executeCreateClass();
  }

  async function executeEditClass() {
    if (!editingClass) return;
    try {
      setEditSaving(true);
      const payload: any = {
        yearId: activeYear,
        grade: editGrade.trim(),
        subject: editSubject.trim(),
        color: editColor,
        terms: {
          monthlyFee: numEditFee,
          teacherSharePerStudent: numEditTeacherShare,
          requiredSessionsPerMonth: Number(editRequiredSessions) || 8,
          effectiveFromMonth: editEffectiveMonth.trim(),
        },
        schedules: editSchedules.map((s) => ({
          id: s.id,
          weekday: Number(s.weekday),
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      };

      if (editIsMultiTeacher) {
        payload.isMultiTeacher = true;
        payload.teacherId = editCoTeachers[0].teacherId.trim();
        payload.teachers = editCoTeachers.map((t, idx) => ({
          teacherId: t.teacherId.trim(),
          splitPercentage: Number(t.splitPercentage) || 0,
          role: idx === 0 ? "primary" : "co_teacher",
        }));
        payload.teacherIds = editCoTeachers.map((t) => t.teacherId.trim());
      } else {
        payload.isMultiTeacher = false;
        payload.teacherId = editTeacherId.trim();
        payload.teachers = [];
        payload.teacherIds = [editTeacherId.trim()];
      }

      const res = await fetch(`/api/owner/classes/${editingClass.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setEditSheetOpen(false);
        showToast(data.message || "Class updated successfully.", "success");
        loadClasses();
      } else {
        setEditError(data.error || "Failed to update class.");
      }
    } catch {
      setEditError("Connection error while updating class.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleEditClass(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClass) return;
    setEditError("");

    if (!editGrade.trim() || !editSubject.trim()) {
      setEditError("Please select grade and subject.");
      return;
    }
    if (editIsMultiTeacher) {
      if (editCoTeachers.length < 2 || editCoTeachers.length > 3) {
        setEditError("A co-taught class requires 2 or 3 teachers.");
        return;
      }
      for (let i = 0; i < editCoTeachers.length; i++) {
        if (!editCoTeachers[i].teacherId.trim()) {
          setEditError(`Please select a teacher for Teacher #${i + 1}.`);
          return;
        }
      }
      const ids = editCoTeachers.map((t) => t.teacherId.trim());
      if (new Set(ids).size !== ids.length) {
        setEditError("Each assigned co-teacher must be unique.");
        return;
      }
      const totalSplit = editCoTeachers.reduce((sum, t) => sum + (Number(t.splitPercentage) || 0), 0);
      if (totalSplit !== 100) {
        setEditError(`Co-teacher revenue splits must sum to exactly 100%. (Current sum: ${totalSplit}%)`);
        return;
      }
    } else {
      if (!editTeacherId.trim()) {
        setEditError("Please assign a teacher.");
        return;
      }
    }
    if (editFee === "" || isNaN(Number(editFee))) {
      setEditError("Please enter a valid monthly student fee.");
      return;
    }
    if (editTeacherShare === "" || isNaN(Number(editTeacherShare))) {
      setEditError("Please enter a valid teacher share.");
      return;
    }
    if (isEditTeacherShareInvalid) {
      setEditError("Teacher share cannot exceed the monthly class fee.");
      return;
    }

    if (editDuplicateClass) {
      setEditError(editDuplicateClass.message);
      return;
    }

    if (hasEditClashes) {
      setEditError("Please resolve scheduling conflicts before saving this class.");
      return;
    }

    // Validate schedule sessions
    for (let i = 0; i < editSchedules.length; i++) {
      const s = editSchedules[i];
      if (!s.startTime || !s.endTime) {
        setEditError(`Please set start and end time for session #${i + 1}.`);
        return;
      }
      if (s.startTime >= s.endTime) {
        setEditError(`Session #${i + 1}: Start time must be earlier than end time.`);
        return;
      }
    }

    // If soft concurrent grade warnings exist, request explicit confirmation before saving
    if (hasEditGradeWarnings) {
      const warningsList = Object.values(editGradeWarnings).join("\n• ");
      setGradeDialogDetails({
        title: "Concurrent Grade Schedule",
        description: `Overlapping session(s) detected for ${editGrade}:\n\n• ${warningsList}\n\nStudents cannot attend both classes simultaneously. Proceed with scheduling?`,
        action: executeEditClass,
      });
      setConfirmGradeDialogOpen(true);
      return;
    }

    await executeEditClass();
  }

  async function handleDeleteClass() {
    if (!deletingClass) return;

    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/owner/classes/${deletingClass.id}?yearId=${activeYear}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok) {
        setDeleteDialogOpen(false);
        setDeletingClass(null);
        showToast(data.message || "Class deleted successfully.", "success");
        loadClasses();
      } else {
        showToast(data.error || "Failed to delete class.", "danger");
      }
    } catch {
      showToast("Connection error while deleting class.", "danger");
    } finally {
      setDeleteLoading(false);
    }
  }

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);

  // Reset page when search or grade filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedGrade]);

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

  const paginatedClasses = filteredClasses.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <OwnerShell pageTitle={activeYear ? `Classes (${activeYear})` : "Classes"}>
      <PageHeader
        title={activeYear ? `Classes & Curriculum (${activeYear})` : "Classes & Curriculum"}
        subtitle="Manage grade and subject combinations, weekly timetable sessions, and fee terms"
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
          <Select value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
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
          <Skeleton height="180px" />
          <Skeleton height="180px" />
          <Skeleton height="180px" />
          <Skeleton height="180px" />
          <Skeleton height="180px" />
          <Skeleton height="180px" />
        </div>
      ) : filteredClasses.length === 0 ? (
        <EmptyState
          title={
            search || selectedGrade !== "all"
              ? "No matching classes found"
              : "No classes registered yet"
          }
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
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedClasses.map((cls) => {
              const terms = cls.currentTerms || {
                monthlyFee: 0,
                teacherSharePerStudent: 0,
                requiredSessionsPerMonth: 8,
                effectiveFromMonth: "",
              };
              const classSlots = cls.slots || (cls.slot ? [cls.slot] : []);
              const theme = getClassColor(cls);

              return (
                <Card
                  key={cls.id}
                  className="p-4 flex flex-col justify-between h-full bg-white border border-[#E4E1DA] rounded-[8px] hover:border-[#1F5C4D]/40 transition-colors shadow-2xs relative overflow-hidden"
                  style={{ borderTop: `4px solid ${theme.accent}` }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <ClassBadge subject={cls.subject} color={cls.color} size="xs" />
                        <span className="text-[10px] font-semibold text-[#5F6670] bg-[#FAF9F6] border border-[#E4E1DA] px-1.5 py-0.2 rounded">
                          {cls.grade}
                        </span>
                      </div>
                      <Link
                        href={`/owner/classes/${cls.id}`}
                        className="font-serif font-semibold text-base text-[#1C1F23] hover:text-[#1F5C4D] transition-colors truncate block"
                      >
                        {cls.name}
                      </Link>
                      {cls.isMultiTeacher && cls.teachers && cls.teachers.length > 0 ? (
                        <div className="flex flex-col gap-1 mt-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-semibold bg-[#E6F0EC] text-[#1F5C4D] border border-[#1F5C4D]/30 px-1.5 py-0.2 rounded">
                              Co-Taught ({cls.teachers.length} Teachers)
                            </span>
                          </div>
                          <div className="flex items-start gap-1.5 text-xs text-[#5F6670]">
                            <GraduationCap className="w-3.5 h-3.5 shrink-0 text-[#1F5C4D] mt-0.5" strokeWidth={1.75} />
                            <span className="leading-snug">
                              {cls.teachers.map((t) => `${t.teacherName} (${t.splitPercentage}%)`).join(" & ")}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-[#5F6670] mt-0.5">
                          <GraduationCap className="w-3.5 h-3.5 shrink-0 text-[#1F5C4D]" strokeWidth={1.75} />
                          <span className="truncate">{cls.teacherName || "Unassigned Teacher"}</span>
                        </div>
                      )}
                    </div>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditSheet(cls)}
                      title={`Edit ${cls.name}`}
                      aria-label={`Edit ${cls.name}`}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[#5F6670] hover:text-[#1F5C4D] hover:bg-[#E6F0EC] border border-[#E4E1DA] hover:border-[#1F5C4D]/30 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteDialog(cls)}
                      title={`Delete ${cls.name}`}
                      aria-label={`Delete ${cls.name}`}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7] border border-[#E4E1DA] hover:border-[#A32A2A]/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                {/* Timetable Schedule Sessions */}
                <div className="py-2 flex flex-col gap-1 border-t border-[#E4E1DA]/60 my-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#5F6670] mb-0.5">
                    <Clock className="w-3 h-3 text-[#1F5C4D]" strokeWidth={2} />
                    <span>Weekly Schedule</span>
                  </div>
                  {classSlots.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {classSlots.map((s, idx) => (
                        <div
                          key={s.id || idx}
                          className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[#FAF9F6] border border-[#E4E1DA]/60 text-[#1C1F23]"
                        >
                          <span className="font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#1F5C4D]" />
                            {getWeekdayName(s.weekday)}
                          </span>
                          <span className="tabular-nums font-mono text-[11px] text-[#5F6670]">
                            {formatTimeRange(s.startTime, s.endTime)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-[#5F6670] italic py-0.5">
                      No weekly schedule set
                    </div>
                  )}
                </div>

                {/* Terms Breakdown */}
                <div className="pt-2 border-t border-[#E4E1DA]/60 flex flex-col gap-2">
                  {/* Fee & Target Cadence Row */}
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-[#5F6670] block">
                        Monthly Fee
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-base font-semibold text-[#1C1F23] tabular-nums">
                          <MoneyText amount={terms.monthlyFee} />
                        </span>
                        <span className="text-[11px] text-[#5F6670]">/ student</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-[#5F6670] block">
                        Target Cadence
                      </span>
                      <span className="text-xs font-semibold text-[#1C1F23] tabular-nums mt-0.5 block">
                        {terms.requiredSessionsPerMonth || 8} sessions <span className="font-normal text-[#5F6670]">/ mo</span>
                      </span>
                    </div>
                  </div>

                  {/* Revenue Split Bar */}
                  <div className="flex flex-col gap-1 text-xs bg-[#FAF9F6] px-2.5 py-1.5 rounded border border-[#E4E1DA]/80">
                    <div className="flex items-center justify-between">
                      <span className="text-[#5F6670]">
                        Teacher Share: <strong className="text-[#1C1F23] font-medium tabular-nums"><MoneyText amount={terms.teacherSharePerStudent} /></strong>
                      </span>
                      <span className="text-[#E4E1DA]">•</span>
                      <span className="text-[#5F6670]">
                        College: <strong className="text-[#1F5C4D] font-medium tabular-nums"><MoneyText amount={terms.ownerShare ?? terms.monthlyFee - terms.teacherSharePerStudent} /></strong>
                      </span>
                    </div>
                    {cls.isMultiTeacher && cls.teachers && cls.teachers.length > 0 && terms.teacherSharePerStudent > 0 && (
                      <div className="text-[10px] text-[#5F6670] border-t border-[#E4E1DA]/60 pt-1 flex items-center gap-2 flex-wrap">
                        {cls.teachers.map((t) => (
                          <span key={t.teacherId}>
                            {t.teacherName}: <strong className="text-[#1C1F23]"><MoneyText amount={Math.round((terms.teacherSharePerStudent * t.splitPercentage) / 100)} /></strong> ({t.splitPercentage}%)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer link */}
                <div className="flex items-center justify-between pt-2.5 border-t border-[#E4E1DA] mt-auto">
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#5F6670]">
                    <Users className="w-3.5 h-3.5 text-[#1F5C4D]" strokeWidth={1.75} />
                    <span className="tabular-nums font-semibold text-[#1C1F23]">
                      {cls.enrolledStudentCount ?? 0}
                    </span>
                    <span>enrolled</span>
                  </span>

                  <Link href={`/owner/classes/${cls.id}`}>
                    <Button variant="secondary" className="text-xs h-7 px-2.5 gap-1 text-[#1F5C4D] hover:bg-[#E6F0EC]">
                      <span>Students &amp; Details</span>
                      <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={filteredClasses.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            pageSizeOptions={[9, 18, 27]}
            onPageSizeChange={setPageSize}
            itemLabel="classes"
          />
        </div>
      )}

      {/* Create Class Bottom Sheet (No default values, supports multiple sessions) */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Create New Class">
        <form onSubmit={handleCreateClass} className="flex flex-col gap-4">
          {formError && (
            <div className="p-3 text-xs text-[#A32A2A] bg-[#FBE9E7] border border-[#A32A2A]/20 rounded">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="create-class-grade" label="Grade Level" required>
              <Select value={formGrade} onChange={(e) => handleFormGradeChange(e.target.value)} required>
                <option value="">-- Choose a grade --</option>
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
                onChange={(e) => handleFormSubjectChange(e.target.value)}
                required
              >
                <option value="">-- Choose a subject --</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {formGrade && formSubject && (
            <div className="p-2.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded text-xs">
              <span className="text-[#5F6670]">Generated Class Name:</span>
              <strong className="text-[#1C1F23] ml-2 font-semibold">
                {generateClassName(formGrade, formSubject)}
              </strong>
            </div>
          )}

          {/* Teacher Selection */}
          <div className="flex flex-col gap-2 p-3 bg-[#FAF9F6] border border-[#E4E1DA] rounded-[8px]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#1C1F23] flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                Teacher Assignment
              </label>

              {/* Multiple Teachers Tickbox */}
              <label className="flex items-center gap-1.5 text-xs text-[#1C1F23] cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="create-multi-teacher-check"
                  checked={formIsMultiTeacher}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setFormIsMultiTeacher(checked);
                    if (checked && formTeacherId && !formCoTeachers[0].teacherId) {
                      setFormCoTeachers([
                        { teacherId: formTeacherId, splitPercentage: 50 },
                        { teacherId: "", splitPercentage: 50 },
                      ]);
                    }
                  }}
                  className="rounded border-[#E4E1DA] text-[#1F5C4D] focus:ring-[#1F5C4D] w-3.5 h-3.5"
                />
                <span className="font-medium text-[#1F5C4D]">Multiple Teachers (Co-Teaching)</span>
              </label>
            </div>

            {!formIsMultiTeacher ? (
              <Field
                id="create-class-teacher"
                label="Assigned Teacher"
                hint={
                  !formSubject
                    ? "Select a subject above to view qualified teachers."
                    : displayedTeachers.length > 0
                    ? `Showing ${displayedTeachers.length} registered teacher(s) who teach ${formSubject}.`
                    : `No registered teachers teach ${formSubject}.`
                }
                required
              >
                <Select
                  id="create-class-teacher"
                  value={formTeacherId}
                  onChange={(e) => setFormTeacherId(e.target.value)}
                  required
                  disabled={!formSubject}
                >
                  {!formSubject ? (
                    <option value="">-- Choose a subject first --</option>
                  ) : displayedTeachers.length === 0 ? (
                    <option value="">-- No teachers registered for {formSubject} --</option>
                  ) : (
                    <>
                      <option value="">-- Choose a teacher --</option>
                      {displayedTeachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}{" "}
                          {t.subjects && t.subjects.length > 0 ? `(${t.subjects.join(", ")})` : ""}
                        </option>
                      ))}
                    </>
                  )}
                </Select>
              </Field>
            ) : (
              /* Co-Teaching Configuration */
              <div className="flex flex-col gap-2.5 mt-1">
                <div className="flex items-center justify-between text-xs text-[#5F6670] bg-white p-2 rounded border border-[#E4E1DA]">
                  <span>Assign 2 or 3 teachers with fixed percentage split.</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        formCoTeachers.reduce((s, t) => s + (Number(t.splitPercentage) || 0), 0) === 100
                          ? "bg-[#E6F0EC] text-[#1F5C4D] border border-[#1F5C4D]/30"
                          : "bg-[#FFF5F5] text-[#A32A2A] border border-[#A32A2A]/30"
                      }`}
                    >
                      Total Split: {formCoTeachers.reduce((s, t) => s + (Number(t.splitPercentage) || 0), 0)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => handleFormEqualizeSplit(formCoTeachers.length)}
                      className="text-[11px] text-[#1F5C4D] hover:underline font-medium cursor-pointer"
                    >
                      Equal Split
                    </button>
                  </div>
                </div>

                {formCoTeachers.map((co, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-white border border-[#E4E1DA] rounded-[6px] flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                  >
                    <div className="flex-1">
                      <label className="text-[11px] font-semibold text-[#5F6670] block mb-1">
                        {idx === 0 ? "Teacher 1 (Lead)" : `Teacher ${idx + 1} (Co-Teacher)`}
                      </label>
                      <Select
                        value={co.teacherId}
                        onChange={(e) => handleFormCoTeacherChange(idx, "teacherId", e.target.value)}
                        disabled={!formSubject}
                        className="text-xs"
                      >
                        <option value="">-- Choose teacher --</option>
                        {displayedTeachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="w-full sm:w-28">
                      <label className="text-[11px] font-semibold text-[#5F6670] block mb-1">
                        Split %
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={co.splitPercentage}
                          onChange={(e) =>
                            handleFormCoTeacherChange(idx, "splitPercentage", Number(e.target.value))
                          }
                          className="w-full text-xs h-8 px-2 pr-6 border border-[#E4E1DA] rounded bg-white text-[#1C1F23] focus:border-[#1F5C4D] focus:outline-none"
                        />
                        <span className="absolute right-2 top-2 text-xs text-[#5F6670]">%</span>
                      </div>
                    </div>

                    {formCoTeachers.length > 2 && idx === formCoTeachers.length - 1 && (
                      <div className="sm:self-end pb-0.5">
                        <button
                          type="button"
                          onClick={() => handleFormRemoveTeacher(idx)}
                          title="Remove Teacher"
                          className="h-8 px-2 text-xs text-[#A32A2A] hover:bg-[#FFF5F5] border border-[#A32A2A]/30 rounded transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {formCoTeachers.length < 3 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleFormAddTeacher}
                    className="text-xs h-7 self-start gap-1 text-[#1F5C4D]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add 3rd Teacher</span>
                  </Button>
                )}
              </div>
            )}

            {formSubject && displayedTeachers.length === 0 && (
              <div className="text-xs text-[#A32A2A] bg-[#FFF5F5] p-2.5 rounded border border-[#A32A2A]/20 flex flex-col gap-1">
                <span className="font-semibold">No teachers teach {formSubject}.</span>
                <span className="text-[11px] text-[#5F6670]">
                  To assign a teacher to this class, please add {formSubject} to their profile under Teachers first.
                </span>
              </div>
            )}

            {formDuplicateClass && (
              <div className="flex items-start gap-2.5 p-3 bg-[#FFF5F5] border border-[#A32A2A]/30 text-[#A32A2A] rounded-[6px] text-xs shadow-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#A32A2A]" strokeWidth={2} />
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-[#801F1F]">Class Already Created</span>
                  <span className="leading-relaxed text-[#1C1F23]">
                    {formDuplicateClass.message}
                  </span>
                </div>
              </div>
            )}

            {/* Class Theme Color */}
            <ColorPicker
              value={formColor}
              onChange={(c) => {
                setUserPickedColor(true);
                setFormColor(c);
              }}
              usedColors={Array.from(getUsedClassColors(classes))}
              label="Class Theme Color"
            />
          </div>

          {/* Weekly Timetable Sessions Card (Allows 1, 2, or multiple sessions; Monday 1st) */}
          <div className="p-3.5 border border-[#E4E1DA] rounded bg-[#FAF9F6] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                <h4 className="font-semibold text-xs text-[#1C1F23]">Weekly Timetable Sessions</h4>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={addCreateScheduleSession}
                className="text-xs h-7 px-2.5 gap-1 text-[#1F5C4D]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Session</span>
              </Button>
            </div>

            {formSchedules.length === 0 ? (
              <div className="p-3 bg-white border border-[#E4E1DA] rounded text-xs text-[#5F6670] text-center flex flex-col items-center gap-1.5">
                <p>No timetable sessions added yet.</p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addCreateScheduleSession}
                  className="text-xs h-7 px-2.5 gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add First Weekly Session</span>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {formSchedules.map((sch, idx) => {
                  const clashError = formClashes[idx];
                  return (
                    <div
                      key={idx}
                      className={`p-3 bg-white border rounded-[6px] flex flex-col gap-2.5 transition-colors ${
                        clashError ? "border-[#A32A2A] bg-[#FFF5F5]/70" : "border-[#E4E1DA]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#1C1F23]">
                          Session #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCreateSchedule(idx)}
                          className="text-[#5F6670] hover:text-[#A32A2A] p-1 rounded hover:bg-[#FBE9E7] transition-colors"
                          title="Remove session"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <Field id={`create-weekday-${idx}`} label="Day of Week" required>
                          <Select
                            value={sch.weekday}
                            onChange={(e) =>
                              updateCreateSchedule(idx, "weekday", Number(e.target.value))
                            }
                            required
                          >
                            {WEEKDAY_ORDER.map((w) => (
                              <option key={w.index} value={w.index}>
                                {w.name}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        <Field id={`create-start-${idx}`} label="Start Time" required>
                          <Input
                            type="time"
                            value={sch.startTime}
                            onChange={(e) =>
                              updateCreateSchedule(idx, "startTime", e.target.value)
                            }
                            required
                          />
                        </Field>

                        <Field id={`create-end-${idx}`} label="End Time" required>
                          <Input
                            type="time"
                            value={sch.endTime}
                            onChange={(e) =>
                              updateCreateSchedule(idx, "endTime", e.target.value)
                            }
                            required
                          />
                        </Field>
                      </div>

                      {sch.startTime && sch.endTime && !clashError && !formGradeWarnings[idx] && (
                        <div className="text-[11px] text-[#1F5C4D] bg-[#E6F0EC] px-2 py-1 rounded border border-[#1F5C4D]/20">
                          {getWeekdayName(sch.weekday)} • {formatTimeRange(sch.startTime, sch.endTime)}
                        </div>
                      )}

                      {sch.startTime && sch.endTime && !clashError && formGradeWarnings[idx] && (
                        <div className="flex items-start gap-1.5 p-2 bg-[#FFF8E1] text-[#8C6B00] rounded text-xs border border-[#B78103]/30">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#B78103]" strokeWidth={1.75} />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-[#664D00]">Concurrent Notice</span>
                            <span className="leading-snug">{formGradeWarnings[idx]}</span>
                          </div>
                        </div>
                      )}

                      {clashError && (
                        <div className="flex items-start gap-1.5 p-2 bg-[#FBE9E7] text-[#A32A2A] rounded text-xs border border-[#A32A2A]/20">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.75} />
                          <span className="font-medium">{clashError}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Class Terms Card (No prefilled default values) */}
          <div className="p-3.5 border border-[#E4E1DA] rounded bg-[#FAF9F6] flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
              <h4 className="font-semibold text-xs text-[#1C1F23]">Class Terms &amp; Rates</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="create-class-fee" label="Monthly Fee (LKR)" required>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="e.g. 3500"
                  value={formFee}
                  onChange={(e) => setFormFee(e.target.value)}
                  required
                />
              </Field>

              <Field id="create-class-share" label="Teacher Share (LKR)" required>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="e.g. 2500"
                  value={formTeacherShare}
                  onChange={(e) => setFormTeacherShare(e.target.value)}
                  required
                />
              </Field>
            </div>

            {/* Computed Owner Share Line */}
            {formFee !== "" && (
              <div className="p-2 bg-white rounded border border-[#E4E1DA] text-xs flex items-center justify-between">
                <span className="text-[#5F6670]">Computed College Share / Student:</span>
                <strong className="text-[#1F5C4D] tabular-nums font-semibold">
                  <MoneyText amount={computedOwnerShare} />
                </strong>
              </div>
            )}

            {isTeacherShareInvalid && (
              <div className="flex items-center gap-1.5 p-2 bg-[#FBE9E7] text-[#A32A2A] rounded text-xs border border-[#A32A2A]/20">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                <span>Teacher share cannot exceed the monthly class fee.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E4E1DA]">
              <Field id="create-class-sessions" label="Sessions / Month" required>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="e.g. 8"
                  value={formRequiredSessions}
                  onChange={(e) => setFormRequiredSessions(e.target.value)}
                  required
                />
              </Field>

              <Field id="create-class-effective-month" label="Effective Month" required>
                <Input
                  type="month"
                  value={formEffectiveMonth}
                  onChange={(e) => setFormEffectiveMonth(e.target.value)}
                  required
                />
              </Field>
            </div>
          </div>

          {hasFormClashes && (
            <div className="flex items-center gap-1.5 p-2.5 bg-[#FBE9E7] text-[#A32A2A] rounded text-xs border border-[#A32A2A]/30">
              <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2} />
              <span className="font-semibold">
                Scheduling conflict detected. Please resolve overlapping sessions before saving.
              </span>
            </div>
          )}

          {!hasFormClashes && hasFormGradeWarnings && (
            <div className="flex items-start gap-2 p-2.5 bg-[#FFF8E1] text-[#8C6B00] rounded text-xs border border-[#B78103]/30">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#B78103]" strokeWidth={2} />
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-[#664D00]">Concurrent Class Notice</span>
                <span className="text-[11px] leading-relaxed">
                  One or more sessions overlap with another class in this grade. Confirmation is required before saving.
                </span>
              </div>
            </div>
          )}

          {formDuplicateClass && (
            <div className="flex items-center gap-1.5 p-2.5 bg-[#FFF5F5] text-[#A32A2A] rounded text-xs border border-[#A32A2A]/30">
              <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2} />
              <span className="font-semibold">{formDuplicateClass.message}</span>
            </div>
          )}

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
              disabled={formSaving || isTeacherShareInvalid || hasFormClashes || Boolean(formDuplicateClass)}
              className="flex-1"
            >
              {formSaving ? "Creating..." : "Create Class"}
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Edit Class Bottom Sheet (Supports multiple sessions, Monday 1st) */}
      <BottomSheet
        open={editSheetOpen}
        onClose={() => setEditSheetOpen(false)}
        title={editingClass ? `Edit Class: ${editingClass.name}` : "Edit Class"}
      >
        <form onSubmit={handleEditClass} className="flex flex-col gap-4">
          {editError && (
            <div className="p-3 text-xs text-[#A32A2A] bg-[#FBE9E7] border border-[#A32A2A]/20 rounded">
              {editError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="edit-class-grade" label="Grade Level" required>
              <Select value={editGrade} onChange={(e) => setEditGrade(e.target.value)} required>
                <option value="">-- Choose a grade --</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field id="edit-class-subject" label="Subject" required>
              <Select
                value={editSubject}
                onChange={(e) => handleEditSubjectChange(e.target.value)}
                required
              >
                <option value="">-- Choose a subject --</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {editGrade && editSubject && (
            <div className="p-2.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded text-xs">
              <span className="text-[#5F6670]">Updated Class Name:</span>
              <strong className="text-[#1C1F23] ml-2 font-semibold">
                {generateClassName(editGrade, editSubject)}
              </strong>
            </div>
          )}

          {/* Teacher Selection */}
          <div className="flex flex-col gap-2 p-3 bg-[#FAF9F6] border border-[#E4E1DA] rounded-[8px]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#1C1F23] flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                Teacher Assignment
              </label>

              {/* Multiple Teachers Tickbox */}
              <label className="flex items-center gap-1.5 text-xs text-[#1C1F23] cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="edit-multi-teacher-check"
                  checked={editIsMultiTeacher}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEditIsMultiTeacher(checked);
                    if (checked && editTeacherId && !editCoTeachers[0].teacherId) {
                      setEditCoTeachers([
                        { teacherId: editTeacherId, splitPercentage: 50 },
                        { teacherId: "", splitPercentage: 50 },
                      ]);
                    }
                  }}
                  className="rounded border-[#E4E1DA] text-[#1F5C4D] focus:ring-[#1F5C4D] w-3.5 h-3.5"
                />
                <span className="font-medium text-[#1F5C4D]">Multiple Teachers (Co-Teaching)</span>
              </label>
            </div>

            {!editIsMultiTeacher ? (
              <Field
                id="edit-class-teacher"
                label="Assigned Teacher"
                hint={
                  !editSubject
                    ? "Select a subject above to view qualified teachers."
                    : editDisplayedTeachers.length > 0
                    ? `Showing ${editDisplayedTeachers.length} qualified teacher(s) who teach ${editSubject}.`
                    : `No registered teachers teach ${editSubject}.`
                }
                required
              >
                <Select
                  id="edit-class-teacher"
                  value={editTeacherId}
                  onChange={(e) => setEditTeacherId(e.target.value)}
                  required
                  disabled={!editSubject}
                >
                  {!editSubject ? (
                    <option value="">-- Choose a subject first --</option>
                  ) : editDisplayedTeachers.length === 0 ? (
                    <option value="">-- No teachers registered for {editSubject} --</option>
                  ) : (
                    <>
                      <option value="">-- Choose a teacher --</option>
                      {editDisplayedTeachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}{" "}
                          {t.subjects && t.subjects.length > 0 ? `(${t.subjects.join(", ")})` : ""}
                        </option>
                      ))}
                    </>
                  )}
                </Select>
              </Field>
            ) : (
              /* Co-Teaching Configuration */
              <div className="flex flex-col gap-2.5 mt-1">
                <div className="flex items-center justify-between text-xs text-[#5F6670] bg-white p-2 rounded border border-[#E4E1DA]">
                  <span>Assign 2 or 3 teachers with fixed percentage split.</span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        editCoTeachers.reduce((s, t) => s + (Number(t.splitPercentage) || 0), 0) === 100
                          ? "bg-[#E6F0EC] text-[#1F5C4D] border border-[#1F5C4D]/30"
                          : "bg-[#FFF5F5] text-[#A32A2A] border border-[#A32A2A]/30"
                      }`}
                    >
                      Total Split: {editCoTeachers.reduce((s, t) => s + (Number(t.splitPercentage) || 0), 0)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => handleEditEqualizeSplit(editCoTeachers.length)}
                      className="text-[11px] text-[#1F5C4D] hover:underline font-medium cursor-pointer"
                    >
                      Equal Split
                    </button>
                  </div>
                </div>

                {editCoTeachers.map((co, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-white border border-[#E4E1DA] rounded-[6px] flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                  >
                    <div className="flex-1">
                      <label className="text-[11px] font-semibold text-[#5F6670] block mb-1">
                        {idx === 0 ? "Teacher 1 (Lead)" : `Teacher ${idx + 1} (Co-Teacher)`}
                      </label>
                      <Select
                        value={co.teacherId}
                        onChange={(e) => handleEditCoTeacherChange(idx, "teacherId", e.target.value)}
                        disabled={!editSubject}
                        className="text-xs"
                      >
                        <option value="">-- Choose teacher --</option>
                        {editDisplayedTeachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="w-full sm:w-28">
                      <label className="text-[11px] font-semibold text-[#5F6670] block mb-1">
                        Split %
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={co.splitPercentage}
                          onChange={(e) =>
                            handleEditCoTeacherChange(idx, "splitPercentage", Number(e.target.value))
                          }
                          className="w-full text-xs h-8 px-2 pr-6 border border-[#E4E1DA] rounded bg-white text-[#1C1F23] focus:border-[#1F5C4D] focus:outline-none"
                        />
                        <span className="absolute right-2 top-2 text-xs text-[#5F6670]">%</span>
                      </div>
                    </div>

                    {editCoTeachers.length > 2 && idx === editCoTeachers.length - 1 && (
                      <div className="sm:self-end pb-0.5">
                        <button
                          type="button"
                          onClick={() => handleEditRemoveTeacher(idx)}
                          title="Remove Teacher"
                          className="h-8 px-2 text-xs text-[#A32A2A] hover:bg-[#FFF5F5] border border-[#A32A2A]/30 rounded transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {editCoTeachers.length < 3 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleEditAddTeacher}
                    className="text-xs h-7 self-start gap-1 text-[#1F5C4D]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add 3rd Teacher</span>
                  </Button>
                )}
              </div>
            )}

            {editSubject && editDisplayedTeachers.length === 0 && (
              <div className="text-xs text-[#A32A2A] bg-[#FFF5F5] p-2.5 rounded border border-[#A32A2A]/20 flex flex-col gap-1">
                <span className="font-semibold">No teachers teach {editSubject}.</span>
                <span className="text-[11px] text-[#5F6670]">
                  To assign a teacher to this class, please add {editSubject} to their profile under Teachers first.
                </span>
              </div>
            )}

            {editDuplicateClass && (
              <div className="flex items-start gap-2.5 p-3 bg-[#FFF5F5] border border-[#A32A2A]/30 text-[#A32A2A] rounded-[6px] text-xs shadow-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#A32A2A]" strokeWidth={2} />
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-[#801F1F]">Class Already Created</span>
                  <span className="leading-relaxed text-[#1C1F23]">
                    {editDuplicateClass.message}
                  </span>
                </div>
              </div>
            )}

            {/* Class Theme Color */}
            <ColorPicker
              value={editColor}
              onChange={setEditColor}
              usedColors={Array.from(getUsedClassColors(classes, editingClass?.id))}
              label="Class Theme Color"
            />
          </div>

          {/* Weekly Timetable Sessions Card (Edit/Add/Remove multiple sessions) */}
          <div className="p-3.5 border border-[#E4E1DA] rounded bg-[#FAF9F6] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                <h4 className="font-semibold text-xs text-[#1C1F23]">Weekly Timetable Sessions</h4>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={addEditScheduleSession}
                className="text-xs h-7 px-2.5 gap-1 text-[#1F5C4D]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Session</span>
              </Button>
            </div>

            {editSchedules.length === 0 ? (
              <div className="p-3 bg-white border border-[#E4E1DA] rounded text-xs text-[#5F6670] text-center flex flex-col items-center gap-1.5">
                <p>No timetable sessions currently scheduled.</p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addEditScheduleSession}
                  className="text-xs h-7 px-2.5 gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Weekly Session</span>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {editSchedules.map((sch, idx) => {
                  const clashError = editClashes[idx];
                  return (
                    <div
                      key={idx}
                      className={`p-3 bg-white border rounded-[6px] flex flex-col gap-2.5 transition-colors ${
                        clashError ? "border-[#A32A2A] bg-[#FFF5F5]/70" : "border-[#E4E1DA]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#1C1F23]">
                          Session #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeEditSchedule(idx)}
                          className="text-[#5F6670] hover:text-[#A32A2A] p-1 rounded hover:bg-[#FBE9E7] transition-colors"
                          title="Remove session"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <Field id={`edit-weekday-${idx}`} label="Day of Week" required>
                          <Select
                            value={sch.weekday}
                            onChange={(e) =>
                              updateEditSchedule(idx, "weekday", Number(e.target.value))
                            }
                            required
                          >
                            {WEEKDAY_ORDER.map((w) => (
                              <option key={w.index} value={w.index}>
                                {w.name}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        <Field id={`edit-start-${idx}`} label="Start Time" required>
                          <Input
                            type="time"
                            value={sch.startTime}
                            onChange={(e) =>
                              updateEditSchedule(idx, "startTime", e.target.value)
                            }
                            required
                          />
                        </Field>

                        <Field id={`edit-end-${idx}`} label="End Time" required>
                          <Input
                            type="time"
                            value={sch.endTime}
                            onChange={(e) =>
                              updateEditSchedule(idx, "endTime", e.target.value)
                            }
                            required
                          />
                        </Field>
                      </div>

                      {sch.startTime && sch.endTime && !clashError && !editGradeWarnings[idx] && (
                        <div className="text-[11px] text-[#1F5C4D] bg-[#E6F0EC] px-2 py-1 rounded border border-[#1F5C4D]/20">
                          {getWeekdayName(sch.weekday)} • {formatTimeRange(sch.startTime, sch.endTime)}
                        </div>
                      )}

                      {sch.startTime && sch.endTime && !clashError && editGradeWarnings[idx] && (
                        <div className="flex items-start gap-1.5 p-2 bg-[#FFF8E1] text-[#8C6B00] rounded text-xs border border-[#B78103]/30">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#B78103]" strokeWidth={1.75} />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-[#664D00]">Concurrent Notice</span>
                            <span className="leading-snug">{editGradeWarnings[idx]}</span>
                          </div>
                        </div>
                      )}

                      {clashError && (
                        <div className="flex items-start gap-1.5 p-2 bg-[#FBE9E7] text-[#A32A2A] rounded text-xs border border-[#A32A2A]/20">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.75} />
                          <span className="font-medium">{clashError}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Class Terms Card */}
          <div className="p-3.5 border border-[#E4E1DA] rounded bg-[#FAF9F6] flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
              <h4 className="font-semibold text-xs text-[#1C1F23]">Class Terms &amp; Rates</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="edit-class-fee" label="Monthly Fee (LKR)" required>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="e.g. 3500"
                  value={editFee}
                  onChange={(e) => setEditFee(e.target.value)}
                  required
                />
              </Field>

              <Field id="edit-class-share" label="Teacher Share (LKR)" required>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  placeholder="e.g. 2500"
                  value={editTeacherShare}
                  onChange={(e) => setEditTeacherShare(e.target.value)}
                  required
                />
              </Field>
            </div>

            {editFee !== "" && (
              <div className="p-2 bg-white rounded border border-[#E4E1DA] text-xs flex items-center justify-between">
                <span className="text-[#5F6670]">Computed College Share / Student:</span>
                <strong className="text-[#1F5C4D] tabular-nums font-semibold">
                  <MoneyText amount={editComputedOwnerShare} />
                </strong>
              </div>
            )}

            {isEditTeacherShareInvalid && (
              <div className="flex items-center gap-1.5 p-2 bg-[#FBE9E7] text-[#A32A2A] rounded text-xs border border-[#A32A2A]/20">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                <span>Teacher share cannot exceed the monthly class fee.</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E4E1DA]">
              <Field id="edit-class-sessions" label="Sessions / Month" required>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="e.g. 8"
                  value={editRequiredSessions}
                  onChange={(e) => setEditRequiredSessions(e.target.value)}
                  required
                />
              </Field>

              <Field id="edit-class-effective-month" label="Effective Month" required>
                <Input
                  type="month"
                  value={editEffectiveMonth}
                  onChange={(e) => setEditEffectiveMonth(e.target.value)}
                  required
                />
              </Field>
            </div>
          </div>

          {hasEditClashes && (
            <div className="flex items-center gap-1.5 p-2.5 bg-[#FBE9E7] text-[#A32A2A] rounded text-xs border border-[#A32A2A]/30">
              <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2} />
              <span className="font-semibold">
                Scheduling conflict detected. Please resolve overlapping sessions before saving.
              </span>
            </div>
          )}

          {!hasEditClashes && hasEditGradeWarnings && (
            <div className="flex items-start gap-2 p-2.5 bg-[#FFF8E1] text-[#8C6B00] rounded text-xs border border-[#B78103]/30">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#B78103]" strokeWidth={2} />
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-[#664D00]">Concurrent Class Notice</span>
                <span className="text-[11px] leading-relaxed">
                  One or more sessions overlap with another class in this grade. Confirmation is required before saving.
                </span>
              </div>
            </div>
          )}

          {editDuplicateClass && (
            <div className="flex items-center gap-1.5 p-2.5 bg-[#FFF5F5] text-[#A32A2A] rounded text-xs border border-[#A32A2A]/30">
              <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2} />
              <span className="font-semibold">{editDuplicateClass.message}</span>
            </div>
          )}

          <div className="flex gap-2 pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditSheetOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={editSaving || isEditTeacherShareInvalid || hasEditClashes || Boolean(editDuplicateClass)}
              className="flex-1"
            >
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Concurrent Grade Schedule Confirmation Dialog */}
      <ConfirmDialog
        open={confirmGradeDialogOpen}
        onClose={() => setConfirmGradeDialogOpen(false)}
        onConfirm={async () => {
          const act = gradeDialogDetails?.action;
          setConfirmGradeDialogOpen(false);
          if (act) await act();
        }}
        title={gradeDialogDetails?.title || "Confirm Concurrent Schedule"}
        description={gradeDialogDetails?.description || ""}
        confirmLabel="Confirm & Schedule"
        variant="primary"
        loading={formSaving || editSaving}
      />

      {/* Delete Class Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDeleteClass}
        title="Delete Class"
        description={`Are you sure you want to delete ${deletingClass?.name || "this class"}? If this class has past held sessions or student fee records, it will be safely deactivated and removed from the active timetable to preserve financial history. If it is new with no history, it will be permanently deleted.`}
        confirmLabel="Delete Class"
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
