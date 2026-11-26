"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import { format } from "date-fns";
import type { TimetableSlot } from "@/types";

interface ClassOption {
  id: string;
  name: string;
  grade: string;
  subject: string;
  teacherId: string;
  teacherName: string;
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
  const [viewMode, setViewMode] = useState<"grid" | "day">("grid");

  // BottomSheet modal state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);

  // Modal form fields
  const [formClassId, setFormClassId] = useState("");
  const [formWeekday, setFormWeekday] = useState<number>(1);
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("11:00");
  const [formValidFrom, setFormValidFrom] = useState("2026-01-01");
  const [formValidTo, setFormValidTo] = useState("2026-12-31");
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

  // Filter slots
  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (selectedTeacherFilter !== "all" && slot.teacherId !== selectedTeacherFilter) {
        return false;
      }
      if (selectedGradeFilter !== "all" && slot.grade !== selectedGradeFilter) {
        return false;
      }
      return true;
    });
  }, [slots, selectedTeacherFilter, selectedGradeFilter]);

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

  // Open modal with pre-selected day and time slot
  function handleOpenCreateForCell(weekday: number, startTime?: string, endTime?: string) {
    const yr = activeYear || "2027";
    setEditingSlot(null);
    setFormClassId(classes[0]?.id || "");
    setFormWeekday(weekday);
    setFormStartTime(startTime || "09:00");
    setFormEndTime(endTime || "11:00");
    setFormValidFrom(`${yr}-01-01`);
    setFormValidTo(`${yr}-12-31`);
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
    editingSlot,
    classes,
  ]);

  // Open modal for new slot
  function handleOpenCreate() {
    const yr = activeYear || "2027";
    setEditingSlot(null);
    setFormClassId(classes[0]?.id || "");
    setFormWeekday(activeDayTab);
    setFormStartTime("09:00");
    setFormEndTime("11:00");
    setFormValidFrom(`${yr}-01-01`);
    setFormValidTo(`${yr}-12-31`);
    setFormError("");
    setClashStatus({ checking: false, hasClash: false });
    setSheetOpen(true);
  }

  // Open modal for editing slot
  function handleOpenEdit(slot: TimetableSlot) {
    const yr = activeYear || "2027";
    setEditingSlot(slot);
    setFormClassId(slot.classId);
    setFormWeekday(slot.weekday);
    setFormStartTime(slot.startTime);
    setFormEndTime(slot.endTime);
    setFormValidFrom(slot.validFrom || `${yr}-01-01`);
    setFormValidTo(slot.validTo || `${yr}-12-31`);
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
          validFrom: formValidFrom,
          validTo: formValidTo,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save timetable slot.");
      }

      setToastMessage({
        text: isEdit
          ? "Timetable slot and future scheduled sessions updated."
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
    <OwnerShell pageTitle="Weekly Timetable" maxWidth="wide">
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

      {/* Header with Add Slot CTA */}
      <PageHeader
        title={activeYear ? `Weekly Timetable (${activeYear})` : "Weekly Timetable"}
        subtitle="Manage recurring weekly class slots, teacher allocation & room capacity"
        action={
          <Button
            variant="primary"
            onClick={handleOpenCreate}
            className="gap-1.5 shadow-none"
            disabled={classes.length === 0}
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            <span>Add Slot</span>
          </Button>
        }
      />

      {/* Filter Toolbar */}
      <Card className="p-3 mb-4 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[#5F6670] font-medium mr-1">
            <Filter className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Filter:</span>
          </div>

          {/* Teacher Filter */}
          <div className="w-40 sm:w-44">
            <Select
              id="filter-teacher"
              value={selectedTeacherFilter}
              onChange={(e) => setSelectedTeacherFilter(e.target.value)}
              className="text-xs h-8"
            >
              <option value="all">All Teachers ({availableTeachers.length})</option>
              {availableTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Grade Filter */}
          <div className="w-32 sm:w-36">
            <Select
              id="filter-grade"
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="text-xs h-8"
            >
              <option value="all">All Grades ({availableGrades.length})</option>
              {availableGrades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </div>

          {(selectedTeacherFilter !== "all" || selectedGradeFilter !== "all") && (
            <Button
              variant="quiet"
              onClick={() => {
                setSelectedTeacherFilter("all");
                setSelectedGradeFilter("all");
              }}
              className="text-xs h-8 px-2 text-[#5F6670] hover:text-[#1C1F23]"
            >
              Reset
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center border border-[#E4E1DA] rounded-[6px] p-0.5 bg-[#FAF9F6]">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                viewMode === "grid"
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
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                viewMode === "day"
                  ? "bg-white text-[#1C1F23] shadow-2xs font-semibold"
                  : "text-[#5F6670] hover:text-[#1C1F23]"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Day View</span>
            </button>
          </div>

          <div className="text-[11px] text-[#5F6670] hidden sm:flex items-center gap-2">
            <StatusChip status="neutral" label={`3 Rooms Max`} />
            <span>{filteredSlots.length} active slots</span>
          </div>
        </div>
      </Card>

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
        <div className="bg-white border border-[#E4E1DA] rounded-[8px] p-8 text-center text-xs text-[#5F6670] flex flex-col items-center gap-2">
          <p>No classes match the selected filter criteria.</p>
          <Button
            variant="quiet"
            onClick={() => {
              setSelectedTeacherFilter("all");
              setSelectedGradeFilter("all");
            }}
            className="text-xs"
          >
            Reset Filters
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        /* PROFESSIONAL MASTER TIMETABLE GRID WITH TIME COLUMN AT THE STARTING */
        <div className="w-full border border-[#E4E1DA] rounded-[8px] bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead>
                <tr className="border-b border-[#E4E1DA] bg-[#FAF9F6]">
                  {/* TIME COLUMN HEADER AT STARTING */}
                  <th className="sticky left-0 z-20 bg-[#FAF9F6] p-3 border-r border-[#E4E1DA] w-40 min-w-[150px] max-w-[170px] text-xs font-semibold uppercase tracking-wider text-[#5F6670]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#1F5C4D]" strokeWidth={2} />
                      <span>Time</span>
                    </div>
                  </th>

                  {/* DAY COLUMN HEADERS: Monday to Sunday */}
                  {WEEKDAY_ORDER.map((item) => {
                    const count = slotsByDay[item.index]?.length || 0;
                    const isToday = currentWeekday === item.index;
                    return (
                      <th
                        key={item.index}
                        className={`p-3 border-r last:border-r-0 border-[#E4E1DA] text-xs font-semibold transition-colors ${
                          isToday ? "bg-[#E6F0EC]/60 text-[#1F5C4D]" : "text-[#1C1F23]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs">{item.name}</span>
                            {isToday && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#1F5C4D]" title="Today" />
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              isToday
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
                    {/* TIME COLUMN CELL (STICKY LEFT) */}
                    <td className="sticky left-0 z-10 bg-[#FAF9F6] p-3 border-r border-[#E4E1DA] align-top w-40 min-w-[150px] max-w-[170px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-xs text-[#1C1F23] tabular-nums whitespace-nowrap">
                          {band.label}
                        </span>
                        {band.duration && (
                          <span className="text-[10px] font-medium text-[#5F6670] uppercase tracking-wider">
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
                          className={`p-2 border-r last:border-r-0 border-[#E4E1DA] align-top min-w-[125px] ${
                            isToday ? "bg-[#E6F0EC]/10" : ""
                          }`}
                        >
                          {cellSlots.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {cellSlots.map((slot) => (
                                <GridSlotCard
                                  key={slot.id}
                                  slot={slot}
                                  onEdit={() => handleOpenEdit(slot)}
                                  onDelete={() => handleOpenDelete(slot)}
                                />
                              ))}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenCreateForCell(item.index, band.startTime, band.endTime)
                              }
                              className="w-full h-full min-h-[64px] rounded border border-dashed border-transparent hover:border-[#1F5C4D]/30 hover:bg-white flex items-center justify-center text-[#B0B6C0] hover:text-[#1F5C4D] transition-all group"
                              title={`Add slot on ${item.name} at ${band.label}`}
                            >
                              <span className="text-xs group-hover:hidden select-none">—</span>
                              <span className="hidden group-hover:inline-flex items-center gap-1 text-[11px] font-medium">
                                <Plus className="w-3 h-3" /> Add
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
                  className={`min-h-[44px] flex-1 min-w-[48px] py-2 px-1 flex flex-col items-center justify-center rounded-[6px] border transition-colors select-none ${
                    isSelected
                      ? "bg-[#1F5C4D] text-white border-[#1F5C4D] font-semibold"
                      : "bg-white text-[#1C1F23] border-[#E4E1DA] hover:bg-[#FAF9F6]"
                  }`}
                >
                  <span className="text-xs uppercase tracking-wider">{item.shortName}</span>
                  <span
                    className={`text-[10px] mt-0.5 px-1.5 rounded-full ${
                      isSelected ? "bg-[#17463A] text-white" : "bg-[#FAF9F6] text-[#5F6670]"
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
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5F6670]">
                {WEEKDAY_NAMES[activeDayTab]} Schedule
              </span>
              <span className="text-[11px] text-[#5F6670]">
                {slotsByDay[activeDayTab]?.length || 0} classes
              </span>
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
            : "Schedule a weekly repeating class slot. Server clash check enforces faculty availability and 3-room capacity."
        }
      >
        <form onSubmit={handleSubmitSlot} className="flex flex-col gap-3 py-1">
          {formError && <Toast message={formError} variant="danger" />}

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
                value={formValidFrom}
                onChange={(e) => setFormValidFrom(e.target.value)}
                disabled={formSubmitting}
              />
            </Field>

            <Field id="slot-valid-to" label="Valid To" hint="Session end date">
              <Input
                id="slot-valid-to"
                type="date"
                value={formValidTo}
                onChange={(e) => setFormValidTo(e.target.value)}
                disabled={formSubmitting}
              />
            </Field>
          </div>

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
              <div className="flex items-start gap-2 p-3 rounded-[6px] bg-[#FFF8E1] border border-[#B78103]/30 text-xs text-[#8C6B00]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#B78103]" strokeWidth={2} />
                <div>
                  <strong className="block font-semibold text-[#664D00]">Concurrent Grade Schedule Notice</strong>
                  <span className="mt-0.5 block leading-relaxed">{clashStatus.warningMessage}</span>
                  <span className="mt-1 block text-[11px] text-[#8C6B00]/90">
                    Students in this grade cannot attend both classes simultaneously. Saving will require confirmation and send an alert notification to the owner.
                  </span>
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
              {editingSlot ? "Update Slot" : "Create Slot"}
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Concurrent Grade Schedule Confirmation Dialog */}
      <ConfirmDialog
        open={gradeConfirmOpen}
        title="Confirm Concurrent Grade Schedule"
        description={`${clashStatus.warningMessage || "This slot is scheduled at the same time as another class in the same grade."}\n\nStudents in this grade cannot attend both classes simultaneously. A push notification and alert will be dispatched to the college owner upon saving. Do you want to proceed?`}
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
            ? `Are you sure you want to delete ${slotToDelete.className} on ${
                WEEKDAY_NAMES[slotToDelete.weekday]
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
  onEdit,
  onDelete,
}: {
  slot: TimetableSlot;
  compact?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      className={`bg-white border border-[#E4E1DA] hover:border-[#1F5C4D] transition-colors flex flex-col justify-between shadow-2xs ${
        compact ? "p-2.5 gap-2" : "p-3.5 gap-2.5"
      }`}
    >
      <div className="flex flex-col gap-1.5 min-w-0">
        {/* Time Banner - Crisp, compact, no cutoffs */}
        <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[#1F5C4D] bg-[#E6F0EC] px-2 py-0.5 rounded tabular-nums whitespace-nowrap overflow-hidden">
          <Clock className="w-3 h-3 shrink-0" strokeWidth={2} />
          <span className="truncate">{formatTimeRange(slot.startTime, slot.endTime)}</span>
        </div>

        {/* Class Name */}
        <h4
          className="font-semibold text-xs text-[#1C1F23] leading-snug line-clamp-2"
          title={slot.className}
        >
          {slot.className || "Class Slot"}
        </h4>

        {/* Teacher Name */}
        <div className="flex items-center gap-1 text-[11px] text-[#5F6670] min-w-0">
          <User className="w-3 h-3 shrink-0 text-[#5F6670]" strokeWidth={1.75} />
          <span className="truncate" title={slot.teacherName || "Unassigned"}>
            {slot.teacherName || "Unassigned"}
          </span>
        </div>
      </div>

      {/* Action Footer - Clean & minimal, no redundant date ranges */}
      <div className="flex items-center justify-end gap-1 pt-1.5 border-t border-[#E4E1DA]/70">
        <button
          type="button"
          onClick={onEdit}
          title="Edit Slot"
          className="p-1 text-[#5F6670] hover:text-[#1F5C4D] hover:bg-[#FAF9F6] rounded transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete Slot"
          className="p-1 text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7] rounded transition-colors"
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
  onEdit,
  onDelete,
}: {
  slot: TimetableSlot;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white border border-[#E4E1DA] hover:border-[#1F5C4D] hover:shadow-xs rounded-[6px] p-2 transition-all flex flex-col justify-between gap-1.5 group">
      <div className="flex flex-col gap-1 min-w-0">
        <h5
          className="font-semibold text-xs text-[#1C1F23] leading-snug line-clamp-2"
          title={slot.className}
        >
          {slot.className || "Class"}
        </h5>

        {slot.teacherName && (
          <div
            className="flex items-center gap-1 text-[11px] text-[#5F6670] truncate"
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
          className="p-1 text-[#5F6670] hover:text-[#1F5C4D] hover:bg-[#FAF9F6] rounded transition-colors"
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
