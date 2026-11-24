"use client";

import React, { useState } from "react";
import { Printer, Calendar, Clock, User, Filter, AlertCircle } from "lucide-react";
import type { PublicSafeSlot } from "@/types";

const WEEKDAYS = [
  { index: 1, name: "Monday" },
  { index: 2, name: "Tuesday" },
  { index: 3, name: "Wednesday" },
  { index: 4, name: "Thursday" },
  { index: 5, name: "Friday" },
  { index: 6, name: "Saturday" },
  { index: 0, name: "Sunday" },
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

  // Filter slots
  const filteredSlots = slots.filter((slot) => {
    const matchGrade = selectedGrade === "all" || slot.grade === selectedGrade;
    const matchDay = activeDayTab === "all" || slot.weekday === activeDayTab;
    return matchGrade && matchDay;
  });

  // Group filtered slots by weekday
  const slotsByWeekday: Record<number, PublicSafeSlot[]> = {};
  WEEKDAYS.forEach((w) => {
    slotsByWeekday[w.index] = [];
  });

  filteredSlots.forEach((slot) => {
    const d = slot.weekday ?? 0;
    if (!slotsByWeekday[d]) slotsByWeekday[d] = [];
    slotsByWeekday[d].push(slot);
  });

  // Sort slots inside each day by start time
  Object.keys(slotsByWeekday).forEach((dayKey) => {
    const d = Number(dayKey);
    slotsByWeekday[d].sort((a, b) => a.startTime.localeCompare(b.startTime));
  });

  function handlePrint() {
    window.print();
  }

  return (
    <div>
      {/* Controls Bar (Hidden during print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] p-4 shadow-xs print:hidden">
        {/* Grade Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-[#5F6670] font-medium mr-1">
            <Filter className="w-3.5 h-3.5 text-[#1F5C4D]" />
            <span>Filter Grade:</span>
          </div>

          <button
            type="button"
            onClick={() => setSelectedGrade("all")}
            className={`px-3 py-1 rounded-[4px] text-xs font-medium transition-colors ${
              selectedGrade === "all"
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
              className={`px-3 py-1 rounded-[4px] text-xs font-medium transition-colors ${
                selectedGrade === grade
                  ? "bg-[#1F5C4D] text-[#FFFFFF]"
                  : "bg-[#FAF9F6] text-[#1C1F23] border border-[#E4E1DA] hover:border-[#1F5C4D]"
              }`}
            >
              {grade}
            </button>
          ))}
        </div>

        {/* Print Button */}
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-[6px] bg-[#FFFFFF] border border-[#E4E1DA] hover:bg-[#FAF9F6] text-xs font-medium text-[#1C1F23] transition-colors shadow-xs"
        >
          <Printer className="w-3.5 h-3.5 text-[#1F5C4D]" />
          <span>Print Timetable</span>
        </button>
      </div>

      {/* Weekday Tab Selector for Mobile (Hidden during print) */}
      <div className="flex sm:hidden overflow-x-auto gap-1 pb-3 mb-6 print:hidden">
        <button
          type="button"
          onClick={() => setActiveDayTab("all")}
          className={`px-3 py-1.5 rounded-[4px] text-xs font-medium whitespace-nowrap shrink-0 ${
            activeDayTab === "all"
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
            className={`px-3 py-1.5 rounded-[4px] text-xs font-medium whitespace-nowrap shrink-0 ${
              activeDayTab === w.index
                ? "bg-[#1F5C4D] text-[#FFFFFF]"
                : "bg-[#FFFFFF] border border-[#E4E1DA] text-[#5F6670]"
            }`}
          >
            {w.name}
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
        <div className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] p-12 text-center text-xs text-[#5F6670]">
          <Calendar className="w-8 h-8 text-[#5F6670]/60 mx-auto mb-3" />
          <p className="font-medium text-[#1C1F23]">No class slots found</p>
          <p className="mt-1">
            {selectedGrade === "all"
              ? "Weekly timetable slots for this academic year will be published shortly."
              : `No timetable slots currently scheduled for ${selectedGrade}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-8 print:space-y-6">
          {WEEKDAYS.map((day) => {
            const daySlots = slotsByWeekday[day.index] || [];
            if (activeDayTab !== "all" && activeDayTab !== day.index) return null;
            if (daySlots.length === 0) return null;

            return (
              <div
                key={day.index}
                className="border border-[#E4E1DA] rounded-[6px] bg-[#FFFFFF] overflow-hidden shadow-xs print:border print:border-[#1C1F23] print:shadow-none break-inside-avoid"
              >
                {/* Day Header */}
                <div className="bg-[#FAF9F6] border-b border-[#E4E1DA] px-4 py-3 flex items-center justify-between print:bg-transparent print:border-b-2 print:border-[#1C1F23]">
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-semibold text-base text-[#1C1F23]">
                      {day.name}
                    </span>
                    <span className="text-xs text-[#5F6670]">
                      ({daySlots.length} {daySlots.length === 1 ? "Class" : "Classes"})
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-[#1F5C4D] bg-[#E6F0EC] px-2 py-0.5 rounded-[4px] print:hidden">
                    Weekly Regular Slot
                  </span>
                </div>

                {/* Day Slots List / Table */}
                <div className="divide-y divide-[#E4E1DA]">
                  {daySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF9F6]/50 transition-colors"
                    >
                      {/* Left: Time & Class details */}
                      <div className="flex items-start gap-4">
                        <div className="w-24 shrink-0 font-mono text-xs font-semibold text-[#1F5C4D] bg-[#E6F0EC]/80 px-2.5 py-1.5 rounded-[4px] text-center border border-[#E4E1DA]/50 print:bg-transparent print:border-[#1C1F23]">
                          {slot.startTime} – {slot.endTime}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-semibold text-base text-[#1C1F23]">
                              {slot.subject}
                            </span>
                            <span className="text-[11px] font-medium bg-[#FAF9F6] border border-[#E4E1DA] text-[#1C1F23] px-2 py-0.5 rounded-[4px]">
                              {slot.grade}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-[#5F6670] mt-1">
                            <User className="w-3.5 h-3.5 text-[#1F5C4D]" />
                            <span>Faculty: <strong className="text-[#1C1F23] font-medium">{slot.teacherName}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Badge */}
                      <div className="text-right shrink-0 print:hidden">
                        <span className="text-[11px] text-[#5F6670]">
                          Recurring weekly
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Note footer */}
      <div className="mt-8 p-3 rounded-[6px] bg-[#FAF9F6] border border-[#E4E1DA] text-xs text-[#5F6670] flex items-center gap-2 print:border-[#1C1F23]">
        <AlertCircle className="w-4 h-4 text-[#1F5C4D] shrink-0" />
        <span>
          Note: All slots reflect regular weekly classes. Make-up sessions and special exam workshops are communicated separately to enrolled students.
        </span>
      </div>
    </div>
  );
}
