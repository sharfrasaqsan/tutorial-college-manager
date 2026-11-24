import React from "react";
import { TeacherShell } from "@/components/layout/TeacherShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Banknote } from "lucide-react";

export default function TeacherSalaryPage() {
  return (
    <TeacherShell pageTitle="My Salaries">
      <PageHeader title="Salary & Invoices" subtitle="Monthly progress & payment receipts" />
      <EmptyState
        title="Salary dashboard"
        description="Track held session counts toward monthly targets and download salary invoices."
        icon={<Banknote className="w-8 h-8" strokeWidth={1.75} />}
      />
    </TeacherShell>
  );
}
