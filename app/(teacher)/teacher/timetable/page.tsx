import React from "react";
import { TeacherShell } from "@/components/layout/TeacherShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Clock } from "lucide-react";

export default function TeacherTimetablePage() {
  return (
    <TeacherShell pageTitle="Weekly Timetable">
      <PageHeader title="Timetable" subtitle="Weekly assigned slots" />
      <EmptyState
        title="Timetable view"
        description="Your recurring weekly class times and scheduled make-up sessions."
        icon={<Clock className="w-8 h-8" strokeWidth={1.75} />}
      />
    </TeacherShell>
  );
}
