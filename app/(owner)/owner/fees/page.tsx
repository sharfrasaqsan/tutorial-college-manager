import React from "react";
import { cookies } from "next/headers";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { FeesClientView } from "@/components/fees/FeesClientView";
import { YEAR_COOKIE_NAME } from "@/lib/academic-year";

export default async function OwnerFeesPage() {
  const cookieStore = await cookies();
  const selectedYear = cookieStore.get(YEAR_COOKIE_NAME)?.value || "2026";

  return (
    <OwnerShell pageTitle={`Student Fees (${selectedYear})`}>
      <PageContainer variant="wide">
        <PageHeader
          title={`Fee Collections (${selectedYear})`}
          subtitle={`Track and record student class fees & admission fee payments for ${selectedYear}`}
        />
        <FeesClientView initialYearId={selectedYear} />
      </PageContainer>
    </OwnerShell>
  );
}
