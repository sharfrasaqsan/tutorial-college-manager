import React from "react";
import { TeacherShell } from "@/components/layout/TeacherShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookOpen } from "lucide-react";

export default function TeacherClassesPage() {
  return (
    <TeacherShell pageTitle="My Classes">
      <PageHeader title="Assigned Classes" subtitle="Enrolled students & contacts" />
      <EmptyState
        title="My classes directory"
        description="View your assigned classes and enrolled student contact information."
        icon={<BookOpen className="w-8 h-8" strokeWidth={1.75} />}
      />
    </TeacherShell>
  );
}
