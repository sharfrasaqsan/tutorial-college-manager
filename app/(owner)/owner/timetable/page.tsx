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
} from "lucide-react";
import {
  WEEKDAY_NAMES,
  SHORT_WEEKDAY_NAMES,
  formatTimeDisplay,
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
  }>({ checking: false, hasClash: false });

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

  // Open modal for editing slot
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
    <OwnerShell pageTitle="Weekly Timetable" maxWidth="5xl">
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
        title="Weekly Timetable"
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

        <div className="text-[11px] text-[#5F6670] flex items-center gap-2">
          <StatusChip status="neutral" label={`3 Rooms Max`} />
          <span>{filteredSlots.length} active slots</span>
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
      ) : (
        <>
          {/* PHONE VIEW: Horizontal Day Tabs (hidden on md screens and wider) */}
          <div className="block md:hidden">
            <div className="flex overflow-x-auto gap-1 pb-2 border-b border-[#E4E1DA] mb-3 no-scrollbar">
              {SHORT_WEEKDAY_NAMES.map((name, index) => {
                const count = slotsByDay[index]?.length || 0;
                const isSelected = activeDayTab === index;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveDayTab(index)}
                    className={`min-h-[44px] flex-1 min-w-[48px] py-2 px-1 flex flex-col items-center justify-center rounded-[6px] border transition-colors select-none ${
                      isSelected
                        ? "bg-[#1F5C4D] text-white border-[#1F5C4D] font-semibold"
                        : "bg-white text-[#1C1F23] border-[#E4E1DA] hover:bg-[#FAF9F6]"
                    }`}
                  >
                    <span className="text-xs uppercase tracking-wider">{name}</span>
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

            {/* Slots for selected phone day tab */}
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

          {/* WIDE SCREEN VIEW: 7-Column Weekly Grid (hidden on mobile) */}
          <div className="hidden md:grid md:grid-cols-7 gap-2.5 items-start">
            {WEEKDAY_NAMES.map((dayName, dayIndex) => {
              const daySlots = slotsByDay[dayIndex] || [];
              const isToday = currentWeekday === dayIndex;

              return (
                <div
                  key={dayIndex}
                  className={`flex flex-col gap-2 bg-[#FAF9F6] rounded-[6px] border p-2 min-h-[480px] ${
                    isToday ? "border-[#1F5C4D] ring-1 ring-[#1F5C4D]" : "border-[#E4E1DA]"
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#E4E1DA]">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-xs text-[#1C1F23]">
                        {SHORT_WEEKDAY_NAMES[dayIndex]}
                      </span>
                      {isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1F5C4D]" title="Today" />
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-[#5F6670] bg-white px-1.5 py-0.5 rounded border border-[#E4E1DA]">
                      {daySlots.length}
                    </span>
                  </div>

                  {/* Day Slots List */}
                  <div className="flex flex-col gap-2 flex-1">
                    {daySlots.length === 0 ? (
                      <div className="text-[11px] text-[#5F6670] text-center py-6 italic">
                        No classes
                      </div>
                    ) : (
                      daySlots.map((slot) => (
                        <SlotCard
                          key={slot.id}
                          slot={slot}
                          compact
                          onEdit={() => handleOpenEdit(slot)}
                          onDelete={() => handleOpenDelete(slot)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
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
              {WEEKDAY_NAMES.map((name, i) => (
                <option key={i} value={i}>
                  {name}
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
      className={`p-3 bg-white border border-[#E4E1DA] hover:border-[#1F5C4D] transition-colors flex flex-col justify-between gap-2 ${
        compact ? "text-xs" : ""
      }`}
    >
      <div>
        {/* Time Banner */}
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-[#1F5C4D] bg-[#E6F0EC] px-2 py-0.5 rounded tabular-nums">
            <Clock className="w-3 h-3" strokeWidth={2} />
            <span>
              {formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}
            </span>
          </div>

          {slot.grade && (
            <span className="text-[10px] text-[#5F6670] bg-[#FAF9F6] border border-[#E4E1DA] px-1.5 py-0.5 rounded font-medium">
              {slot.grade}
            </span>
          )}
        </div>

        {/* Class Name */}
        <h4 className="font-semibold text-sm text-[#1C1F23] leading-snug">
          {slot.className || "Class Slot"}
        </h4>

        {/* Teacher Name */}
        <div className="flex items-center gap-1.5 text-xs text-[#5F6670] mt-1">
          <User className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{slot.teacherName || "Unassigned"}</span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[#E4E1DA] text-[11px]">
        <span className="text-[#5F6670] text-[10px] truncate max-w-[120px]">
          {slot.validFrom && slot.validTo
            ? `${slot.validFrom.slice(5)} to ${slot.validTo.slice(5)}`
            : "Full Year"}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            title="Edit Slot"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 text-[#5F6670] hover:text-[#1F5C4D] hover:bg-[#FAF9F6] rounded transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Delete Slot"
            className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1 text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7] rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </Card>
  );
}
