import React from "react";
import { cookies } from "next/headers";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookOpen } from "lucide-react";

export default async function OwnerClassesPage() {
  const cookieStore = await cookies();
  const selectedYear = cookieStore.get("tcm_year")?.value || "2026";

  return (
    <OwnerShell pageTitle={`Classes (${selectedYear})`}>
      <PageHeader
        title={`Classes (${selectedYear})`}
        subtitle={`Class offerings & timetable schedule for ${selectedYear}`}
      />
      <EmptyState
        title={`No classes in ${selectedYear} yet`}
        description={`Manage grade subjects, assigned teachers, and weekly timetables for academic year ${selectedYear}.`}
        icon={<BookOpen className="w-8 h-8" strokeWidth={1.75} />}
      />
    </OwnerShell>
  );
}
