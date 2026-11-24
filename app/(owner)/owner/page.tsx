import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Users, GraduationCap, BookOpen, ChevronRight, ArrowUpRight, Calendar } from "lucide-react";

export default async function OwnerHomePage() {
  const cookieStore = await cookies();
  const selectedYear = cookieStore.get("tcm_year")?.value || "2026";

  return (
    <OwnerShell pageTitle={`College Overview (${selectedYear})`}>
      <PageHeader
        title={`Academic Year ${selectedYear}`}
        subtitle="Institution dashboard, active student rosters & faculty directory"
      />

      <div className="flex flex-col gap-4">
        {/* Quick Operations Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/owner/students">
            <Card className="p-4 hover:border-[#1F5C4D] transition-colors cursor-pointer group">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#5F6670] group-hover:text-[#1F5C4D] transition-colors" />
              </div>
              <h3 className="font-semibold text-sm text-[#1C1F23] mt-3">Student Directory</h3>
              <p className="text-xs text-[#5F6670] mt-0.5">
                Manage registered students, grade allocations and admission fees for Year {selectedYear}.
              </p>
            </Card>
          </Link>

          <Link href="/owner/teachers">
            <Card className="p-4 hover:border-[#1F5C4D] transition-colors cursor-pointer group">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center">
                  <Users className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#5F6670] group-hover:text-[#1F5C4D] transition-colors" />
              </div>
              <h3 className="font-semibold text-sm text-[#1C1F23] mt-3">Teachers &amp; Faculty</h3>
              <p className="text-xs text-[#5F6670] mt-0.5">
                Register teachers, manage login access and public profile visibility.
              </p>
            </Card>
          </Link>
        </div>

        {/* Classes & Academic Navigation */}
        <Card className="p-4">
          <CardHeader className="p-0 pb-3 border-b border-[#E4E1DA]">
            <CardTitle>Academic Operations ({selectedYear})</CardTitle>
          </CardHeader>
          <div className="divide-y divide-[#E4E1DA] text-xs">
            <Link
              href="/owner/classes"
              className="py-3 flex items-center justify-between hover:text-[#1F5C4D] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                <div>
                  <span className="font-semibold text-[#1C1F23] block">Classes &amp; Subjects</span>
                  <span className="text-[#5F6670] block">Assign teachers to Grade + Subject combinations</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#5F6670]" strokeWidth={1.75} />
            </Link>

            <Link
              href="/owner/timetable"
              className="py-3 flex items-center justify-between hover:text-[#1F5C4D] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                <div>
                  <span className="font-semibold text-[#1C1F23] block">Weekly Timetable</span>
                  <span className="text-[#5F6670] block">Schedule slots, check room capacity &amp; faculty availability</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#5F6670]" strokeWidth={1.75} />
            </Link>
          </div>
        </Card>
      </div>
    </OwnerShell>
  );
}
