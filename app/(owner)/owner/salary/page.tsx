import React from "react";
import { cookies } from "next/headers";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { OwnerSalaryClientView } from "@/components/salary/OwnerSalaryClientView";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";

export default async function OwnerSalaryPage() {
  const cookieStore = await cookies();
  const selectedYear = cookieStore.get(YEAR_COOKIE_NAME)?.value || "2026";

  return (
    <OwnerShell pageTitle={`Teacher Salaries (${selectedYear})`}>
      <PageContainer variant="wide">
        <PageHeader
          title={`Teacher Salaries (${selectedYear})`}
          subtitle={`Session progress, monthly teacher share calculations, and salary payment invoices for ${selectedYear}`}
        />
        <OwnerSalaryClientView initialYearId={selectedYear} />
      </PageContainer>
    </OwnerShell>
  );
}
