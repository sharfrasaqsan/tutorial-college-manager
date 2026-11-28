"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Printer,
  Calendar,
  Clock,
  User,
  Filter,
  AlertCircle,
  LayoutGrid,
  List,
} from "lucide-react";
import type { PublicSafeSlot } from "@/types";
import { formatTimeDisplay, calculateDuration, getColomboNow } from "@/lib/dates";
import { isSlotLiveNow } from "@/lib/timetable";
import { getClassColor } from "@/lib/class-colors";
import { ClassBadge } from "@/components/ui/ClassBadge";

const WEEKDAYS = [
  { index: 1, name: "Mon", full: "Monday" },
  { index: 2, name: "Tue", full: "Tuesday" },
  { index: 3, name: "Wed", full: "Wednesday" },
  { index: 4, name: "Thu", full: "Thursday" },
  { index: 5, name: "Fri", full: "Friday" },
  { index: 6, name: "Sat", full: "Saturday" },
  { index: 0, name: "Sun", full: "Sunday" },
];

interface PublicTimetableClientProps {
  slots: PublicSafeSlot[];
  grades: string[];
  collegeName: string;
  activeYear: string;
}

export function PublicTimetableClient({
  slots,
  grades,
  collegeName,
  activeYear,
}: PublicTimetableClientProps) {
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [activeDayTab, setActiveDayTab] = useState<number | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "day">("grid");
  const [nowTick, setNowTick] = useState<Date | null>(null);

  useEffect(() => {
    setNowTick(getColomboNow());
    const timer = setInterval(() => setNowTick(getColomboNow()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Filter slots (excludes extra/temporary slots from public view)
  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (
        slot.isTemporary ||
        Boolean(slot.specificDate) ||
        (slot as any).isExtra ||
        (slot as any).slotType === "extra"
      ) {
        return false;
      }
      const matchGrade = selectedGrade === "all" || slot.grade === selectedGrade;
      const matchDay = activeDayTab === "all" || Number(slot.weekday) === activeDayTab;
      return matchGrade && matchDay;
    });
  }, [slots, selectedGrade, activeDayTab]);

  // Extract unique scheduled time bands
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

  // Group filtered slots by weekday
  const slotsByWeekday: Record<number, PublicSafeSlot[]> = useMemo(() => {
    const map: Record<number, PublicSafeSlot[]> = {};
    WEEKDAYS.forEach((w) => {
      map[w.index] = [];
    });

    filteredSlots.forEach((slot) => {
      const d = Number(slot.weekday ?? 0);
      if (!map[d]) map[d] = [];
      map[d].push(slot);
    });

    Object.keys(map).forEach((dayKey) => {
      const d = Number(dayKey);
      map[d].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    return map;
  }, [filteredSlots]);

  function handlePrint() {
    window.print();
  }

  return (
    <div>
      {/* Controls Bar (Hidden during print) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[8px] p-4 shadow-xs print:hidden">
        {/* Grade Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-[#5F6670] font-medium mr-1">
            <Filter className="w-3.5 h-3.5 text-[#1F5C4D]" />
            <span>Filter Grade:</span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedGrade("all")}
            className={`px-3 py-1 rounded-[4px] text-xs font-medium transition-colors ${selectedGrade === "all"
              ? "bg-[#1F5C4D] text-[#FFFFFF]"
              : "bg-[#FAF9F6] text-[#1C1F23] border border-[#E4E1DA] hover:border-[#1F5C4D]"
              }`}
          >
            All Grades ({slots.length})
          </button>

          {grades.map((grade) => (
            <button
              key={grade}
              type="button"
              onClick={() => setSelectedGrade(grade)}
              className={`px-3 py-1 rounded-[4px] text-xs font-medium transition-colors ${selectedGrade === grade
                ? "bg-[#1F5C4D] text-[#FFFFFF]"
                : "bg-[#FAF9F6] text-[#1C1F23] border border-[#E4E1DA] hover:border-[#1F5C4D]"
                }`}
            >
              {grade}
            </button>
          ))}
        </div>

        {/* View Switcher & Print Button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center border border-[#E4E1DA] rounded-[6px] p-0.5 bg-[#FAF9F6]">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${viewMode === "grid"
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
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${viewMode === "day"
                ? "bg-white text-[#1C1F23] shadow-2xs font-semibold"
                : "text-[#5F6670] hover:text-[#1C1F23]"
                }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Day View</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-[6px] bg-[#FFFFFF] border border-[#E4E1DA] hover:bg-[#FAF9F6] text-xs font-medium text-[#1C1F23] transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-[#1F5C4D]" />
            <span>Print Timetable</span>
          </button>
        </div>
      </div>

      {/* Weekday Tab Selector for Mobile (Hidden during print) */}
      <div className="flex sm:hidden overflow-x-auto gap-1 pb-3 mb-6 print:hidden">
        <button
          type="button"
          onClick={() => setActiveDayTab("all")}
          className={`px-3 py-1.5 rounded-[4px] text-xs font-medium whitespace-nowrap shrink-0 ${activeDayTab === "all"
            ? "bg-[#1F5C4D] text-[#FFFFFF]"
            : "bg-[#FFFFFF] border border-[#E4E1DA] text-[#5F6670]"
            }`}
        >
          All Days
        </button>
        {WEEKDAYS.map((w) => (
          <button
            key={w.index}
            type="button"
            onClick={() => setActiveDayTab(w.index)}
            className={`px-3 py-1.5 rounded-[4px] text-xs font-medium whitespace-nowrap shrink-0 ${activeDayTab === w.index
              ? "bg-[#1F5C4D] text-[#FFFFFF]"
              : "bg-[#FFFFFF] border border-[#E4E1DA] text-[#5F6670]"
              }`}
          >
            {w.full}
          </button>
        ))}
      </div>

      {/* Printable Header (Visible ONLY on print) */}
      <div className="hidden print:block mb-6 border-b border-[#1C1F23] pb-3">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#1C1F23]">
              {collegeName}
            </h1>
            <p className="text-sm text-[#1C1F23]">
              Official Weekly Academic Timetable &bull; Academic Year {activeYear}
            </p>
          </div>
          <div className="text-right text-xs text-[#5F6670]">
            <div>Printed: {new Date().toLocaleDateString("en-LK")}</div>
            {selectedGrade !== "all" && <div>Grade: {selectedGrade}</div>}
          </div>
        </div>
      </div>

      {/* Timetable Days Display */}
      {filteredSlots.length === 0 ? (
        <div className="border border-[#E4E1DA] rounded-[8px] bg-[#FFFFFF] p-12 text-center text-xs text-[#5F6670]">
          <Calendar className="w-8 h-8 text-[#5F6670]/60 mx-auto mb-3" />
          <p className="font-medium text-[#1C1F23]">No class slots found</p>
          <p className="mt-1">
            {selectedGrade === "all"
              ? "Weekly timetable slots for this academic year will be published shortly."
              : `No timetable slots currently scheduled for ${selectedGrade}.`}
          </p>
        </div>
      ) : (
        <>
          {/* DESKTOP CALENDAR MATRIX (Weekly Grid with Time Column at starting) */}
          {viewMode === "grid" && (
            <div className="hidden sm:block print:hidden w-full border border-[#E4E1DA] rounded-[8px] bg-white overflow-hidden shadow-2xs mb-6">
              <div className="overflow-x-auto [scrollbar-width:thin] scrollbar-thin scrollbar-thumb-[#D0CCC3] hover:scrollbar-thumb-[#1F5C4D]/60 scrollbar-track-[#FAF9F6] scroll-smooth">
                <table className="w-full text-left border-collapse table-fixed min-w-0">
                  <colgroup>
                    <col className="w-[84px]" />
                    {WEEKDAYS.map((day) => (
                      <col key={day.index} className="w-[calc((100%-84px)/7)]" />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="border-b border-[#E4E1DA] bg-[#FAF9F6]">
                      {/* TIME COLUMN HEADER AT STARTING */}
                      <th
                        className="sticky left-0 z-20 bg-[#FAF9F6] p-1.5 sm:p-2 border-r border-[#E4E1DA] text-xs font-semibold uppercase tracking-wider text-[#5F6670] shrink-0 shadow-[3px_0_6px_rgba(0,0,0,0.06)] w-[84px]"
                      >
                        <div className="flex items-center gap-1 sm:gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#1F5C4D] shrink-0" strokeWidth={2} />
                          <span className="text-[11px] sm:text-xs font-bold text-[#5F6670]">TIME</span>
                        </div>
                      </th>

                      {/* DAY HEADERS: Monday to Sunday */}
                      {WEEKDAYS.map((day) => {
                        const count = slotsByWeekday[day.index]?.length || 0;
                        return (
                          <th
                            key={day.index}
                            className="p-1.5 sm:p-2 border-r last:border-r-0 border-[#E4E1DA] text-xs font-semibold text-[#1C1F23] overflow-hidden w-[calc((100%-84px)/7)]"
                          >
                            <div className="flex items-center justify-between gap-1 min-w-0">
                              <span className="font-bold text-xs hidden xl:inline truncate">{day.full}</span>
                              <span className="font-bold text-xs xl:hidden">{day.name}</span>
                              <span
                                className={`text-[10px] font-semibold px-1 sm:px-1.5 py-0.5 rounded-full shrink-0 ${count > 0
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
                          className="sticky left-0 z-10 bg-[#FAF9F6] p-2 border-r border-[#E4E1DA] align-top shrink-0 shadow-[3px_0_6px_rgba(0,0,0,0.06)] w-[84px]"
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
                        {WEEKDAYS.map((day) => {
                          const cellSlots = filteredSlots.filter(
                            (s) =>
                              Number(s.weekday) === day.index &&
                              s.startTime === band.startTime &&
                              s.endTime === band.endTime
                          );

                          return (
                            <td
                              key={day.index}
                              className="p-1 sm:p-1.5 md:p-2 border-r last:border-r-0 border-[#E4E1DA] align-top overflow-hidden w-[calc((100%-84px)/7)]"
                            >
                              {cellSlots.length > 0 ? (
                                <div className="flex flex-col gap-1.5 h-full">
                                  {cellSlots.map((slot) => {
                                    const theme = getClassColor(slot);
                                    const isLive = nowTick ? isSlotLiveNow(slot, nowTick) : false;
                                    return (
                                      <div
                                        key={slot.id}
                                        className={`rounded-[6px] p-1.5 sm:p-2 flex flex-col gap-1 shadow-2xs border transition-colors max-w-full overflow-hidden ${
                                          isLive ? "ring-2 ring-[#16A34A]/60 shadow-sm" : ""
                                        }`}
                                        style={{
                                          borderLeft: `3px solid ${theme.accent}`,
                                          backgroundColor: theme.bg,
                                          borderColor: theme.border,
                                        }}
                                      >
                                        <div className="flex items-start justify-between gap-1 max-w-full">
                                          <span
                                            className="font-serif font-semibold text-[11px] sm:text-xs leading-tight truncate min-w-0"
                                            style={{ color: theme.text }}
                                          >
                                            {slot.subject}
                                          </span>
                                          <div className="flex items-center gap-1 shrink-0">
                                            {isLive && (
                                              <span
                                                className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#15803D] bg-[#DCFCE7] px-1 py-0.2 rounded border border-[#16A34A]/40"
                                                title="Class is currently in progress"
                                              >
                                                <span className="relative flex h-1.5 w-1.5">
                                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-75" />
                                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#16A34A]" />
                                                </span>
                                                <span>Live</span>
                                              </span>
                                            )}
                                            <span className="text-[9px] sm:text-[10px] font-medium bg-[#FAF9F6] border border-[#E4E1DA] text-[#1C1F23] px-1 py-0.2 rounded shrink-0">
                                              {slot.grade}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="text-[10px] sm:text-[11px] text-[#5F6670] truncate mt-0.5 min-w-0">
                                          {slot.teacherName}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="h-10 flex items-center justify-center text-xs text-[#5F6670]/40 select-none">
                                  —
                                </div>
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
          )}

          {/* DAY VIEW & MOBILE / PRINT VIEW */}
          <div
            className={`${viewMode === "grid" ? "block sm:hidden" : "block"
              } print:block space-y-6`}
          >
            {WEEKDAYS.map((day) => {
              const daySlots = slotsByWeekday[day.index] || [];
              if (activeDayTab !== "all" && activeDayTab !== day.index) return null;
              if (daySlots.length === 0) return null;

              return (
                <div
                  key={day.index}
                  className="border border-[#E4E1DA] rounded-[8px] bg-[#FFFFFF] overflow-hidden shadow-xs print:border print:border-[#1C1F23] print:shadow-none break-inside-avoid"
                >
                  {/* Day Header */}
                  <div className="bg-[#FAF9F6] border-b border-[#E4E1DA] px-4 py-3 flex items-center justify-between print:bg-transparent print:border-b-2 print:border-[#1C1F23]">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-semibold text-base text-[#1C1F23]">
                        {day.full}
                      </span>
                      <span className="text-xs text-[#5F6670]">
                        ({daySlots.length} {daySlots.length === 1 ? "Class" : "Classes"})
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-[#1F5C4D] bg-[#E6F0EC] px-2 py-0.5 rounded-[4px] print:hidden">
                      Weekly Regular
                    </span>
                  </div>

                  {/* Day Slots List */}
                  <div className="divide-y divide-[#E4E1DA]">
                    {daySlots.map((slot) => {
                      const theme = getClassColor(slot);
                      const isLive = nowTick ? isSlotLiveNow(slot, nowTick) : false;
                      return (
                        <div
                          key={slot.id}
                          className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F6]/50 transition-colors border-l-4 ${
                            isLive ? "bg-[#F0FDF4]/60 print:bg-transparent" : ""
                          }`}
                          style={{ borderLeftColor: theme.accent }}
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-28 shrink-0 font-mono text-xs font-semibold text-[#1F5C4D] bg-[#E6F0EC]/80 px-2.5 py-1.5 rounded-[4px] text-center border border-[#E4E1DA]/50 print:bg-transparent print:border-[#1C1F23]">
                              {formatTimeDisplay(slot.startTime)} – {formatTimeDisplay(slot.endTime)}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="font-serif font-semibold text-base"
                                  style={{ color: theme.text }}
                                >
                                  {slot.subject}
                                </span>
                                <span className="text-[11px] font-medium bg-[#FAF9F6] border border-[#E4E1DA] text-[#1C1F23] px-2 py-0.5 rounded-[4px]">
                                  {slot.grade}
                                </span>
                                {isLive && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded border border-[#16A34A]/40 print:hidden"
                                    title="Class is currently in progress"
                                  >
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-75" />
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#16A34A]" />
                                    </span>
                                    <span>Live Now</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 text-xs text-[#5F6670] mt-1">
                                <User className="w-3.5 h-3.5 text-[#1F5C4D]" />
                                <span>
                                  Faculty:{" "}
                                  <strong className="text-[#1C1F23] font-medium">
                                    {slot.teacherName}
                                  </strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0 print:hidden text-[11px] text-[#5F6670]">
                            Recurring weekly
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Note footer */}
      <div className="mt-8 p-3 rounded-[6px] bg-[#FAF9F6] border border-[#E4E1DA] text-xs text-[#5F6670] flex items-center gap-2 print:border-[#1C1F23]">
        <AlertCircle className="w-4 h-4 text-[#1F5C4D] shrink-0" />
        <span>
          Note: All slots reflect regular weekly classes for Academic Year {activeYear}. Special workshops and exam review sessions are announced separately.
        </span>
      </div>
    </div>
  );
}
