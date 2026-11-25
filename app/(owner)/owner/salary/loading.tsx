import React from "react";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function OwnerSalaryLoading() {
  return (
    <OwnerShell pageTitle="Teacher Salaries" maxWidth="wide">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton variant="text" className="w-96 max-w-full" />
      </div>

      <div className="space-y-5">
        <Skeleton className="h-14 w-full" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height="84px" />
            ))}
          </div>
          <div className="lg:col-span-7">
            <Card className="p-5 space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </Card>
          </div>
        </div>
      </div>
    </OwnerShell>
  );
}
