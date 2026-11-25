import React from "react";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function OwnerReportsLoading() {
  return (
    <OwnerShell pageTitle="Reports & Statements" maxWidth="wide">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton variant="text" className="w-96 max-w-full" />
      </div>

      <div className="space-y-5">
        <Skeleton className="h-14 w-full" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 space-y-2.5">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height="64px" />
            ))}
          </div>
          <div className="lg:col-span-8">
            <Card className="p-5 space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-9 w-32" />
              </div>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </Card>
          </div>
        </div>
      </div>
    </OwnerShell>
  );
}
