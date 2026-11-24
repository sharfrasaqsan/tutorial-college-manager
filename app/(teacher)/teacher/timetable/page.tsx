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
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import {
  WEEKDAY_NAMES,
  SHORT_WEEKDAY_NAMES,
  formatTimeDisplay,
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
    <TeacherShell pageTitle="Weekly Timetable" maxWidth="wide">
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
      ) : (
        <>
          {/* PHONE & TABLET VIEW: Day Tabs (hidden on lg screens and wider) */}
          <div className="block lg:hidden">
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

            {/* Slots list for selected day */}
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
                  <Card
                    key={slot.id}
                    className="p-3 bg-white border border-[#E4E1DA] flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold text-xs text-[#1C1F23]">{slot.className}</h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#1F5C4D] font-semibold mt-0.5 tabular-nums">
                        <Clock className="w-3 h-3" strokeWidth={2} />
                        <span>
                          {formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}
                        </span>
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
                ))
              )}
            </div>
          </div>

          {/* DESKTOP VIEW: 7-Column Weekly Grid (from lg screens up) */}
          <div className="hidden lg:grid lg:grid-cols-7 gap-3 items-start">
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
                        <div
                          key={slot.id}
                          className="bg-white border border-[#E4E1DA] rounded p-2.5 flex flex-col gap-1.5 shadow-2xs hover:border-[#1F5C4D] transition-colors"
                        >
                          <div className="font-semibold text-xs text-[#1C1F23] line-clamp-1">
                            {slot.className}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-[#1F5C4D] font-medium tabular-nums">
                            <Clock className="w-3 h-3 shrink-0" strokeWidth={2} />
                            <span>
                              {formatTimeDisplay(slot.startTime)} - {formatTimeDisplay(slot.endTime)}
                            </span>
                          </div>
                          <div className="flex items-center justify-end gap-1 pt-1 border-t border-[#E4E1DA]/60">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(slot)}
                              title="Edit Slot"
                              className="p-1 text-[#5F6670] hover:text-[#1F5C4D] rounded"
                            >
                              <Edit2 className="w-3 h-3" strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDelete(slot)}
                              title="Delete Slot"
                              className="p-1 text-[#5F6670] hover:text-[#A32A2A] rounded"
                            >
                              <Trash2 className="w-3 h-3" strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
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
              {WEEKDAY_NAMES.map((name, i) => (
                <option key={i} value={i}>
                  {name}
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
