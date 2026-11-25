import React from "react";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function OwnerDashboardLoading() {
  return (
    <OwnerShell pageTitle="College Dashboard">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton variant="text" className="w-80 max-w-full" />
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 h-[108px] flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <Skeleton variant="text" className="w-20" />
                <Skeleton className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-7 w-12" />
                <Skeleton variant="text" className="w-24" />
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-3">
            <Card className="p-5 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </Card>
          </div>
          <div className="lg:col-span-5">
            <Card className="p-5 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </Card>
          </div>
        </div>
      </div>
    </OwnerShell>
  );
}
