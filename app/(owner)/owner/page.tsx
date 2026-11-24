import React from "react";
import { cookies } from "next/headers";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Home } from "lucide-react";

export default async function OwnerHomePage() {
  const cookieStore = await cookies();
  const selectedYear = cookieStore.get("tcm_year")?.value || "2026";

  return (
    <OwnerShell pageTitle={`Owner Overview (${selectedYear})`}>
      <PageHeader
        title={`Academic Year ${selectedYear}`}
        subtitle="College operations, active roster & financial summaries"
      />
      <EmptyState
        title={`Year ${selectedYear} Active`}
        description={`Displaying records for Academic Year ${selectedYear}. Use the year selector above to switch views.`}
        icon={<Home className="w-8 h-8" strokeWidth={1.75} />}
      />
    </OwnerShell>
  );
}
