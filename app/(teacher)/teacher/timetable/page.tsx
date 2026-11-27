"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { TeacherShell } from "@/components/layout/TeacherShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getClassColor } from "@/lib/class-colors";
import { ClassBadge } from "@/components/ui/ClassBadge";
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  LayoutGrid,
  List,
  Zap,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  WEEKDAY_NAMES,
  SHORT_WEEKDAY_NAMES,
  WEEKDAY_ORDER,
  formatTimeDisplay,
  formatTimeRange,
  calculateDuration,
  getColomboNow,
} from "@/lib/dates";
import type { TimetableSlot } from "@/types";

interface TeacherClassOption {
  id: string;
  name: string;
  grade: string;
  subject: string;
}

export default function TeacherTimetablePage() {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [classes, setClasses] = useState<TeacherClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    variant: "success" | "danger" | "warning";
  } | null>(null);

  const currentWeekday = getColomboNow().getDay();
  const [activeDayTab, setActiveDayTab] = useState<number>(currentWeekday);
  const [viewMode, setViewMode] = useState<"grid" | "day">("grid");

  // Modal State
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [formClassId, setFormClassId] = useState("");
  const [formWeekday, setFormWeekday] = useState<number>(1);
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("11:00");
  const [formValidFrom, setFormValidFrom] = useState("2026-01-01");
  const [formValidTo, setFormValidTo] = useState("2026-12-31");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Live Clash State
  const [clashStatus, setClashStatus] = useState<{
    checking: boolean;
    hasClash: boolean;
    message?: string;
  }>({ checking: false, hasClash: false });

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<TimetableSlot | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load timetable
  const loadTimetable = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/teacher/timetable/slots");
      if (!res.ok) throw new Error("Failed to load timetable.");
      const data = await res.json();
      setSlots(data.slots || []);
      setClasses(data.classes || []);
    } catch (err: any) {
      setToastMessage({ text: err.message, variant: "danger" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTimetable();
  }, [loadTimetable]);

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
    slots.forEach((s) => {
      if (map[s.weekday]) map[s.weekday].push(s);
    });
    return map;
  }, [slots]);

  // Unique chronological time bands across all teacher slots
  const timeBands = useMemo(() => {
    const map = new Map<string, { startTime: string; endTime: string }>();
    slots.forEach((slot) => {
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
  }, [slots]);

  // Open modal with pre-selected day and time slot
  function handleOpenCreateForCell(weekday: number, startTime?: string, endTime?: string) {
    setEditingSlot(null);
    setFormClassId(classes[0]?.id || "");
    setFormWeekday(weekday);
    setFormStartTime(startTime || "09:00");
    setFormEndTime(endTime || "11:00");
    setFormValidFrom("2026-01-01");
    setFormValidTo("2026-12-31");
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
            slotId: editingSlot?.id,
            classId: formClassId,
            className: selectedClass.name,
            grade: selectedClass.grade,
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
        });
      } catch {
        setClashStatus({ checking: false, hasClash: false });
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [sheetOpen, formClassId, formWeekday, formStartTime, formEndTime, editingSlot, classes]);

  function handleOpenCreate() {
    setEditingSlot(null);
    setFormClassId(classes[0]?.id || "");
    setFormWeekday(activeDayTab);
    setFormStartTime("09:00");
    setFormEndTime("11:00");
    setFormValidFrom("2026-01-01");
    setFormValidTo("2026-12-31");
    setFormError("");
    setClashStatus({ checking: false, hasClash: false });
    setSheetOpen(true);
  }

  function handleOpenEdit(slot: TimetableSlot) {
    setEditingSlot(slot);
    setFormClassId(slot.classId);
    setFormWeekday(slot.weekday);
    setFormStartTime(slot.startTime);
    setFormEndTime(slot.endTime);
    setFormValidFrom(slot.validFrom || "2026-01-01");
    setFormValidTo(slot.validTo || "2026-12-31");
    setFormError("");
    setClashStatus({ checking: false, hasClash: false });
    setSheetOpen(true);
  }

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
      setFormError(clashStatus.message || "Scheduling clash detected.");
      return;
    }

    try {
      setFormSubmitting(true);
      const isEdit = Boolean(editingSlot);
      const url = isEdit
        ? `/api/teacher/timetable/slots/${editingSlot!.id}`
        : "/api/teacher/timetable/slots";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: formClassId,
          weekday: Number(formWeekday),
          startTime: formStartTime,
          endTime: formEndTime,
          validFrom: formValidFrom,
          validTo: formValidTo,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save slot.");

      setToastMessage({
        text: isEdit ? "Slot and future sessions updated." : "Slot added to your timetable.",
        variant: "success",
      });
      setSheetOpen(false);
      await loadTimetable();
    } catch (err: any) {
      setFormError(err.message || "Failed to save slot.");
    } finally {
      setFormSubmitting(false);
    }
  }

  function handleOpenDelete(slot: TimetableSlot) {
    setSlotToDelete(slot);
    setDeleteConfirmOpen(true);
  }

  async function handleDeleteSlot() {
    if (!slotToDelete) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/teacher/timetable/slots/${slotToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete slot.");

      setToastMessage({
        text: "Slot and future scheduled sessions deleted.",
        variant: "success",
      });
      setDeleteConfirmOpen(false);
      setSlotToDelete(null);
      await loadTimetable();
    } catch (err: any) {
      setToastMessage({ text: err.message, variant: "danger" });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <TeacherShell pageTitle="Weekly Timetable" maxWidth="full">
      {toastMessage && (
        <div className="mb-4">
          <Toast
            message={toastMessage.text}
            variant={toastMessage.variant}
            onDismiss={() => setToastMessage(null)}
          />
        </div>
      )}

      <PageHeader
        title="Weekly Timetable"
        subtitle="Manage recurring weekly class slots for your assigned classes"
        action={
          <Button
            variant="primary"
            onClick={handleOpenCreate}
            className="gap-1.5 shadow-none text-xs h-9"
            disabled={classes.length === 0}
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            <span>Add Slot</span>
          </Button>
        }
      />

      {slots.length > 0 && !loading && (
        <div className="flex items-center justify-between mb-3">
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

          <span className="text-[11px] text-[#5F6670]">
            {slots.length} assigned slots
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : slots.length === 0 ? (
        <EmptyState
          icon={<Clock className="w-8 h-8 text-[#5F6670]" strokeWidth={1.5} />}
          title="No timetable slots created yet"
          description="Schedule your classes across the week. Server clash checking guarantees no overlapping sessions and respects room capacity."
          action={
            classes.length > 0 ? (
              <Button variant="primary" onClick={handleOpenCreate}>
                <Plus className="w-4 h-4 mr-1.5" strokeWidth={2} />
                Create First Slot
              </Button>
            ) : undefined
          }
        />
      ) : viewMode === "grid" ? (
        /* PROFESSIONAL MASTER TIMETABLE GRID WITH TIME COLUMN AT STARTING */
        <div className="w-full border border-[#E4E1DA] rounded-[8px] bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto lg:overflow-x-visible no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[840px] lg:min-w-0 lg:table-fixed">
              <thead>
                <tr className="border-b border-[#E4E1DA] bg-[#FAF9F6]">
                  {/* TIME COLUMN HEADER AT STARTING */}
                  <th className="sticky left-0 z-20 bg-[#FAF9F6] p-2.5 sm:p-3 border-r border-[#E4E1DA] w-44 sm:w-48 text-xs font-semibold uppercase tracking-wider text-[#5F6670] shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#1F5C4D]" strokeWidth={2} />
                      <span>Time</span>
                    </div>
                  </th>

                  {/* DAY COLUMN HEADERS */}
                  {WEEKDAY_ORDER.map((item) => {
                    const count = slotsByDay[item.index]?.length || 0;
                    const isToday = currentWeekday === item.index;
                    return (
                      <th
                        key={item.index}
                        className={`p-2 sm:p-2.5 border-r last:border-r-0 border-[#E4E1DA] text-xs font-semibold transition-colors min-w-[95px] lg:min-w-0 ${
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
                    <td className="sticky left-0 z-10 bg-[#FAF9F6] p-2.5 sm:p-3 border-r border-[#E4E1DA] align-top w-44 sm:w-48 shrink-0">
                      <div className="flex flex-col gap-1 min-w-0">
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
                      const cellSlots = slots.filter(
                        (s) =>
                          Number(s.weekday) === item.index &&
                          s.startTime === band.startTime &&
                          s.endTime === band.endTime
                      );
                      const isToday = currentWeekday === item.index;

                      return (
                        <td
                          key={item.index}
                          className={`p-1.5 sm:p-2 border-r last:border-r-0 border-[#E4E1DA] align-top min-w-[95px] lg:min-w-0 ${
                            isToday ? "bg-[#E6F0EC]/10" : ""
                          }`}
                        >
                          {cellSlots.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {cellSlots.map((slot) => {
                                const theme = getClassColor(slot);
                                return (
                                  <div
                                    key={slot.id}
                                    className="rounded-[6px] p-2 transition-all flex flex-col justify-between gap-1.5 group border shadow-2xs"
                                    style={{
                                      borderLeft: `3px solid ${theme.accent}`,
                                      backgroundColor: theme.bg,
                                      borderColor: theme.border,
                                    }}
                                  >
                                    <div className="flex flex-col gap-1 min-w-0">
                                      <div className="flex items-center justify-between gap-1">
                                        <ClassBadge
                                          subject={slot.subject}
                                          name={slot.className}
                                          color={slot.color}
                                          size="xs"
                                        />
                                        {(slot.isTemporary || slot.slotType === "extra" || (slot.validFrom && slot.validFrom === slot.validTo)) && (
                                          <span
                                            className="text-[9.5px] font-semibold text-[#854D0E] bg-[#FEF9C3] px-1.5 py-0.2 rounded border border-[#CA8A04]/40 whitespace-nowrap flex items-center gap-0.5"
                                            title={`Temporary / Extra Class: ${slot.specificDate || "Single Session"}${slot.note ? ` • ${slot.note}` : ""}${slot.countsForMonth ? ` (Counts for ${slot.countsForMonth})` : ""}`}
                                          >
                                            <Zap className="w-2.5 h-2.5 text-[#B45309]" />
                                            <span>{slot.specificDate ? format(parseISO(slot.specificDate), "d MMM") : "Extra"}</span>
                                          </span>
                                        )}
                                      </div>
                                      <h5
                                        className="font-semibold text-xs leading-snug line-clamp-2"
                                        style={{ color: theme.text }}
                                        title={slot.className}
                                      >
                                        {slot.className || "Class"}
                                      </h5>
                                    </div>

                                    <div className="flex items-center justify-end gap-1 pt-1 border-t border-[#E4E1DA]/60">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEdit(slot)}
                                        title="Edit Slot"
                                        className="p-1 text-[#5F6670] hover:text-[#1F5C4D] hover:bg-white rounded transition-colors"
                                      >
                                        <Edit2 className="w-3 h-3" strokeWidth={1.75} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenDelete(slot)}
                                        title="Delete Slot"
                                        className="p-1 text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7] rounded transition-colors"
                                      >
                                        <Trash2 className="w-3 h-3" strokeWidth={1.75} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}

                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenCreateForCell(item.index, band.startTime, band.endTime)
                                }
                                className="w-full py-1.5 px-2 rounded-[6px] border border-dashed border-[#E4E1DA] hover:border-[#1F5C4D] bg-[#FAF9F6]/60 hover:bg-[#E6F0EC]/40 text-[#5F6670] hover:text-[#1F5C4D] flex items-center justify-center gap-1 text-[10.5px] font-medium transition-all cursor-pointer mt-1"
                                title={`Add another slot on ${item.name} (${band.label})`}
                              >
                                <Plus className="w-3 h-3 text-[#1F5C4D]" strokeWidth={2} />
                                <span>Add Slot</span>
                              </button>
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
              slotsByDay[activeDayTab].map((slot) => {
                const theme = getClassColor(slot);
                return (
                  <Card
                    key={slot.id}
                    className="p-3 flex items-center justify-between shadow-2xs border"
                    style={{
                      borderLeft: `4px solid ${theme.accent}`,
                      backgroundColor: theme.bg,
                      borderColor: theme.border,
                    }}
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4
                          className="font-semibold text-xs leading-snug"
                          style={{ color: theme.text }}
                        >
                          {slot.className}
                        </h4>
                        {(slot.isTemporary || slot.slotType === "extra" || (slot.validFrom && slot.validFrom === slot.validTo)) && (
                          <span className="text-[10px] font-semibold text-[#854D0E] bg-[#FEF9C3] px-2 py-0.5 rounded border border-[#CA8A04]/40 whitespace-nowrap flex items-center gap-1">
                            <Zap className="w-2.5 h-2.5 text-[#B45309]" />
                            <span>
                              {slot.specificDate
                                ? `Extra • ${format(parseISO(slot.specificDate), "d MMM")}`
                                : "Extra Class"}
                            </span>
                          </span>
                        )}
                        <ClassBadge
                          subject={slot.subject}
                          name={slot.className}
                          color={slot.color}
                          size="xs"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#1F5C4D] font-semibold mt-0.5 tabular-nums">
                        <Clock className="w-3 h-3 shrink-0" strokeWidth={2} />
                        <span>{formatTimeRange(slot.startTime, slot.endTime)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(slot)}
                        title="Edit Slot"
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center p-1 text-[#5F6670] hover:text-[#1F5C4D] rounded"
                      >
                        <Edit2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDelete(slot)}
                        title="Delete Slot"
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center p-1 text-[#5F6670] hover:text-[#A32A2A] rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingSlot ? "Edit Slot" : "Add Timetable Slot"}
        description="Schedule a weekly repeating class time. Live clash checking enforces room and teacher availability."
      >
        <form onSubmit={handleSubmitSlot} className="flex flex-col gap-3 py-1">
          {formError && <Toast message={formError} variant="danger" />}

          <Field id="t-slot-class" label="Class" required>
            <Select
              id="t-slot-class"
              value={formClassId}
              onChange={(e) => setFormClassId(e.target.value)}
              disabled={Boolean(editingSlot) || formSubmitting}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field id="t-slot-weekday" label="Weekday" required>
            <Select
              id="t-slot-weekday"
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

          <div className="grid grid-cols-2 gap-3">
            <Field id="t-start" label="Start Time" required>
              <Input
                id="t-start"
                type="time"
                value={formStartTime}
                onChange={(e) => setFormStartTime(e.target.value)}
                disabled={formSubmitting}
                className="tabular-nums"
              />
            </Field>

            <Field id="t-end" label="End Time" required>
              <Input
                id="t-end"
                type="time"
                value={formEndTime}
                onChange={(e) => setFormEndTime(e.target.value)}
                disabled={formSubmitting}
                className="tabular-nums"
              />
            </Field>
          </div>

          <div className="pt-1">
            {clashStatus.checking ? (
              <div className="flex items-center gap-2 p-2.5 rounded bg-[#FAF9F6] border border-[#E4E1DA] text-xs text-[#5F6670]">
                <Clock className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                <span>Checking clash rules...</span>
              </div>
            ) : clashStatus.hasClash ? (
              <div className="flex items-start gap-2 p-2.5 rounded bg-[#FBE9E7] border border-[#A32A2A]/30 text-xs text-[#A32A2A]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={2} />
                <span>{clashStatus.message}</span>
              </div>
            ) : formClassId && formStartTime && formEndTime ? (
              <div className="flex items-center gap-2 p-2.5 rounded bg-[#E6F0EC] border border-[#1F5C4D]/30 text-xs text-[#1F5C4D]">
                <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={2} />
                <span>Time slot is available.</span>
              </div>
            ) : null}
          </div>

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

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Slot"
        description="Are you sure you want to delete this weekly slot? Future scheduled sessions will be cancelled. Past attendance records are preserved."
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
    </TeacherShell>
  );
}
