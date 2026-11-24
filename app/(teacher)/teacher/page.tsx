import React from "react";
import { TeacherShell } from "@/components/layout/TeacherShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CalendarDays } from "lucide-react";

export default function TeacherTodayPage() {
  return (
    <TeacherShell pageTitle="Today's Sessions">
      <PageHeader title="Today" subtitle="Session marking & attendance" />
      <EmptyState
        title="No sessions today"
        description="Your scheduled classes for today will appear here for marking Held or Missed."
        icon={<CalendarDays className="w-8 h-8" strokeWidth={1.75} />}
      />
    </TeacherShell>
  );
}
