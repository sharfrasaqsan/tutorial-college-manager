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
  Globe,
} from "lucide-react";

const adminSections = [
  {
    title: "Teachers & Faculty",
    subtitle: "Register teachers, manage logins & subject assignments",
    href: "/owner/teachers",
    icon: Users,
    category: "Academic Staff",
  },
  {
    title: "Student Directory",
    subtitle: "Permanent student records, grade rosters & admission fees",
    href: "/owner/students",
    icon: GraduationCap,
    category: "Admissions",
  },
  {
    title: "Reports & Financials",
    subtitle: "Student payments, pending fees, teacher salary & monthly summary",
    href: "/owner/reports",
    icon: FileSpreadsheet,
    category: "Accounting",
  },
  {
    title: "Correction Requests",
    subtitle: "Review and resolve teacher requests for locked sessions",
    href: "/owner/requests",
    icon: Inbox,
    category: "Attendance",
  },
  {
    title: "College Profile",
    subtitle: "Name, logo, address, phone, email & operational hours",
    href: "/owner/more/college",
    icon: Building2,
    category: "Institution",
  },
  {
    title: "Public Site Editor",
    subtitle: "Hero promise, key facts, WhatsApp, visibility & teachers",
    href: "/owner/more/public-site",
    icon: Globe,
    category: "Website",
  },
  {
    title: "Grades & Subjects",
    subtitle: "Manage grade levels (1-13) and curriculum subjects",
    href: "/owner/more/academic",
    icon: BookOpen,
    category: "Curriculum",
  },
  {
    title: "Start Next Year",
    subtitle: "Advance student grades and archive finished batches",
    href: "/owner/more/next-year",
    icon: CalendarPlus,
    category: "Academic Cycle",
  },
];

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
    <OwnerShell pageTitle="Settings & Tools" maxWidth="wide">
      <PageHeader
        title="College Administration"
        subtitle="Institution profile, academic structure & year management"
      />

      <div className="space-y-6 pb-12">
        {/* 2 to 3 column card grid on tablet and desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminSections.map((sec) => (
            <Link key={sec.href} href={sec.href} className="group block">
              <Card className="p-4 h-full flex flex-col justify-between border border-[#E4E1DA] hover:border-[#1F5C4D] hover:bg-[#FAF9F6]/60 transition-all">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center group-hover:scale-105 transition-transform">
                      <sec.icon className="w-4 h-4" strokeWidth={1.75} />
                    </div>
                    <span className="text-[10px] font-semibold text-[#5F6670] uppercase tracking-wider bg-[#F0EFEB] px-2 py-0.5 rounded">
                      {sec.category}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm text-[#1C1F23] group-hover:text-[#1F5C4D] transition-colors">
                    {sec.title}
                  </h3>
                  <p className="text-xs text-[#5F6670] mt-1 line-clamp-2 leading-relaxed">
                    {sec.subtitle}
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-[#E4E1DA]/60 flex items-center justify-between text-xs font-medium text-[#1F5C4D]">
                  <span>Configure</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Card>
            </Link>
          ))}

          {/* Institutional System Defaults Tile */}
          <Card className="p-4 flex flex-col justify-between border border-[#E4E1DA] bg-white">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <span className="text-[10px] font-semibold text-[#5F6670] uppercase tracking-wider bg-[#F0EFEB] px-2 py-0.5 rounded">
                  System
                </span>
              </div>
              <h3 className="font-semibold text-sm text-[#1C1F23]">Institution Defaults</h3>
              <div className="mt-2.5 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#E4E1DA]">
                  <span className="text-[#5F6670]">Currency</span>
                  <span className="font-semibold text-[#1C1F23]">LKR (Rupee)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E4E1DA]">
                  <span className="text-[#5F6670]">Timezone</span>
                  <span className="font-semibold text-[#1C1F23]">Asia/Colombo</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#5F6670]">Rooms Capacity</span>
                  <span className="font-semibold text-[#1C1F23]">3 Classes Max</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-2 border-t border-[#E4E1DA]/60 text-[11px] text-[#5F6670]">
              Institutional single-college settings
            </div>
          </Card>
        </div>

        {/* Sign Out Card */}
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleSignOut}
            className="w-full sm:w-auto text-xs px-5 h-9"
          >
            <LogOut className="w-4 h-4 mr-2 text-[#5F6670]" strokeWidth={1.75} />
            <span>Sign Out of Owner Account</span>
          </Button>
        </div>
      </div>
    </OwnerShell>
  );
}
