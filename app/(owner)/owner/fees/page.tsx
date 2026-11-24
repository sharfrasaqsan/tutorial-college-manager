import React from "react";
import { cookies } from "next/headers";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreditCard } from "lucide-react";

export default async function OwnerFeesPage() {
  const cookieStore = await cookies();
  const selectedYear = cookieStore.get("tcm_year")?.value || "2026";

  return (
    <OwnerShell pageTitle={`Student Fees (${selectedYear})`}>
      <PageHeader
        title={`Fee Collections (${selectedYear})`}
        subtitle={`Monthly tuition & admission fees for ${selectedYear}`}
      />
      <EmptyState
        title={`Fee records for ${selectedYear}`}
        description={`Track paid and unpaid student fees per class and month in ${selectedYear}.`}
        icon={<CreditCard className="w-8 h-8" strokeWidth={1.75} />}
      />
    </OwnerShell>
  );
}
