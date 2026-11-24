import React from "react";
import type { Metadata } from "next";
import { getPublicSiteData } from "@/lib/public-data";
import { PublicTimetableClient } from "@/components/public/PublicTimetableClient";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { college } = await getPublicSiteData();
  return {
    title: `Weekly Timetable | ${college.name || "Tutorial College"}`,
    description:
      "Official weekly academic timetable. View class schedules by grade level, weekdays, and times. Print-friendly and mobile optimized.",
  };
}

export default async function TimetablePage() {
  const { college, slots, activeYear } = await getPublicSiteData();

  // Extract unique sorted grades from slots
  const gradeSet = new Set<string>();
  slots.forEach((s) => {
    if (s.grade) gradeSet.add(s.grade);
  });
  const grades = Array.from(gradeSet).sort();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Page Title & Context */}
      <div className="max-w-2xl mb-8 print:hidden">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#1F5C4D]">
          Academic Year {activeYear} Schedule
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#1C1F23] mt-1.5 mb-2">
          Weekly Timetable
        </h1>
        <p className="text-xs sm:text-sm text-[#5F6670] leading-relaxed">
          Structured weekly classes designed for syllabus progression and exam preparation. Filter by grade or print a clean schedule for your refrigerator or study desk.
        </p>
      </div>

      {/* Interactive Timetable Client */}
      <PublicTimetableClient
        slots={slots}
        grades={grades}
        collegeName={college.name || "Tutorial College"}
        activeYear={activeYear}
      />
    </div>
  );
}
