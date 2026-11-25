import React from "react";
import { TeacherShell } from "@/components/layout/TeacherShell";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function TeacherSalaryLoading() {
  return (
    <TeacherShell pageTitle="My Salaries" maxWidth="wide">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton variant="text" className="w-80 max-w-full" />
      </div>

      <div className="space-y-6">
        <Skeleton className="h-14 w-full" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 space-y-2">
              <Skeleton variant="text" className="w-20" />
              <Skeleton className="h-7 w-28" />
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-3">
            <Skeleton height="84px" />
            <Skeleton height="84px" />
          </div>
          <div className="lg:col-span-5">
            <Skeleton height="160px" />
          </div>
        </div>
      </div>
    </TeacherShell>
  );
}
