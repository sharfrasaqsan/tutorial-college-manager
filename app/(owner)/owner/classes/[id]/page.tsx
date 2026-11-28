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
import { getClassColor, getUsedClassColors } from "@/lib/class-colors";
import { ClassBadge } from "@/components/ui/ClassBadge";
import { ColorPicker } from "@/components/ui/ColorPicker";
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
  Edit2,
  Trash2,
  X,
} from "lucide-react";
import type {
  ClassItem,
  ClassTerms,
  ClassEnrolment,
  Student,
  AcademicGrade,
  AcademicSubject,
  Teacher,
  TimetableSlot,
  TimeInterval,
  ClassTeacherAssignment,
} from "@/types";
import { calculateOwnerShare, generateClassName } from "@/lib/classes";
import { checkClash, doIntervalsOverlap } from "@/lib/clash";
import {
  getCurrentMonthKey,
  formatMonthDisplay,
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

  const [grades, setGrades] = useState<AcademicGrade[]>([]);
  const [subjects, setSubjects] = useState<AcademicSubject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allClasses, setAllClasses] = useState<ClassItem[]>([]);

  const [loading, setLoading] = useState(true);

  // Toast
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<ToastVariant>("info");

  // Edit Class Sheet
  const [editClassOpen, setEditClassOpen] = useState(false);
  const [editGrade, setEditGrade] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [editIsMultiTeacher, setEditIsMultiTeacher] = useState(false);
  const [editCoTeachers, setEditCoTeachers] = useState<Array<{ teacherId: string; splitPercentage: number }>>([
    { teacherId: "", splitPercentage: 50 },
    { teacherId: "", splitPercentage: 50 },
  ]);
  const [editShowAllTeachers, setEditShowAllTeachers] = useState(false);
  const [editFee, setEditFee] = useState<string>("");
  const [editTeacherShare, setEditTeacherShare] = useState<string>("");
  const [editRequiredSessions, setEditRequiredSessions] = useState<string>("");
  const [editEffectiveMonth, setEditEffectiveMonth] = useState<string>(getCurrentMonthKey());
  const [editSchedules, setEditSchedules] = useState<SessionDraft[]>([]);
  const [editColor, setEditColor] = useState<string>("blue");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Update Terms Sheet (standalone)
  const [termsSheetOpen, setTermsSheetOpen] = useState(false);
  const [termsFee, setTermsFee] = useState<string>("");
  const [termsTeacherShare, setTermsTeacherShare] = useState<string>("");
  const [termsRequiredSessions, setTermsRequiredSessions] = useState<string>("");
  const [termsEffectiveMonth, setTermsEffectiveMonth] = useState<string>(getCurrentMonthKey());
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

  // Roster Pagination
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterPageSize, setRosterPageSize] = useState(10);

  // Remove Enrolment Dialog
  const [removeDialogStudent, setRemoveDialogStudent] = useState<ClassEnrolment | null>(null);
  const [removing, setRemoving] = useState(false);

  // Delete Class Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (classId) {
      loadClassDetail();
      loadMetadata();
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

  async function loadMetadata() {
    try {
      const [acadRes, teachRes, classesRes] = await Promise.all([
        fetch("/api/owner/settings/academic"),
        fetch("/api/owner/teachers"),
        fetch("/api/owner/classes"),
      ]);

      const [acadData, teachData, classesData] = await Promise.all([
        acadRes.json(),
        teachRes.json(),
        classesRes.json(),
      ]);

      if (acadRes.ok) {
        if (acadData.grades) {
          setGrades(acadData.grades.filter((g: any) => !g.hidden));
        }
        if (acadData.subjects) {
          setSubjects(acadData.subjects.filter((s: any) => !s.hidden));
        }
      }

      if (teachRes.ok && teachData.teachers) {
        setTeachers(teachData.teachers.filter((t: any) => t.active));
      }

      if (classesRes.ok && classesData.classes) {
        setAllClasses(classesData.classes);
      }
    } catch {}
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

  function openEditSheet() {
    if (!classItem) return;
    setEditGrade(classItem.grade);
    setEditSubject(classItem.subject);
    setEditTeacherId(classItem.teacherId);
    if (classItem.isMultiTeacher && classItem.teachers && classItem.teachers.length > 0) {
      setEditIsMultiTeacher(true);
      setEditCoTeachers(
        classItem.teachers.map((t) => ({
          teacherId: t.teacherId,
          splitPercentage: t.splitPercentage,
        }))
      );
    } else {
      setEditIsMultiTeacher(false);
      setEditCoTeachers([
        { teacherId: classItem.teacherId || "", splitPercentage: 50 },
        { teacherId: "", splitPercentage: 50 },
      ]);
    }
    setEditShowAllTeachers(false);

    const currentTerms = classItem.currentTerms;
    setEditFee(currentTerms?.monthlyFee !== undefined ? String(currentTerms.monthlyFee) : "");
    setEditTeacherShare(currentTerms?.teacherSharePerStudent !== undefined ? String(currentTerms.teacherSharePerStudent) : "");
    setEditRequiredSessions(currentTerms?.requiredSessionsPerMonth !== undefined ? String(currentTerms.requiredSessionsPerMonth) : "");
    setEditEffectiveMonth(currentTerms?.effectiveFromMonth || getCurrentMonthKey());

    const existingSlots: TimetableSlot[] = classItem.slots || (classItem.slot ? [classItem.slot] : []);
    setEditSchedules(
      existingSlots.map((s) => ({
        id: s.id,
        weekday: s.weekday,
        startTime: s.startTime,
        endTime: s.endTime,
      }))
    );

    setEditColor(classItem.color || getClassColor(classItem).id);
    setEditError("");
    setEditClassOpen(true);
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

  function openTermsSheet() {
    if (!classItem) return;
    const current = classItem.currentTerms;
    setTermsFee(current?.monthlyFee !== undefined ? String(current.monthlyFee) : "");
    setTermsTeacherShare(current?.teacherSharePerStudent !== undefined ? String(current.teacherSharePerStudent) : "");
    setTermsRequiredSessions(current?.requiredSessionsPerMonth !== undefined ? String(current.requiredSessionsPerMonth) : "");
    setTermsEffectiveMonth(getCurrentMonthKey());
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

  const numEditFee = Number(editFee) || 0;
  const numEditTeacherShare = Number(editTeacherShare) || 0;
  const editComputedOwnerShare = calculateOwnerShare(numEditFee, numEditTeacherShare);
  const isEditTeacherShareInvalid = numEditTeacherShare > numEditFee;

  const numTermsFee = Number(termsFee) || 0;
  const numTermsTeacherShare = Number(termsTeacherShare) || 0;
  const termsComputedOwnerShare = calculateOwnerShare(numTermsFee, numTermsTeacherShare);
  const isTermsTeacherShareInvalid = numTermsTeacherShare > numTermsFee;

  const editMatchingTeachers = useMemo(() => {
    if (!editSubject) return [];
    return teachers.filter((t) =>
      t.subjects?.some((s) => s.toLowerCase() === editSubject.toLowerCase())
    );
  }, [teachers, editSubject]);

  const editDisplayedTeachers = useMemo(() => {
    if (!editSubject) {
      return editShowAllTeachers ? teachers : [];
    }
    if (editShowAllTeachers) {
      return teachers;
    }
    return editMatchingTeachers;
  }, [editSubject, editShowAllTeachers, teachers, editMatchingTeachers]);

  function handleEditSubjectChange(newSubj: string) {
    setEditSubject(newSubj);
    setEditShowAllTeachers(false);
    if (editTeacherId) {
      const currentTeacher = teachers.find((t) => t.id === editTeacherId);
      const teachesNew = currentTeacher?.subjects?.some(
        (s) => s.toLowerCase() === newSubj.toLowerCase()
      );
      if (!teachesNew) {
        setEditTeacherId("");
      }
    }
  }

  // Intervals from other active classes for clash detection
  const existingIntervals: TimeInterval[] = useMemo(() => {
    const list: TimeInterval[] = [];
    for (const c of allClasses) {
      if (!c.active || c.id === classId) continue;
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
  }, [allClasses, classId]);

  // Live clash detection for Edit Class form
  const editClashes = useMemo(() => {
    const clashes: Record<number, string> = {};
    const selectedTeacher = teachers.find((t) => t.id === editTeacherId.trim());

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
        classId,
        className: generateClassName(editGrade, editSubject) || (classItem?.name ?? "Class"),
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

      const result = checkClash(candidate, existingIntervals);
      if (result.hasClash && result.message) {
        clashes[idx] = result.message;
      }
    });

    return clashes;
  }, [editSchedules, editTeacherId, editIsMultiTeacher, editCoTeachers, editGrade, editSubject, classId, classItem, teachers, existingIntervals]);

  const hasEditClashes = Object.keys(editClashes).length > 0;

  async function handleEditClass(e: React.FormEvent) {
    e.preventDefault();
    if (!classItem) return;
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

    try {
      setEditSaving(true);
      const payload: any = {
        yearId: classItem.yearId,
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

      const res = await fetch(`/api/owner/classes/${classId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setEditClassOpen(false);
        showToast(data.message || "Class updated successfully.", "success");
        loadClassDetail();
      } else {
        setEditError(data.error || "Failed to update class.");
      }
    } catch {
      setEditError("Connection error while updating class.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteClass() {
    if (!classItem) return;

    try {
      setDeleting(true);
      const res = await fetch(
        `/api/owner/classes/${classId}?yearId=${classItem.yearId}`,
        { method: "DELETE" }
      );

      const data = await res.json();
      if (res.ok) {
        setDeleteDialogOpen(false);
        showToast(data.message || "Class deleted successfully.", "success");
        router.push("/owner/classes");
      } else {
        showToast(data.error || "Failed to delete class.", "danger");
      }
    } catch {
      showToast("Connection error while deleting class.", "danger");
    } finally {
      setDeleting(false);
    }
  }

  async function handleUpdateTerms(e: React.FormEvent) {
    e.preventDefault();
    setTermsError("");

    if (termsFee === "" || isNaN(Number(termsFee))) {
      setTermsError("Please enter a valid monthly student fee.");
      return;
    }
    if (termsTeacherShare === "" || isNaN(Number(termsTeacherShare))) {
      setTermsError("Please enter a valid teacher share.");
      return;
    }
    if (isTermsTeacherShareInvalid) {
      setTermsError("Teacher share cannot exceed the monthly class fee.");
      return;
    }

    try {
      setTermsSaving(true);
      const res = await fetch(
        `/api/owner/classes/${classId}/terms?yearId=${classItem?.yearId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            monthlyFee: numTermsFee,
            teacherSharePerStudent: numTermsTeacherShare,
            requiredSessionsPerMonth: Number(termsRequiredSessions) || 8,
            effectiveFromMonth: termsEffectiveMonth.trim(),
          }),
        }
      );

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
      const res = await fetch(
        `/api/owner/classes/${classId}/enrolments?yearId=${classItem?.yearId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentIds: selectedStudentIds,
            joinedMonth: enrollJoinedMonth.trim(),
          }),
        }
      );

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

  const matchingGradeStudents = allStudents.filter(
    (s) => s.grade.toLowerCase() === classItem.grade.toLowerCase()
  );
  const otherStudents = allStudents.filter(
    (s) => s.grade.toLowerCase() !== classItem.grade.toLowerCase()
  );
  const displayEnrolmentCandidates = showAllGrades
    ? [...matchingGradeStudents, ...otherStudents]
    : matchingGradeStudents;

  const classSlots: TimetableSlot[] = classItem.slots || (classItem.slot ? [classItem.slot] : []);
  const classTheme = getClassColor(classItem);

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
        subtitle={`${classItem.grade} • Teacher: ${
          classItem.isMultiTeacher && classItem.teachers && classItem.teachers.length > 0
            ? classItem.teachers.map((t) => `${t.teacherName} (${t.splitPercentage}%)`).join(", ")
            : classItem.teacherName || "Unassigned"
        } • Year ${classItem.yearId}`}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={openEditSheet}
              className="gap-1.5 text-xs h-9"
            >
              <Edit2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Edit Class</span>
            </Button>
            <Button
              variant="danger"
              onClick={() => setDeleteDialogOpen(true)}
              className="gap-1.5 text-xs h-9"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Delete Class</span>
            </Button>
            <Button
              variant="primary"
              onClick={openEnrollSheet}
              className="gap-1.5 text-xs h-9"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              <span>Enroll Students</span>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Details & Fee Terms */}
        <div className="lg:col-span-5 space-y-4">
          {/* Class Overview & Teacher Card */}
          <Card className="p-4 flex flex-col gap-3" style={{ borderTop: `4px solid ${classTheme.accent}` }}>
            <CardHeader className="p-0 pb-2.5 border-b border-[#E4E1DA]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <BookOpen className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                  <CardTitle>Class Information</CardTitle>
                  <ClassBadge
                    subject={classItem.subject}
                    name={classItem.name}
                    color={classItem.color}
                    size="xs"
                  />
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-[#E6F0EC] text-[#1F5C4D] border border-[#1F5C4D]/20">
                  {classItem.grade}
                </span>
              </div>
            </CardHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[#5F6670] block">Assigned Teacher</span>
                {classItem.isMultiTeacher && classItem.teachers && classItem.teachers.length > 0 ? (
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="text-[10px] font-semibold bg-[#E6F0EC] text-[#1F5C4D] border border-[#1F5C4D]/30 px-1.5 py-0.2 rounded w-fit">
                      Co-Taught ({classItem.teachers.length} Teachers)
                    </span>
                    {classItem.teachers.map((t) => (
                      <span key={t.teacherId} className="font-medium text-[#1C1F23] flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-[#1F5C4D]" strokeWidth={1.75} />
                        {t.teacherName} ({t.splitPercentage}%)
                        {t.role === "primary" && (
                          <span className="text-[10px] text-[#1F5C4D] bg-[#E6F0EC] px-1 rounded font-normal">Lead</span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="font-medium text-[#1C1F23] flex items-center gap-1.5 mt-0.5">
                    <GraduationCap className="w-3.5 h-3.5 text-[#1F5C4D]" strokeWidth={1.75} />
                    {classItem.teacherName || "Unassigned"}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[#5F6670] block">Subject</span>
                <span className="font-medium text-[#1C1F23] mt-0.5 block">{classItem.subject}</span>
              </div>
            </div>

            {/* Weekly Timetable Schedule Sessions (Renders all sessions) */}
            <div className="pt-2.5 border-t border-[#E4E1DA]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[#5F6670] font-medium text-xs flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#1F5C4D]" strokeWidth={1.75} />
                  Weekly Timetable Sessions
                </span>
                <Link
                  href="/owner/timetable"
                  className="text-[11px] text-[#1F5C4D] hover:underline font-medium"
                >
                  Open Timetable &rarr;
                </Link>
              </div>

              {classSlots.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {classSlots.map((s, idx) => (
                    <div
                      key={s.id || idx}
                      className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded bg-[#FAF9F6] border border-[#E4E1DA]/70 text-[#1C1F23]"
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
                <div className="p-2 bg-[#FAF9F6] text-[#5F6670] rounded border border-[#E4E1DA] text-xs italic">
                  No weekly sessions scheduled yet. Click "Edit Class" to add one.
                </div>
              )}
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
                <Button
                  variant="secondary"
                  onClick={openTermsSheet}
                  className="text-xs h-7 px-2.5 gap-1"
                >
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
                  <MoneyText
                    amount={
                      terms.ownerShare ?? terms.monthlyFee - terms.teacherSharePerStudent
                    }
                  />
                </span>
              </div>

              <div>
                <span className="text-[#5F6670] block">Required Sessions</span>
                <span className="font-semibold text-sm text-[#1C1F23] tabular-nums mt-0.5 block">
                  {terms.requiredSessionsPerMonth} sessions / mo
                </span>
              </div>
            </div>

            {classItem.isMultiTeacher && classItem.teachers && classItem.teachers.length > 0 && terms.teacherSharePerStudent > 0 && (
              <div className="pt-2 border-t border-[#E4E1DA]/60 flex flex-col gap-1 text-xs">
                <span className="text-[10px] uppercase font-semibold text-[#5F6670] tracking-wider">
                  Co-Teacher Share Breakdown (per student)
                </span>
                <div className="flex flex-col gap-1 bg-[#FAF9F6] p-2 rounded border border-[#E4E1DA]/80">
                  {classItem.teachers.map((t) => (
                    <div key={t.teacherId} className="flex items-center justify-between text-xs">
                      <span className="text-[#5F6670]">
                        {t.teacherName} ({t.splitPercentage}%):
                      </span>
                      <strong className="text-[#1C1F23] tabular-nums">
                        <MoneyText amount={Math.round((terms.teacherSharePerStudent * t.splitPercentage) / 100)} />
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                        Effective <strong>{h.effectiveFromMonth}</strong>: Fee{" "}
                        <MoneyText amount={h.monthlyFee} /> • Teacher{" "}
                        <MoneyText amount={h.teacherSharePerStudent} />
                      </span>
                      <span className="text-[#5F6670]">
                        Req: {h.requiredSessionsPerMonth} sess
                      </span>
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
                  <CardTitle>
                    Session Progress (
                    {sessionProgress
                      ? formatMonthDisplay(sessionProgress.month)
                      : "Current Month"}
                    )
                  </CardTitle>
                </div>
                <StatusChip status="neutral" label="Scheduled" />
              </div>
            </CardHeader>

            <div className="flex items-center justify-between text-xs bg-[#FAF9F6] p-3 rounded border border-[#E4E1DA]">
              <div>
                <span className="font-semibold text-sm text-[#1C1F23]">
                  {sessionProgress?.heldSessions ?? 0} of {terms.requiredSessionsPerMonth}{" "}
                  sessions held
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
                <Users
                  className="w-6 h-6 mx-auto mb-2 opacity-50 text-[#5F6670]"
                  strokeWidth={1.75}
                />
                <p className="font-medium text-[#1C1F23]">No students enrolled yet</p>
                <p className="text-[11px] text-[#5F6670] mt-1">
                  Click "Enroll Students" above to allocate students to this class.
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="divide-y divide-[#E4E1DA]">
                  {enrolledStudents
                    .slice((rosterPage - 1) * rosterPageSize, rosterPage * rosterPageSize)
                    .map((enrolment) => (
                    <div
                      key={enrolment.studentId}
                      className="py-3 flex items-center justify-between gap-3 text-xs hover:bg-[#FAF9F6]/50 px-1 rounded transition-colors"
                    >
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
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7] border border-[#E4E1DA] hover:border-[#A32A2A]/30 transition-colors cursor-pointer"
                          title={`Remove ${enrolment.studentName} from class`}
                          aria-label={`Remove ${enrolment.studentName} from class`}
                        >
                          <UserMinus className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination
                  currentPage={rosterPage}
                  totalItems={enrolledStudents.length}
                  pageSize={rosterPageSize}
                  onPageChange={setRosterPage}
                  pageSizeOptions={[10, 20, 50]}
                  onPageSizeChange={setRosterPageSize}
                  itemLabel="students"
                  compact
                />
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Edit Class Bottom Sheet (Multiple Sessions, Monday 1st) */}
      <BottomSheet
        open={editClassOpen}
        onClose={() => setEditClassOpen(false)}
        title={`Edit Class: ${classItem.name}`}
      >
        <form onSubmit={handleEditClass} className="flex flex-col gap-4">
          {editError && (
            <div className="p-3 text-xs text-[#A32A2A] bg-[#FBE9E7] border border-[#A32A2A]/20 rounded">
              {editError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="detail-edit-grade" label="Grade Level" required>
              <Select value={editGrade} onChange={(e) => setEditGrade(e.target.value)} required>
                <option value="">-- Choose a grade --</option>
                {grades.map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field id="detail-edit-subject" label="Subject" required>
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
                  id="detail-edit-multi-teacher-check"
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
              <>
                <Field
                  id="detail-edit-teacher"
                  label="Assigned Teacher"
                  hint={
                    !editSubject
                      ? "Select a subject above to view qualified teachers."
                      : editMatchingTeachers.length > 0 && !editShowAllTeachers
                      ? `Showing ${editMatchingTeachers.length} teacher(s) who teach ${editSubject}.`
                      : editMatchingTeachers.length === 0 && !editShowAllTeachers
                      ? `No active teachers currently teach ${editSubject}.`
                      : `Showing all active teachers (${teachers.length}).`
                  }
                  required
                >
                  <Select
                    id="detail-edit-teacher"
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

                {editSubject && editMatchingTeachers.length === 0 && !editShowAllTeachers && (
                  <div className="flex items-center justify-between text-xs text-[#A32A2A] bg-[#FAF9F6] p-2 rounded border border-[#E4E1DA]">
                    <span>No registered teachers teach {editSubject}.</span>
                    <button
                      type="button"
                      onClick={() => setEditShowAllTeachers(true)}
                      className="text-[#1F5C4D] font-medium hover:underline shrink-0 ml-2"
                    >
                      Show all teachers
                    </button>
                  </div>
                )}

                {editSubject && editMatchingTeachers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEditShowAllTeachers(!editShowAllTeachers)}
                    className="text-left text-[11px] text-[#1F5C4D] hover:underline self-start -mt-0.5"
                  >
                    {editShowAllTeachers
                      ? `Filter to teachers who teach ${editSubject} (${editMatchingTeachers.length})`
                      : `Show all active teachers (${teachers.length})`}
                  </button>
                )}

                {editSubject && editMatchingTeachers.length === 0 && editShowAllTeachers && (
                  <button
                    type="button"
                    onClick={() => setEditShowAllTeachers(false)}
                    className="text-left text-[11px] text-[#1F5C4D] hover:underline self-start -mt-0.5"
                  >
                    Filter back to {editSubject} only
                  </button>
                )}
              </>
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

            {/* Class Theme Color */}
            <ColorPicker
              value={editColor}
              onChange={setEditColor}
              usedColors={Array.from(getUsedClassColors(allClasses, classItem?.id))}
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
                        <Field id={`detail-edit-weekday-${idx}`} label="Day of Week" required>
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

                        <Field id={`detail-edit-start-${idx}`} label="Start Time" required>
                          <Input
                            type="time"
                            value={sch.startTime}
                            onChange={(e) =>
                              updateEditSchedule(idx, "startTime", e.target.value)
                            }
                            required
                          />
                        </Field>

                        <Field id={`detail-edit-end-${idx}`} label="End Time" required>
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

                      {sch.startTime && sch.endTime && !clashError && (
                        <div className="text-[11px] text-[#1F5C4D] bg-[#E6F0EC] px-2 py-1 rounded border border-[#1F5C4D]/20">
                          {getWeekdayName(sch.weekday)} • {formatTimeRange(sch.startTime, sch.endTime)}
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
              <Field id="detail-edit-fee" label="Monthly Fee (LKR)" required>
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

              <Field id="detail-edit-share" label="Teacher Share (LKR)" required>
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
              <Field id="detail-edit-sessions" label="Sessions / Month" required>
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

              <Field id="detail-edit-effective-month" label="Effective Month" required>
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

          <div className="flex gap-2 pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditClassOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={editSaving || isEditTeacherShareInvalid || hasEditClashes}
              className="flex-1"
            >
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Standalone Update Terms Bottom Sheet */}
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
              Changes will apply starting from the chosen effective month. Past months retain their
              existing terms for historical fees and salaries.
            </p>
          </div>

          <Field id="edit-terms-month" label="Effective Month" required>
            <Input
              type="month"
              value={termsEffectiveMonth}
              onChange={(e) => setTermsEffectiveMonth(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id="edit-terms-fee" label="Monthly Fee (LKR)" required>
              <Input
                type="number"
                min="0"
                step="100"
                placeholder="e.g. 3500"
                value={termsFee}
                onChange={(e) => setTermsFee(e.target.value)}
                required
              />
            </Field>

            <Field id="edit-terms-share" label="Teacher Share (LKR)" required>
              <Input
                type="number"
                min="0"
                step="100"
                placeholder="e.g. 2500"
                value={termsTeacherShare}
                onChange={(e) => setTermsTeacherShare(e.target.value)}
                required
              />
            </Field>
          </div>

          {termsFee !== "" && (
            <div className="p-2.5 bg-white rounded border border-[#E4E1DA] text-xs flex items-center justify-between">
              <span className="text-[#5F6670]">Computed College Share / Student:</span>
              <strong className="text-[#1F5C4D] tabular-nums font-semibold">
                <MoneyText amount={termsComputedOwnerShare} />
              </strong>
            </div>
          )}

          {isTermsTeacherShareInvalid && (
            <div className="flex items-center gap-1.5 p-2 bg-[#FBE9E7] text-[#A32A2A] rounded text-xs border border-[#A32A2A]/20">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
              <span>Teacher share cannot exceed the monthly class fee.</span>
            </div>
          )}

          <Field id="edit-terms-sessions" label="Sessions / Month" required>
            <Input
              type="number"
              min="1"
              max="31"
              placeholder="e.g. 8"
              value={termsRequiredSessions}
              onChange={(e) => setTermsRequiredSessions(e.target.value)}
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
              disabled={termsSaving || isTermsTeacherShareInvalid}
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

      {/* Delete Class Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Class"
        description={`Are you sure you want to delete ${classItem.name}? If this class has past held sessions or student fee records, it will be safely deactivated and removed from the active timetable to preserve financial history. If it is new with no history, it will be permanently deleted.`}
        confirmLabel={deleting ? "Deleting..." : "Delete Class"}
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteClass}
        onClose={() => setDeleteDialogOpen(false)}
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
