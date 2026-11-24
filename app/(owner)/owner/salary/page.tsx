import React from "react";
import { cookies } from "next/headers";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Banknote } from "lucide-react";

export default async function OwnerSalaryPage() {
  const cookieStore = await cookies();
  const selectedYear = cookieStore.get("tcm_year")?.value || "2026";

  return (
    <OwnerShell pageTitle={`Salaries (${selectedYear})`}>
      <PageHeader
        title={`Teacher Salaries (${selectedYear})`}
        subtitle={`Payouts & session counts for ${selectedYear}`}
      />
      <EmptyState
        title={`Salaries for ${selectedYear}`}
        description={`Calculate teacher shares based on enrolled students and generate monthly invoices for ${selectedYear}.`}
        icon={<Banknote className="w-8 h-8" strokeWidth={1.75} />}
      />
    </OwnerShell>
  );
}
