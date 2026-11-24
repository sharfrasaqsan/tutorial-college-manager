"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { DataRow } from "@/components/ui/DataRow";
import { Button } from "@/components/ui/Button";
import {
  Building2,
  GraduationCap,
  CalendarPlus,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Users,
  BookOpen,
  Inbox,
  FileSpreadsheet,
} from "lucide-react";

export default function OwnerMorePage() {
  const router = useRouter();

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await signOut(auth);
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
      router.push("/login");
    }
  }

  return (
    <OwnerShell pageTitle="Settings & Tools">
      <PageHeader
        title="College Administration"
        subtitle="Institution profile, academic structure & year management"
      />

      <div className="flex flex-col gap-5">
        {/* Core People & Directory */}
        <Card className="p-0 overflow-hidden divide-y divide-[#E4E1DA]">
          <Link href="/owner/teachers" className="block">
            <DataRow
              title={
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                  <span>Teachers &amp; Faculty</span>
                </div>
              }
              subtitle="Register teachers, manage logins &amp; subject assignments"
              rightValue={<ChevronRight className="w-4 h-4 text-[#5F6670]" strokeWidth={1.75} />}
            />
          </Link>

          <Link href="/owner/students" className="block">
            <DataRow
              title={
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                  <span>Student Directory</span>
                </div>
              }
              subtitle="Permanent student records, grade rosters &amp; admission fees"
              rightValue={<ChevronRight className="w-4 h-4 text-[#5F6670]" strokeWidth={1.75} />}
            />
          </Link>
        </Card>

        {/* Management Tools Card */}
        <Card className="p-0 overflow-hidden divide-y divide-[#E4E1DA]">
          <Link href="/owner/reports" className="block">
            <DataRow
              title={
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                  <span>Reports &amp; Financial Statements</span>
                </div>
              }
              subtitle="Student payments, pending fees, teacher salary &amp; monthly summary"
              rightValue={<ChevronRight className="w-4 h-4 text-[#5F6670]" strokeWidth={1.75} />}
            />
          </Link>

          <Link href="/owner/requests" className="block">
            <DataRow
              title={
                <div className="flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                  <span>Session Correction Requests</span>
                </div>
              }
              subtitle="Review and resolve teacher requests for locked sessions"
              rightValue={<ChevronRight className="w-4 h-4 text-[#5F6670]" strokeWidth={1.75} />}
            />
          </Link>

          <Link href="/owner/more/college" className="block">
            <DataRow
              title={
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                  <span>College Profile</span>
                </div>
              }
              subtitle="Name, logo, address, phone, email & hours"
              rightValue={<ChevronRight className="w-4 h-4 text-[#5F6670]" strokeWidth={1.75} />}
            />
          </Link>

          <Link href="/owner/more/academic" className="block">
            <DataRow
              title={
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                  <span>Grades & Subjects</span>
                </div>
              }
              subtitle="Manage grade levels (1-13) and curriculum subjects"
              rightValue={<ChevronRight className="w-4 h-4 text-[#5F6670]" strokeWidth={1.75} />}
            />
          </Link>

          <Link href="/owner/more/next-year" className="block">
            <DataRow
              title={
                <div className="flex items-center gap-2">
                  <CalendarPlus className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                  <span>Start Next Year</span>
                </div>
              }
              subtitle="Advance student grades and archive finished batches"
              rightValue={<ChevronRight className="w-4 h-4 text-[#5F6670]" strokeWidth={1.75} />}
            />
          </Link>
        </Card>

        {/* College System Defaults */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
              <CardTitle>System Information</CardTitle>
            </div>
            <p className="text-xs text-[#5F6670] mt-1">
              Configuration defaults for Sri Lanka institution
            </p>
          </CardHeader>

          <div className="flex flex-col gap-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-[#E4E1DA]">
              <span className="text-[#5F6670]">Currency</span>
              <span className="font-semibold text-[#1C1F23]">LKR (Sri Lanka Rupee)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#E4E1DA]">
              <span className="text-[#5F6670]">Timezone</span>
              <span className="font-semibold text-[#1C1F23]">Asia/Colombo</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#5F6670]">Rooms Capacity</span>
              <span className="font-semibold text-[#1C1F23]">3 Simultaneous Classes Max</span>
            </div>
          </div>
        </Card>

        {/* Sign Out Card */}
        <Card>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2 text-[#5F6670]" strokeWidth={1.75} />
            Sign Out of Owner Account
          </Button>
        </Card>
      </div>
    </OwnerShell>
  );
}
