"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getClassColor } from "@/lib/class-colors";
import { getSlotActivityInfo, validateSlotDatesNotInPast, isSlotLiveNow } from "@/lib/timetable";
import { ClassBadge } from "@/components/ui/ClassBadge";
import {
  Calendar,
  Clock,
  User,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Filter,
  GraduationCap,
  Layers,
  LayoutGrid,
  List,
  RotateCw,
  Zap,
  BookOpen,
  MoveHorizontal,
} from "lucide-react";
import {
  WEEKDAY_NAMES,
  SHORT_WEEKDAY_NAMES,
  WEEKDAY_ORDER,
  formatTimeDisplay,
  formatTimeRange,
  calculateDuration,
  getColomboNow,
} from "@/lib/dates";
import { format, parseISO, addDays } from "date-fns";
import type { TimetableSlot } from "@/types";

interface ClassOption {
  id: string;
  name: string;
  grade: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  color?: string;
}

export default function OwnerTimetablePage() {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeYear, setActiveYear] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    variant: "success" | "danger" | "warning";
  } | null>(null);

  // Active phone tab (0 = Sunday, 1 = Monday ... 6 = Saturday)
  const currentWeekday = getColomboNow().getDay();
  const [activeDayTab, setActiveDayTab] = useState<number>(currentWeekday);

  // Filters
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>("all");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "day">("grid");

  const [nowTick, setNowTick] = useState<Date | null>(null);

  useEffect(() => {
    setNowTick(getColomboNow());
    const timer = setInterval(() => setNowTick(getColomboNow()), 30000);
    return () => clearInterval(timer);
  }, []);

  // BottomSheet modal state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);

  // Modal form fields
  const [formSlotType, setFormSlotType] = useState<"regular" | "extra">("regular");
  const [formClassId, setFormClassId] = useState("");
  const [formWeekday, setFormWeekday] = useState<number>(1);
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("11:00");
  const [formValidFrom, setFormValidFrom] = useState("2026-01-01");
  const [formValidTo, setFormValidTo] = useState("2026-12-31");
  const [formSpecificDate, setFormSpecificDate] = useState("");
  const [formCountsForMonth, setFormCountsForMonth] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Live clash detection state
  const [clashStatus, setClashStatus] = useState<{
    checking: boolean;
    hasClash: boolean;
    message?: string;
    hasGradeWarning?: boolean;
    warningMessage?: string;
    gradeConflictClass?: string;
  }>({ checking: false, hasClash: false });

  // Concurrent Grade Schedule Confirmation Dialog
  const [gradeConfirmOpen, setGradeConfirmOpen] = useState(false);
  const [pendingSlotSubmit, setPendingSlotSubmit] = useState<(() => Promise<void>) | null>(null);

  // Delete slot dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<TimetableSlot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load slots and classes
  const loadTimetableData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/owner/timetable/slots");
      if (!res.ok) throw new Error("Failed to load timetable slots.");
      const data = await res.json();
      setSlots(data.slots || []);
      setClasses(data.classes || []);
      if (data.yearId) {
        setActiveYear(data.yearId);
      }
    } catch (err: any) {
      setToastMessage({
        text: err.message || "Failed to load timetable.",
        variant: "danger",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimetableData();
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setViewMode("day");
    }
  }, [loadTimetableData]);

  // Unique teachers and grades for filter dropdowns
  const availableTeachers = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((c) => {
      if (c.teacherId && c.teacherName) {
        map.set(c.teacherId, c.teacherName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [classes]);

  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    classes.forEach((c) => {
      if (c.grade) set.add(c.grade);
    });
    return Array.from(set).sort();
  }, [classes]);

  // Today string (Asia/Colombo) for filtering out past temporary/expired slots on Master Timetable
  const todayStr = useMemo(() => format(getColomboNow(), "yyyy-MM-dd"), []);

  // Filter slots: Master Timetable shows all active regular classes, upcoming extra classes, and upcoming schedule changes
  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (selectedTeacherFilter !== "all" && slot.teacherId !== selectedTeacherFilter) {
        return false;
      }
      if (selectedGradeFilter !== "all" && slot.grade !== selectedGradeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (slot.className || "").toLowerCase().includes(q);
        const matchSubject = (slot.subject || "").toLowerCase().includes(q);
        const matchTeacher = (slot.teacherName || "").toLowerCase().includes(q);
        const matchGrade = (slot.grade || "").toLowerCase().includes(q);
        if (!matchName && !matchSubject && !matchTeacher && !matchGrade) {
          return false;
        }
      }

      return !getSlotActivityInfo(slot, todayStr).isExpired;
    });
  }, [slots, selectedTeacherFilter, selectedGradeFilter, searchQuery, todayStr]);

  // Slots grouped by weekday (0 to 6)
  const slotsByDay = useMemo(() => {
    const map: Record<number, TimetableSlot[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };
    filteredSlots.forEach((s) => {
      if (map[s.weekday]) {
        map[s.weekday].push(s);
      }
    });
    return map;
  }, [filteredSlots]);

  // Unique chronological time bands across all filtered slots
  const timeBands = useMemo(() => {
    const map = new Map<string, { startTime: string; endTime: string }>();
    filteredSlots.forEach((slot) => {
      const key = `${slot.startTime}-${slot.endTime}`;
      if (!map.has(key)) {
        map.set(key, { startTime: slot.startTime, endTime: slot.endTime });
      }
    });

    const sorted = Array.from(map.values()).sort((a, b) => {
      const cmp = a.startTime.localeCompare(b.startTime);
      if (cmp !== 0) return cmp;
      return a.endTime.localeCompare(b.endTime);
    });

    return sorted.map((b) => ({
      id: `${b.startTime}-${b.endTime}`,
      startTime: b.startTime,
      endTime: b.endTime,
      label: `${formatTimeDisplay(b.startTime)} - ${formatTimeDisplay(b.endTime)}`,
      duration: calculateDuration(b.startTime, b.endTime),
    }));
  }, [filteredSlots]);

  // Calculate next date for a target weekday within the selected academic year
  function getNextDateForWeekday(targetWeekday: number, year: string): string {
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    let base = today;
    if (!todayStr.startsWith(year)) {
      base = new Date(`${year}-01-01T00:00:00`);
    }
    const currentDay = base.getDay();
    const diff = (targetWeekday - currentDay + 7) % 7;
    const targetDate = addDays(base, diff);
    return format(targetDate, "yyyy-MM-dd");
  }

  // Handle specific date change for temporary/extra classes
  function handleDateChange(val: string) {
    setFormSpecificDate(val);
    if (val) {
      try {
        const d = parseISO(val);
        setFormWeekday(d.getDay());
        setFormCountsForMonth(val.substring(0, 7));
      } catch { }
    }
  }

  // Open modal with pre-selected day and time slot
  function handleOpenCreateForCell(weekday: number, startTime?: string, endTime?: string) {
    const yr = activeYear || "2027";
    const nextDate = getNextDateForWeekday(weekday, yr);
    setEditingSlot(null);
    setFormSlotType("regular");
    setFormClassId(classes[0]?.id || "");
    setFormWeekday(weekday);
    setFormStartTime(startTime || "09:00");
    setFormEndTime(endTime || "11:00");
    const defaultFrom = todayStr > `${yr}-01-01` ? todayStr : `${yr}-01-01`;
    const defaultTo = todayStr > `${yr}-12-31` ? todayStr : `${yr}-12-31`;
    setFormValidFrom(defaultFrom);
    setFormValidTo(defaultTo);
    setFormSpecificDate(nextDate);
    setFormCountsForMonth(nextDate.substring(0, 7));
    setFormNote("");
    setFormError("");
    setClashStatus({ checking: false, hasClash: false });
    setSheetOpen(true);
  }

  // Live clash check effect
  useEffect(() => {
    if (!sheetOpen) return;
    if (!formClassId || !formStartTime || !formEndTime) {
      setClashStatus({ checking: false, hasClash: false });
      return;
    }

    if (formStartTime >= formEndTime) {
      setClashStatus({
        checking: false,
        hasClash: true,
        message: "End time must be after start time.",
      });
      return;
    }

    const selectedClass = classes.find((c) => c.id === formClassId);
    if (!selectedClass) return;

    const timer = setTimeout(async () => {
      try {
        setClashStatus((prev) => ({ ...prev, checking: true }));
        const res = await fetch("/api/owner/timetable/clash-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            yearId: activeYear,
            slotId: editingSlot?.id,
            classId: formClassId,
            className: selectedClass.name,
            grade: selectedClass.grade,
            teacherId: selectedClass.teacherId,
            teacherName: selectedClass.teacherName,
            weekday: formWeekday,
            startTime: formStartTime,
            endTime: formEndTime,
            specificDate: formSlotType === "extra" ? formSpecificDate : undefined,
            isTemporary: formSlotType === "extra",
          }),
        });
        const data = await res.json();
        setClashStatus({
          checking: false,
          hasClash: Boolean(data.hasClash),
          message: data.message,
          hasGradeWarning: Boolean(data.hasGradeWarning),
          warningMessage: data.warningMessage,
          gradeConflictClass: data.gradeConflictClass,
        });
      } catch {
        setClashStatus({ checking: false, hasClash: false });
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [
    sheetOpen,
    formClassId,
    formWeekday,
    formStartTime,
    formEndTime,
    formSlotType,
    formSpecificDate,
    editingSlot,
    classes,
  ]);

  // Open modal for new slot
  function handleOpenCreate() {
    const yr = activeYear || "2027";
    const nextDate = getNextDateForWeekday(activeDayTab, yr);
    setEditingSlot(null);
    setFormSlotType("regular");
    setFormClassId(classes[0]?.id || "");
    setFormWeekday(activeDayTab);
    setFormStartTime("09:00");
    setFormEndTime("11:00");
    const defaultFrom = todayStr > `${yr}-01-01` ? todayStr : `${yr}-01-01`;
    const defaultTo = todayStr > `${yr}-12-31` ? todayStr : `${yr}-12-31`;
    setFormValidFrom(defaultFrom);
    setFormValidTo(defaultTo);
    setFormSpecificDate(nextDate);
    setFormCountsForMonth(nextDate.substring(0, 7));
    setFormNote("");
    setFormError("");
    setClashStatus({ checking: false, hasClash: false });
    setSheetOpen(true);
  }

  // Open modal for editing slot
  function handleOpenEdit(slot: TimetableSlot) {
    const yr = activeYear || "2027";
    const isExtra = Boolean(
      slot.isTemporary ||
      slot.slotType === "extra" ||
      (slot.validFrom && slot.validFrom === slot.validTo)
    );
    setEditingSlot(slot);
    setFormSlotType(isExtra ? "extra" : "regular");
    setFormClassId(slot.classId);
    setFormWeekday(slot.weekday);
    setFormStartTime(slot.startTime);
    setFormEndTime(slot.endTime);
    setFormValidFrom(slot.validFrom || `${yr}-01-01`);
    setFormValidTo(slot.validTo || `${yr}-12-31`);
    const dateVal = slot.specificDate || (isExtra && slot.validFrom ? slot.validFrom : getNextDateForWeekday(slot.weekday, yr));
    setFormSpecificDate(dateVal);
    setFormCountsForMonth(slot.countsForMonth || dateVal.substring(0, 7));
    setFormNote(slot.note || "");
    setFormError("");
    setClashStatus({ checking: false, hasClash: false });
    setSheetOpen(true);
  }

  async function executeSubmitSlot() {
    try {
      setFormSubmitting(true);
      const isEdit = Boolean(editingSlot);
      const url = isEdit
        ? `/api/owner/timetable/slots/${editingSlot!.id}`
        : "/api/owner/timetable/slots";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yearId: activeYear,
          classId: formClassId,
          weekday: Number(formWeekday),
          startTime: formStartTime,
          endTime: formEndTime,
          validFrom: formSlotType === "extra" ? formSpecificDate : formValidFrom,
          validTo: formSlotType === "extra" ? formSpecificDate : formValidTo,
          isTemporary: formSlotType === "extra",
          slotType: formSlotType,
          specificDate: formSlotType === "extra" ? formSpecificDate : undefined,
          countsForMonth: formSlotType === "extra" ? formCountsForMonth : undefined,
          note: formNote ? formNote.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save timetable slot.");
      }

      setToastMessage({
        text: isEdit
          ? "Timetable slot and future scheduled sessions updated."
          : formSlotType === "extra"
            ? "Temporary / Extra class scheduled successfully (Countable towards monthly sessions)."
            : `Timetable slot created (${data.sessionsCount || 0} sessions scheduled).`,
        variant: "success",
      });

      setSheetOpen(false);
      await loadTimetableData();
    } catch (err: any) {
      setFormError(err.message || "Failed to save slot.");
    } finally {
      setFormSubmitting(false);
    }
  }

  // Submit slot creation / edit
  async function handleSubmitSlot(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!formClassId) {
      setFormError("Please select a class.");
      return;
    }
    const dateError = validateSlotDatesNotInPast({
      isExtra: formSlotType === "extra",
      specificDate: formSpecificDate,
      validFrom: formValidFrom,
      validTo: formValidTo,
      todayStr,
      isEdit: Boolean(editingSlot),
    });
    if (dateError) {
      setFormError(dateError);
      return;
    }
    if (formStartTime >= formEndTime) {
      setFormError("End time must be after start time.");
      return;
    }
    if (clashStatus.hasClash) {
      setFormError(clashStatus.message || "Scheduling conflict detected.");
      return;
    }

    // If soft concurrent grade warnings exist, prompt for confirmation
    if (clashStatus.hasGradeWarning) {
      setPendingSlotSubmit(() => executeSubmitSlot);
      setGradeConfirmOpen(true);
      return;
    }

    await executeSubmitSlot();
  }

  // Open delete dialog
  function handleOpenDelete(slot: TimetableSlot) {
    setSlotToDelete(slot);
    setDeleteConfirmOpen(true);
  }

  // Execute deletion
  async function handleDeleteSlot() {
    if (!slotToDelete) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/owner/timetable/slots/${slotToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete slot.");

      setToastMessage({
        text: `Slot deleted. ${data.deletedSessionsCount || 0} future scheduled sessions removed.`,
        variant: "success",
      });
      setDeleteConfirmOpen(false);
      setSlotToDelete(null);
      await loadTimetableData();
    } catch (err: any) {
      setToastMessage({
        text: err.message || "Failed to delete slot.",
        variant: "danger",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <OwnerShell
      pageTitle={activeYear ? `Weekly Timetable (${activeYear})` : "Weekly Timetable"}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="mb-4">
          <Toast
            message={toastMessage.text}
            variant={toastMessage.variant}
            onDismiss={() => setToastMessage(null)}
          />
        </div>
      )}

      {/* Header with Classes & Add Slot CTAs */}
      <PageHeader
        title={activeYear ? `Weekly Timetable (${activeYear})` : "Weekly Timetable"}
        subtitle="Manage recurring weekly class slots, teacher allocation & room capacity"
        action={
          <div className="flex items-center gap-2">
            <Link href="/owner/classes">
              <Button variant="secondary" className="gap-1.5 text-xs h-9">
                <BookOpen className="w-4 h-4" strokeWidth={1.75} />
                <span>Classes</span>
              </Button>
            </Link>
            <Button
              variant="primary"
              onClick={handleOpenCreate}
              className="gap-1.5 text-xs h-9 shadow-none"
              disabled={classes.length === 0}
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              <span>Add Slot</span>
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row gap-2.5 mb-3">
        <div className="flex-1">
          <Input
            type="search"
            placeholder="Search timetable by class, subject, or teacher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap gap-2.5">
          <div className="w-full sm:w-40 shrink-0">
            <Select
              id="filter-grade"
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
            >
              <option value="all">All Grades ({availableGrades.length})</option>
              {availableGrades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-full sm:w-44 shrink-0">
            <Select
              id="filter-teacher"
              value={selectedTeacherFilter}
              onChange={(e) => setSelectedTeacherFilter(e.target.value)}
            >
              <option value="all">All Teachers ({availableTeachers.length})</option>
              {availableTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* Summary Bar & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#5F6670]">
          <span className="font-medium text-[#1C1F23]">
            Total: <strong className="font-semibold">{filteredSlots.length}</strong> active slot{filteredSlots.length === 1 ? "" : "s"}
            {activeYear && ` in Year ${activeYear}`}
          </span>
          <StatusChip status="neutral" label="Max 3 Rooms" />
          {(selectedTeacherFilter !== "all" ||
            selectedGradeFilter !== "all" ||
            searchQuery.trim()) && (
              <Button
                variant="quiet"
                onClick={() => {
                  setSelectedTeacherFilter("all");
                  setSelectedGradeFilter("all");
                  setSearchQuery("");
                }}
                className="text-xs h-7 px-2 text-[#5F6670] hover:text-[#1C1F23]"
              >
                Reset Filters
              </Button>
            )}
        </div>

        {/* View Mode & Responsive Grid Switchers */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">


          <div className="w-full sm:w-auto grid grid-cols-2 sm:flex items-center border border-[#E4E1DA] rounded-[6px] p-0.5 bg-[#FAF9F6]">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`py-1.5 sm:py-1 px-2.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${viewMode === "grid"
                ? "bg-white text-[#1C1F23] shadow-2xs font-semibold"
                : "text-[#5F6670] hover:text-[#1C1F23]"
                }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Weekly Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={`py-1.5 sm:py-1 px-2.5 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${viewMode === "day"
                ? "bg-white text-[#1C1F23] shadow-2xs font-semibold"
                : "text-[#5F6670] hover:text-[#1C1F23]"
                }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Day View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Timetable Content */}
      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : slots.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-8 h-8 text-[#5F6670]" strokeWidth={1.5} />}
          title="No timetable slots created yet"
          description="Build your college schedule by adding recurring weekly class slots. Clash detection prevents teacher overlaps and enforces room capacity."
          action={
            classes.length > 0 ? (
              <Button variant="primary" onClick={handleOpenCreate}>
                <Plus className="w-4 h-4 mr-1.5" strokeWidth={2} />
                Create First Slot
              </Button>
            ) : undefined
          }
        />
      ) : filteredSlots.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-8 h-8 text-[#5F6670]" strokeWidth={1.5} />}
          title="No matching timetable slots found"
          description="Try adjusting your search query, grade, or teacher filter."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedTeacherFilter("all");
                setSelectedGradeFilter("all");
                setSearchQuery("");
              }}
            >
              Reset Filters
            </Button>
          }
        />
      ) : viewMode === "grid" ? (
        /* PROFESSIONAL MASTER TIMETABLE GRID WITH TIME COLUMN AT THE STARTING */
        <div className="w-full border border-[#E4E1DA] rounded-[8px] bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto [scrollbar-width:thin] scrollbar-thin scrollbar-thumb-[#D0CCC3] hover:scrollbar-thumb-[#1F5C4D]/60 scrollbar-track-[#FAF9F6] scroll-smooth">
            <table
              className={`w-full text-left border-collapse table-fixed min-w-[850px] sm:min-w-0`}
            >
              <colgroup>
                {/* Compact Time column: 76px on mobile, 84px on tablet/desktop */}
                <col className="w-[76px] sm:w-[84px]" />
                {/* 7 Day columns: divide remaining width equally */}
                {WEEKDAY_ORDER.map((item) => (
                  <col
                    key={item.index}
                    className="w-[114px] sm:w-[calc((100%-84px)/7)]"
                  />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-[#E4E1DA] bg-[#FAF9F6]">
                  {/* TIME COLUMN HEADER AT STARTING */}
                  <th
                    className={`sticky left-0 z-20 bg-[#FAF9F6] p-1.5 sm:p-2 border-r border-[#E4E1DA] text-xs font-semibold uppercase tracking-wider text-[#5F6670] shrink-0 shadow-[3px_0_6px_rgba(0,0,0,0.06)] w-[76px] sm:w-[84px]`}
                  >
                    <div className="flex items-center justify-center sm:justify-start gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#1F5C4D] shrink-0" strokeWidth={2} />
                      <span className="text-[11px] sm:text-xs font-bold text-[#5F6670]">TIME</span>
                    </div>
                  </th>

                  {/* DAY COLUMN HEADERS: Monday to Sunday */}
                  {WEEKDAY_ORDER.map((item) => {
                    const count = slotsByDay[item.index]?.length || 0;
                    const isToday = currentWeekday === item.index;
                    return (
                      <th
                        key={item.index}
                        className={`p-1.5 sm:p-2 border-r last:border-r-0 border-[#E4E1DA] text-xs font-semibold transition-colors overflow-hidden ${
                          isToday ? "bg-[#E6F0EC]/60 text-[#1F5C4D]" : "text-[#1C1F23]"
                        } w-[114px] sm:w-[calc((100%-84px)/7)]`}
                      >
                        <div className="flex items-center justify-between gap-1 min-w-0">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1 min-w-0">
                              {/* Responsive day name: short name on tablet and mobile to prevent truncation */}
                              <span className="font-bold text-xs hidden xl:inline truncate">{item.name}</span>
                              <span className="font-bold text-xs xl:hidden">{item.shortName}</span>
                              {isToday && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#1F5C4D] shrink-0" title="Today" />
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-1 sm:px-1.5 py-0.5 rounded-full shrink-0 ${isToday
                              ? "bg-[#1F5C4D] text-white"
                              : count > 0
                                ? "bg-white text-[#1C1F23] border border-[#E4E1DA]"
                                : "text-[#8E95A0]"
                              }`}
                          >
                            {count}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E1DA]">
                {timeBands.map((band) => (
                  <tr key={band.id} className="hover:bg-[#FAF9F6]/30 transition-colors">
                    {/* TIME COLUMN CELL (STICKY LEFT - End time below start time) */}
                    <td
                      className={`sticky left-0 z-10 bg-[#FAF9F6] p-2 border-r border-[#E4E1DA] align-top shrink-0 shadow-[3px_0_6px_rgba(0,0,0,0.06)] w-[76px] sm:w-[84px]`}
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-semibold text-[11px] sm:text-xs text-[#1C1F23] tabular-nums leading-tight">
                          {formatTimeDisplay(band.startTime)}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-[#5F6670] tabular-nums leading-tight">
                          {formatTimeDisplay(band.endTime)}
                        </span>
                        {band.duration && (
                          <span className="text-[8.5px] sm:text-[9.5px] font-medium text-[#1F5C4D] bg-[#E6F0EC] px-1 py-0.2 rounded w-fit uppercase tracking-wider mt-0.5">
                            {band.duration}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* DAY CELLS */}
                    {WEEKDAY_ORDER.map((item) => {
                      const cellSlots = filteredSlots.filter(
                        (s) =>
                          Number(s.weekday) === item.index &&
                          s.startTime === band.startTime &&
                          s.endTime === band.endTime
                      );
                      const isToday = currentWeekday === item.index;

                      return (
                        <td
                          key={item.index}
                          className={`p-1 sm:p-1.5 md:p-2 border-r last:border-r-0 border-[#E4E1DA] align-top overflow-hidden ${
                            isToday ? "bg-[#E6F0EC]/10" : ""
                          } w-[114px] sm:w-[calc((100%-84px)/7)]`}
                        >
                          {cellSlots.length > 0 ? (
                            <div className="flex flex-col gap-1.5 h-full">
                              {cellSlots.map((slot) => (
                                <GridSlotCard
                                  key={slot.id}
                                  slot={slot}
                                  isLive={nowTick ? isSlotLiveNow(slot, nowTick) : false}
                                  onEdit={() => handleOpenEdit(slot)}
                                  onDelete={() => handleOpenDelete(slot)}
                                />
                              ))}

                              {cellSlots.length < 3 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenCreateForCell(item.index, band.startTime, band.endTime)
                                  }
                                  className="w-full py-1 px-1 rounded-[5px] border border-dashed border-[#E4E1DA] hover:border-[#1F5C4D] bg-[#FAF9F6] hover:bg-[#E6F0EC]/50 text-[#5F6670] hover:text-[#1F5C4D] flex items-center justify-center gap-1 text-[10px] font-medium transition-all cursor-pointer mt-0.5 truncate"
                                  title={`Add class on ${item.name} (${band.label})`}
                                >
                                  <Plus className="w-2.5 h-2.5 text-[#1F5C4D] shrink-0" strokeWidth={2} />
                                  <span className="truncate">Add</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenCreateForCell(item.index, band.startTime, band.endTime)
                              }
                              className="w-full h-full min-h-[58px] rounded border border-dashed border-transparent hover:border-[#1F5C4D]/30 hover:bg-[#FAF9F6] flex items-center justify-center text-[#B0B6C0] hover:text-[#1F5C4D] transition-all group cursor-pointer"
                              title={`Schedule class on ${item.name} at ${band.label}`}
                            >
                              <span className="text-xs group-hover:hidden select-none text-[#8E95A0]">—</span>
                              <span className="hidden group-hover:inline-flex items-center gap-1 text-[11px] font-medium text-[#1F5C4D]">
                                <Plus className="w-3 h-3 text-[#1F5C4D]" /> Add
                              </span>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile swipe helper */}
          <div className="flex sm:hidden items-center justify-between text-[11px] text-[#5F6670] px-3 py-1.5 bg-[#FAF9F6] border-t border-[#E4E1DA]">
            <span className="flex items-center gap-1.5 truncate">
              <MoveHorizontal className="w-3.5 h-3.5 text-[#1F5C4D] shrink-0" />
              <span className="truncate">Swipe to view Mon–Sun</span>
            </span>
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className="text-[#1F5C4D] font-medium shrink-0 hover:underline cursor-pointer ml-2"
            >
              Day View →
            </button>
          </div>


        </div>
      ) : (
        /* DAY VIEW (CARD LIST BY DAY) */
        <div className="flex flex-col gap-3">
          <div className="flex overflow-x-auto gap-1 pb-2 border-b border-[#E4E1DA] no-scrollbar">
            {WEEKDAY_ORDER.map((item) => {
              const count = slotsByDay[item.index]?.length || 0;
              const isSelected = activeDayTab === item.index;
              return (
                <button
                  key={item.index}
                  type="button"
                  onClick={() => setActiveDayTab(item.index)}
                  className={`min-h-[44px] flex-1 min-w-[42px] sm:min-w-[50px] py-1.5 px-0.5 sm:px-1 flex flex-col items-center justify-center rounded-[6px] border transition-colors select-none ${isSelected
                    ? "bg-[#1F5C4D] text-white border-[#1F5C4D] font-semibold"
                    : "bg-white text-[#1C1F23] border-[#E4E1DA] hover:bg-[#FAF9F6]"
                    }`}
                >
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">{item.shortName}</span>
                  <span
                    className={`text-[9.5px] sm:text-[10px] mt-0.5 px-1.5 rounded-full ${isSelected ? "bg-[#17463A] text-white" : "bg-[#FAF9F6] text-[#5F6670]"
                      }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5F6670] flex items-center gap-1.5 truncate">
                <span className="truncate">{WEEKDAY_NAMES[activeDayTab]} Schedule</span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-[#5F6670]">
                  {slotsByDay[activeDayTab]?.length || 0} classes
                </span>
                {classes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleOpenCreateForCell(activeDayTab)}
                    className="px-2 py-1 bg-[#1F5C4D] text-white rounded text-[11px] font-medium flex items-center gap-1 hover:bg-[#17463A] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                )}
              </div>
            </div>

            {slotsByDay[activeDayTab]?.length === 0 ? (
              <div className="bg-white border border-[#E4E1DA] rounded-[6px] p-6 text-center text-xs text-[#5F6670]">
                No classes scheduled on {WEEKDAY_NAMES[activeDayTab]}.
              </div>
            ) : (
              slotsByDay[activeDayTab].map((slot) => (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  isLive={nowTick ? isSlotLiveNow(slot, nowTick) : false}
                  onEdit={() => handleOpenEdit(slot)}
                  onDelete={() => handleOpenDelete(slot)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Slot BottomSheet Modal */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingSlot ? "Edit Timetable Slot" : "Add Timetable Slot"}
        description={
          editingSlot
            ? "Modifying this slot will update future scheduled sessions. Past sessions remain unchanged."
            : formSlotType === "extra"
              ? "Schedule a non-repeating extra or temporary class. Countable toward monthly required sessions and faculty payroll."
              : "Schedule a weekly repeating class slot. Server clash check enforces faculty availability and 3-room capacity."
        }
      >
        <form onSubmit={handleSubmitSlot} className="flex flex-col gap-3 py-1">
          {formError && <Toast message={formError} variant="danger" />}

          {/* Schedule Frequency / Type Segmented Control */}
          <div className="flex p-1 bg-[#FAF9F6] border border-[#E4E1DA] rounded-[8px] gap-1">
            <button
              type="button"
              onClick={() => setFormSlotType("regular")}
              disabled={formSubmitting}
              className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-[6px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${formSlotType === "regular"
                ? "bg-white text-[#1C1F23] shadow-2xs border border-[#E4E1DA]"
                : "text-[#5F6670] hover:text-[#1C1F23]"
                }`}
            >
              <RotateCw className="w-3.5 h-3.5 text-[#1F5C4D]" />
              <span>Weekly Repeating</span>
            </button>
            <button
              type="button"
              onClick={() => setFormSlotType("extra")}
              disabled={formSubmitting}
              className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-[6px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${formSlotType === "extra"
                ? "bg-[#FEF9C3] text-[#854D0E] shadow-2xs border border-[#CA8A04]/40"
                : "text-[#5F6670] hover:text-[#1C1F23]"
                }`}
            >
              <Zap className="w-3.5 h-3.5 text-[#B45309]" />
              <span>Temporary / Extra Class</span>
            </button>
          </div>

          {/* Class Picker */}
          <Field id="slot-class" label="Class" required hint="Select an active class for this slot">
            <Select
              id="slot-class"
              value={formClassId}
              onChange={(e) => setFormClassId(e.target.value)}
              disabled={Boolean(editingSlot) || formSubmitting}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.teacherName || "Unassigned"}
                </option>
              ))}
            </Select>
          </Field>

          {/* When Temporary / Extra: Single Specific Date Picker */}
          {formSlotType === "extra" ? (
            <div className="flex flex-col gap-3">
              <Field
                id="slot-specific-date"
                label="Class Date"
                required
                hint={
                  formSpecificDate
                    ? `${WEEKDAY_NAMES[formWeekday]}, ${format(parseISO(formSpecificDate), "d MMMM yyyy")}`
                    : "Select date for this non-repeating class"
                }
              >
                <Input
                  id="slot-specific-date"
                  type="date"
                  min={todayStr}
                  value={formSpecificDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  disabled={formSubmitting}
                />
              </Field>

              {/* Time Span */}
              <div className="grid grid-cols-2 gap-3">
                <Field id="slot-start-time" label="Start Time (24h)" required>
                  <Input
                    id="slot-start-time"
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    disabled={formSubmitting}
                    className="tabular-nums"
                  />
                </Field>

                <Field id="slot-end-time" label="End Time (24h)" required>
                  <Input
                    id="slot-end-time"
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    disabled={formSubmitting}
                    className="tabular-nums"
                  />
                </Field>
              </div>

              {/* Countable target month */}
              <Field
                id="slot-counts-month"
                label="Countable Month"
                required
                hint="Credits towards this month's required sessions & salary calculations"
              >
                <Input
                  id="slot-counts-month"
                  type="month"
                  value={formCountsForMonth}
                  onChange={(e) => setFormCountsForMonth(e.target.value)}
                  disabled={formSubmitting}
                  className="tabular-nums"
                />
              </Field>

              {/* Reassuring Countable Pill */}
              <div className="p-3 bg-[#E6F0EC]/70 border border-[#1F5C4D]/25 rounded-[8px] flex items-start gap-2.5 text-xs text-[#17463A]">
                <CheckCircle2 className="w-4 h-4 text-[#1F5C4D] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-[#1F5C4D]">
                    Countable Non-Repeating Class
                  </span>
                  <span className="text-[#3F544D] leading-relaxed block mt-0.5">
                    This class will only occur on{" "}
                    <strong>
                      {formSpecificDate
                        ? format(parseISO(formSpecificDate), "EEEE, d MMMM yyyy")
                        : "the selected date"}
                    </strong>{" "}
                    and will NOT repeat weekly. It automatically counts towards the required monthly session count for{" "}
                    <strong>{formCountsForMonth || "the month"}</strong>.
                  </span>
                </div>
              </div>

              {/* Optional Note */}
              <Field
                id="slot-note"
                label="Purpose / Note (Optional)"
                hint="e.g. Exam Revision, Makeup Session, Guest Lecture"
              >
                <Input
                  id="slot-note"
                  type="text"
                  placeholder="e.g. Special Exam Revision Seminar"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  disabled={formSubmitting}
                />
              </Field>
            </div>
          ) : (
            /* When Regular Weekly Repeating */
            <div className="flex flex-col gap-3">
              {/* Day of Week */}
              <Field id="slot-weekday" label="Weekday" required>
                <Select
                  id="slot-weekday"
                  value={formWeekday}
                  onChange={(e) => setFormWeekday(Number(e.target.value))}
                  disabled={formSubmitting}
                >
                  {WEEKDAY_ORDER.map((w) => (
                    <option key={w.index} value={w.index}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {/* Time Span */}
              <div className="grid grid-cols-2 gap-3">
                <Field id="slot-start-time" label="Start Time (24h)" required>
                  <Input
                    id="slot-start-time"
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    disabled={formSubmitting}
                    className="tabular-nums"
                  />
                </Field>

                <Field id="slot-end-time" label="End Time (24h)" required>
                  <Input
                    id="slot-end-time"
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    disabled={formSubmitting}
                    className="tabular-nums"
                  />
                </Field>
              </div>

              {/* Validity Range */}
              <div className="grid grid-cols-2 gap-3">
                <Field id="slot-valid-from" label="Valid From" hint="Session start date">
                  <Input
                    id="slot-valid-from"
                    type="date"
                    min={editingSlot ? undefined : todayStr}
                    value={formValidFrom}
                    onChange={(e) => setFormValidFrom(e.target.value)}
                    disabled={formSubmitting}
                  />
                </Field>

                <Field id="slot-valid-to" label="Valid To" hint="Session end date">
                  <Input
                    id="slot-valid-to"
                    type="date"
                    min={todayStr}
                    value={formValidTo}
                    onChange={(e) => setFormValidTo(e.target.value)}
                    disabled={formSubmitting}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* Live Clash Indicator Banner */}
          <div className="pt-1">
            {clashStatus.checking ? (
              <div className="flex items-center gap-2 p-2.5 rounded-[6px] bg-[#FAF9F6] border border-[#E4E1DA] text-xs text-[#5F6670]">
                <Clock className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                <span>Checking room capacity and teacher availability...</span>
              </div>
            ) : clashStatus.hasClash ? (
              <div className="flex items-start gap-2 p-3 rounded-[6px] bg-[#FBE9E7] border border-[#A32A2A]/30 text-xs text-[#A32A2A]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
                <div>
                  <strong className="block font-semibold">Scheduling Conflict Detected</strong>
                  <span className="mt-0.5 block leading-relaxed">{clashStatus.message}</span>
                </div>
              </div>
            ) : clashStatus.hasGradeWarning ? (
              <div className="flex items-start gap-2 p-2.5 rounded-[6px] bg-[#FFF8E1] border border-[#B78103]/30 text-xs text-[#8C6B00]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#B78103]" strokeWidth={2} />
                <div>
                  <strong className="block font-semibold text-[#664D00]">Concurrent Notice</strong>
                  <span className="mt-0.5 block leading-relaxed">{clashStatus.warningMessage}</span>
                </div>
              </div>
            ) : formClassId && formStartTime && formEndTime ? (
              <div className="flex items-center gap-2 p-2.5 rounded-[6px] bg-[#E6F0EC] border border-[#1F5C4D]/30 text-xs text-[#1F5C4D]">
                <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={2} />
                <span>No clashes: Rooms available and teacher is free.</span>
              </div>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-[#E4E1DA] mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSheetOpen(false)}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={formSubmitting}
              disabled={formSubmitting || clashStatus.hasClash || clashStatus.checking}
            >
              {editingSlot ? "Update Slot" : formSlotType === "extra" ? "Schedule Extra Class" : "Create Slot"}
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Concurrent Grade Schedule Confirmation Dialog */}
      <ConfirmDialog
        open={gradeConfirmOpen}
        title="Concurrent Grade Schedule"
        description={`${clashStatus.warningMessage || "This slot overlaps with another class in the same grade."}\n\nStudents cannot attend both classes simultaneously. Proceed with saving?`}
        confirmLabel="Confirm & Save Slot"
        variant="primary"
        loading={formSubmitting}
        onConfirm={async () => {
          setGradeConfirmOpen(false);
          if (pendingSlotSubmit) {
            await pendingSlotSubmit();
          }
        }}
        onClose={() => {
          setGradeConfirmOpen(false);
          setPendingSlotSubmit(null);
        }}
      />

      {/* Delete Slot Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Timetable Slot"
        description={
          slotToDelete
            ? `Are you sure you want to delete ${slotToDelete.className} on ${WEEKDAY_NAMES[slotToDelete.weekday]
            } (${formatTimeDisplay(slotToDelete.startTime)} - ${formatTimeDisplay(
              slotToDelete.endTime
            )})? This will cancel all future scheduled sessions. Past session attendance records will be preserved.`
            : "Are you sure you want to delete this timetable slot?"
        }
        confirmLabel="Delete Slot"
        cancelLabel="Keep Slot"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleDeleteSlot}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setSlotToDelete(null);
        }}
      />
    </OwnerShell>
  );
}

// Reusable Slot Card Component for both Phone and Desktop Grid
function SlotCard({
  slot,
  compact = false,
  isLive = false,
  onEdit,
  onDelete,
}: {
  slot: TimetableSlot;
  compact?: boolean;
  isLive?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = getClassColor(slot);
  const todayStr = format(getColomboNow(), "yyyy-MM-dd");
  const activity = getSlotActivityInfo(slot, todayStr);

  return (
    <Card
      className={`transition-colors flex flex-col justify-between shadow-2xs ${compact ? "p-2.5 gap-2" : "p-3.5 gap-2.5"
        } ${isLive ? "ring-2 ring-[#16A34A]/60 shadow-sm" : ""}`}
      style={{
        borderLeft: `4px solid ${theme.accent}`,
        backgroundColor: theme.bg,
        borderColor: theme.border,
      }}
    >
      <div className="flex flex-col gap-1.5 min-w-0">
        {/* Time Banner + Class Badge */}
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[#1F5C4D] bg-[#E6F0EC] px-2 py-0.5 rounded tabular-nums whitespace-nowrap overflow-hidden">
            <Clock className="w-3 h-3 shrink-0" strokeWidth={2} />
            <span className="truncate">{formatTimeRange(slot.startTime, slot.endTime)}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {isLive && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded border border-[#16A34A]/40 whitespace-nowrap"
                title="Class is currently in progress"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#16A34A]" />
                </span>
                <span>Live</span>
              </span>
            )}
            {activity.badgeType === "extra" && (
              <span
                className="text-[10px] font-semibold text-[#854D0E] bg-[#FEF9C3] px-2 py-0.5 rounded border border-[#CA8A04]/40 whitespace-nowrap flex items-center gap-1"
                title={activity.badgeTitle}
              >
                <Zap className="w-2.5 h-2.5 text-[#B45309]" />
                <span>{activity.badgeLabel === "Today" ? "Extra • Today" : `Extra • ${activity.badgeLabel}`}</span>
              </span>
            )}
            {activity.badgeType === "future" && (
              <span
                className="text-[10px] font-semibold text-[#0369A1] bg-[#E0F2FE] px-2 py-0.5 rounded border border-[#0284C7]/30 whitespace-nowrap flex items-center gap-1"
                title={activity.badgeTitle}
              >
                <Calendar className="w-2.5 h-2.5 text-[#0284C7]" />
                <span>{activity.badgeLabel}</span>
              </span>
            )}
            {activity.badgeType === "ending" && (
              <span
                className="text-[10px] font-semibold text-[#C2410C] bg-[#FFF7ED] px-2 py-0.5 rounded border border-[#EA580C]/30 whitespace-nowrap flex items-center gap-1"
                title={activity.badgeTitle}
              >
                <Clock className="w-2.5 h-2.5 text-[#EA580C]" />
                <span>{activity.badgeLabel}</span>
              </span>
            )}
            <ClassBadge
              subject={slot.subject}
              name={slot.className}
              color={slot.color}
              size="xs"
            />
          </div>
        </div>

        {/* Class Name */}
        <h4
          className="font-semibold text-xs leading-snug line-clamp-2"
          style={{ color: theme.text }}
          title={slot.className}
        >
          {slot.className || "Class Slot"}
        </h4>

        {/* Teacher Name & Note */}
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1 text-[11px] text-[#5F6670] min-w-0">
            <User className="w-3 h-3 shrink-0 text-[#5F6670]" strokeWidth={1.75} />
            <span className="truncate" title={slot.teacherName || "Unassigned"}>
              {slot.teacherName || "Unassigned"}
            </span>
          </div>
          {slot.note && (
            <span className="text-[10px] text-[#5F6670] italic truncate" title={slot.note}>
              Note: {slot.note}
            </span>
          )}
        </div>
      </div>

      {/* Action Footer - Clean & minimal */}
      <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-[#E4E1DA]/70">
        <button
          type="button"
          onClick={onEdit}
          title={`Edit ${slot.className} Slot`}
          aria-label={`Edit ${slot.className} Slot`}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#5F6670] hover:text-[#1F5C4D] hover:bg-white border border-[#E4E1DA] hover:border-[#1F5C4D]/30 transition-colors cursor-pointer"
        >
          <Edit2 className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title={`Delete ${slot.className} Slot`}
          aria-label={`Delete ${slot.className} Slot`}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7] border border-[#E4E1DA] hover:border-[#A32A2A]/30 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </Card>
  );
}

// Compact card component for the weekly master grid matrix
function GridSlotCard({
  slot,
  isLive = false,
  onEdit,
  onDelete,
}: {
  slot: TimetableSlot;
  isLive?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = getClassColor(slot);
  const todayStr = format(getColomboNow(), "yyyy-MM-dd");
  const activity = getSlotActivityInfo(slot, todayStr);

  return (
    <div
      className={`rounded-[6px] p-1.5 sm:p-2 transition-all flex flex-col justify-between gap-1.5 group border shadow-2xs max-w-full overflow-hidden ${
        isLive ? "ring-2 ring-[#16A34A]/60 shadow-sm" : ""
      }`}
      style={{
        borderLeft: `3px solid ${theme.accent}`,
        backgroundColor: theme.bg,
        borderColor: theme.border,
      }}
    >
      <div className="flex flex-col gap-1 min-w-0 max-w-full">
        <div className="flex flex-wrap items-center justify-between gap-1 max-w-full">
          <div className="min-w-0 max-w-full">
            <ClassBadge
              subject={slot.subject}
              name={slot.className}
              color={slot.color}
              size="xs"
              className="max-w-full"
            />
          </div>
          {isLive && (
            <span
              className="inline-flex items-center gap-1 text-[9px] sm:text-[9.5px] font-bold uppercase tracking-wider text-[#15803D] bg-[#DCFCE7] px-1.5 py-0.2 rounded border border-[#16A34A]/40 shrink-0"
              title="Class is currently in progress"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#16A34A]" />
              </span>
              <span>Live</span>
            </span>
          )}
          {activity.badgeType === "extra" && (
            <span
              className="text-[9px] sm:text-[9.5px] font-semibold text-[#854D0E] bg-[#FEF9C3] px-1.5 py-0.2 rounded border border-[#CA8A04]/40 shrink-0 flex items-center gap-0.5 max-w-full truncate"
              title={activity.badgeTitle}
            >
              <Zap className="w-2.5 h-2.5 text-[#B45309] shrink-0" />
              <span className="truncate">{activity.badgeLabel}</span>
            </span>
          )}
          {activity.badgeType === "future" && (
            <span
              className="text-[9px] sm:text-[9.5px] font-semibold text-[#0369A1] bg-[#E0F2FE] px-1.5 py-0.2 rounded border border-[#0284C7]/30 shrink-0 flex items-center gap-0.5 max-w-full truncate"
              title={activity.badgeTitle}
            >
              <Calendar className="w-2.5 h-2.5 text-[#0284C7] shrink-0" />
              <span className="truncate">{activity.badgeLabel}</span>
            </span>
          )}
          {activity.badgeType === "ending" && (
            <span
              className="text-[9px] sm:text-[9.5px] font-semibold text-[#C2410C] bg-[#FFF7ED] px-1.5 py-0.2 rounded border border-[#EA580C]/30 shrink-0 flex items-center gap-0.5 max-w-full truncate"
              title={activity.badgeTitle}
            >
              <Clock className="w-2.5 h-2.5 text-[#EA580C] shrink-0" />
              <span className="truncate">{activity.badgeLabel}</span>
            </span>
          )}
        </div>

        <h5
          className="font-semibold text-[11px] sm:text-xs leading-snug line-clamp-2 break-words"
          style={{ color: theme.text }}
          title={slot.className}
        >
          {slot.className || "Class"}
        </h5>

        {slot.teacherName && (
          <div
            className="flex items-center gap-1 text-[10px] sm:text-[11px] text-[#5F6670] truncate min-w-0"
            title={slot.teacherName}
          >
            <User className="w-3 h-3 shrink-0 text-[#5F6670]" strokeWidth={1.75} />
            <span className="truncate">{slot.teacherName}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-1 pt-1 border-t border-[#E4E1DA]/60">
        <button
          type="button"
          onClick={onEdit}
          title="Edit Slot"
          className="p-1 text-[#5F6670] hover:text-[#1F5C4D] hover:bg-white rounded transition-colors"
        >
          <Edit2 className="w-3 h-3" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete Slot"
          className="p-1 text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7] rounded transition-colors"
        >
          <Trash2 className="w-3 h-3" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
