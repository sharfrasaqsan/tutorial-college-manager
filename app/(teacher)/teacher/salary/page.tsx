import React from "react";
import { cookies } from "next/headers";
import { TeacherShell } from "@/components/layout/TeacherShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeacherSalaryClientView } from "@/components/salary/TeacherSalaryClientView";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";

export default async function TeacherSalaryPage() {
  const cookieStore = await cookies();
  const selectedYear = cookieStore.get(YEAR_COOKIE_NAME)?.value || "2026";

  return (
    <TeacherShell pageTitle={`My Salaries (${selectedYear})`}>
      <PageContainer variant="default">
        <PageHeader
          title="Salary & Invoices"
          subtitle={`Session progress toward monthly payout targets and payment invoices for ${selectedYear}`}
        />
        <TeacherSalaryClientView initialYearId={selectedYear} />
      </PageContainer>
    </TeacherShell>
  );
}
