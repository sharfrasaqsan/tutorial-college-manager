import React from "react";
import { cookies } from "next/headers";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReportsClientView } from "@/components/reports/ReportsClientView";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";

export default async function OwnerReportsPage() {
  const cookieStore = await cookies();
  const selectedYear = cookieStore.get(YEAR_COOKIE_NAME)?.value || "2026";

  return (
    <OwnerShell pageTitle={`Reports & Statements (${selectedYear})`} maxWidth="wide">
      <PageHeader
        title={`Reports & Statements (${selectedYear})`}
        subtitle="Monthly financial statements, student payments, arrears & teacher salary reports"
      />
      <ReportsClientView initialYearId={selectedYear} />
    </OwnerShell>
  );
}
