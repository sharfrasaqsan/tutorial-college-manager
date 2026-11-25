import React from "react";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function OwnerFeesLoading() {
  return (
    <OwnerShell pageTitle="Student Fees" maxWidth="wide">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton variant="text" className="w-80 max-w-full" />
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 space-y-2">
              <Skeleton variant="text" className="w-24" />
              <Skeleton className="h-6 w-28" />
            </Card>
          ))}
        </div>

        <Skeleton className="h-11 w-full max-w-xl" />

        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height="76px" />
          ))}
        </div>
      </div>
    </OwnerShell>
  );
}
