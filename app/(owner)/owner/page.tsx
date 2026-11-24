import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  Users,
  GraduationCap,
  BookOpen,
  ChevronRight,
  ArrowUpRight,
  Calendar,
  CreditCard,
  Banknote,
  AlertCircle,
  Clock,
  CheckCircle2,
  Bell,
  ArrowRight,
} from "lucide-react";
import { adminDb } from "@/lib/firebase-admin";

export default async function OwnerHomePage() {
  const cookieStore = await cookies();
  const selectedYear = cookieStore.get("tcm_year")?.value || "2026";

  // Fetch live counts for summary tiles
  let studentCount = 0;
  let classCount = 0;
  let teacherCount = 0;
  let pendingRequestCount = 0;
  let todaySessions: any[] = [];

  try {
    const [studentsSnap, classesSnap, teachersSnap, requestsSnap] = await Promise.all([
      adminDb.collection("students").where("active", "==", true).get(),
      adminDb.collection("years").doc(selectedYear).collection("classes").where("active", "==", true).get(),
      adminDb.collection("teachers").where("active", "==", true).get(),
      adminDb.collection("requests").where("status", "==", "pending").get(),
    ]);

    studentCount = studentsSnap.size;
    classCount = classesSnap.size;
    teacherCount = teachersSnap.size;
    pendingRequestCount = requestsSnap.size;

    // Get today's timetable slots
    const todayWeekday = new Date().getDay();
    const slotsSnap = await adminDb
      .collection("years")
      .doc(selectedYear)
      .collection("timetableSlots")
      .where("weekday", "==", todayWeekday)
      .get();

    todaySessions = slotsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    todaySessions.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  } catch (err) {
    console.warn("Failed to load dashboard statistics:", err);
  }

  const todayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());

  return (
    <OwnerShell pageTitle="College Dashboard">
      <PageHeader
        title={`Academic Year ${selectedYear}`}
        subtitle="Institution operations, live class schedules & quick management actions"
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/owner/fees"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#1F5C4D] text-[#FFFFFF] hover:bg-[#17473B] text-xs font-medium transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Collect Fees</span>
            </Link>
          </div>
        }
      />

      <div className="space-y-6">
        {/* 1. 4 Summary Tiles in a row on Desktop (2x2 on Mobile/Tablet) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Tile 1: Students */}
          <Link href="/owner/students">
            <Card className="p-4 hover:border-[#1F5C4D] transition-colors cursor-pointer group h-full flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-semibold text-[#5F6670] uppercase tracking-wider">
                  Students
                </span>
                <div className="w-8 h-8 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-4 h-4" strokeWidth={1.75} />
                </div>
              </div>
              <div className="mt-3">
                <div className="font-serif text-2xl sm:text-3xl font-bold text-[#1C1F23] tabular-nums">
                  {studentCount}
                </div>
                <div className="text-[11px] text-[#5F6670] mt-0.5 flex items-center justify-between">
                  <span>Enrolled &amp; Active</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#1F5C4D]" />
                </div>
              </div>
            </Card>
          </Link>

          {/* Tile 2: Classes */}
          <Link href="/owner/classes">
            <Card className="p-4 hover:border-[#1F5C4D] transition-colors cursor-pointer group h-full flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-semibold text-[#5F6670] uppercase tracking-wider">
                  Classes
                </span>
                <div className="w-8 h-8 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <BookOpen className="w-4 h-4" strokeWidth={1.75} />
                </div>
              </div>
              <div className="mt-3">
                <div className="font-serif text-2xl sm:text-3xl font-bold text-[#1C1F23] tabular-nums">
                  {classCount}
                </div>
                <div className="text-[11px] text-[#5F6670] mt-0.5 flex items-center justify-between">
                  <span>Grade + Subject Units</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#1F5C4D]" />
                </div>
              </div>
            </Card>
          </Link>

          {/* Tile 3: Teaching Faculty */}
          <Link href="/owner/teachers">
            <Card className="p-4 hover:border-[#1F5C4D] transition-colors cursor-pointer group h-full flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-semibold text-[#5F6670] uppercase tracking-wider">
                  Teachers
                </span>
                <div className="w-8 h-8 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" strokeWidth={1.75} />
                </div>
              </div>
              <div className="mt-3">
                <div className="font-serif text-2xl sm:text-3xl font-bold text-[#1C1F23] tabular-nums">
                  {teacherCount}
                </div>
                <div className="text-[11px] text-[#5F6670] mt-0.5 flex items-center justify-between">
                  <span>Active Instructors</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#1F5C4D]" />
                </div>
              </div>
            </Card>
          </Link>

          {/* Tile 4: Pending Actions */}
          <Link href="/owner/requests">
            <Card className="p-4 hover:border-[#1F5C4D] transition-colors cursor-pointer group h-full flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-semibold text-[#5F6670] uppercase tracking-wider">
                  Attention
                </span>
                <div className="w-8 h-8 rounded-[6px] bg-[#FBF1DE] text-[#9A5B00] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <AlertCircle className="w-4 h-4" strokeWidth={1.75} />
                </div>
              </div>
              <div className="mt-3">
                <div className="font-serif text-2xl sm:text-3xl font-bold text-[#1C1F23] tabular-nums">
                  {pendingRequestCount}
                </div>
                <div className="text-[11px] text-[#5F6670] mt-0.5 flex items-center justify-between">
                  <span>Correction Requests</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#1F5C4D]" />
                </div>
              </div>
            </Card>
          </Link>
        </div>

        {/* 2. Side-by-side on Desktop: Today's Classes & Needs Attention */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols): Today's Scheduled Classes */}
          <div className="lg:col-span-7 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-[#E4E1DA]">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#1F5C4D]" />
                    <CardTitle>Today&apos;s Classes ({todayName})</CardTitle>
                  </div>
                  <p className="text-xs text-[#5F6670] mt-0.5">
                    Weekly recurring timetable slots scheduled for today
                  </p>
                </div>
                <Link
                  href="/owner/timetable"
                  className="text-xs font-medium text-[#1F5C4D] hover:underline inline-flex items-center gap-1"
                >
                  <span>Full Timetable</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </CardHeader>

              {todaySessions.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#5F6670]">
                  <Calendar className="w-8 h-8 text-[#5F6670]/50 mx-auto mb-2" />
                  <p className="font-medium text-[#1C1F23]">No regular classes scheduled for {todayName}</p>
                  <p className="mt-0.5">Check the full weekly timetable to view slots on other weekdays.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E4E1DA] text-xs">
                  {todaySessions.map((session) => (
                    <div
                      key={session.id}
                      className="py-3 flex items-center justify-between hover:bg-[#FAF9F6]/80 transition-colors px-1"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] font-semibold text-[#1F5C4D] bg-[#E6F0EC] px-2 py-1 rounded">
                          {session.startTime} - {session.endTime}
                        </span>
                        <div>
                          <div className="font-semibold text-[#1C1F23]">
                            {session.subject || session.className || "Class"}
                          </div>
                          <div className="text-[11px] text-[#5F6670]">
                            {session.grade} &bull; Teacher: {session.teacherName || "Assigned"}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-[#5F6670] bg-[#FAF9F6] border border-[#E4E1DA] px-2 py-0.5 rounded">
                        Weekly Slot
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Quick Financial Summary Card */}
            <Card className="p-4 bg-gradient-to-r from-[#FFFFFF] to-[#FAF9F6]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#1C1F23] flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-[#1F5C4D]" />
                    <span>Monthly Financial Reports &amp; Statements</span>
                  </h3>
                  <p className="text-xs text-[#5F6670] mt-0.5">
                    Track collected student fees, pending balances, and verified teacher payroll.
                  </p>
                </div>
                <Link
                  href="/owner/reports"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-[6px] border border-[#E4E1DA] bg-[#FFFFFF] hover:bg-[#FAF9F6] text-xs font-medium text-[#1C1F23] shrink-0"
                >
                  <span>Open Reports</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#1F5C4D]" />
                </Link>
              </div>
            </Card>
          </div>

          {/* Right Column (5 cols): Needs Attention & Fast Operations */}
          <div className="lg:col-span-5 space-y-4">
            {/* Needs Attention Card */}
            <Card>
              <CardHeader className="pb-3 border-b border-[#E4E1DA]">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#9A5B00]" />
                  <CardTitle>Needs Attention</CardTitle>
                </div>
                <p className="text-xs text-[#5F6670] mt-0.5">
                  Items requiring owner review or immediate action
                </p>
              </CardHeader>

              <div className="divide-y divide-[#E4E1DA] text-xs">
                {pendingRequestCount > 0 ? (
                  <Link
                    href="/owner/requests"
                    className="py-3 flex items-center justify-between hover:bg-[#FAF9F6] transition-colors px-1"
                  >
                    <div>
                      <div className="font-semibold text-[#1C1F23]">
                        {pendingRequestCount} Session Correction {pendingRequestCount === 1 ? "Request" : "Requests"}
                      </div>
                      <div className="text-[11px] text-[#9A5B00]">
                        Teachers requesting status changes for locked sessions
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#5F6670]" />
                  </Link>
                ) : (
                  <div className="py-3 flex items-center gap-2 text-[#1F5C4D] px-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>All correction requests resolved</span>
                  </div>
                )}

                <Link
                  href="/owner/fees"
                  className="py-3 flex items-center justify-between hover:bg-[#FAF9F6] transition-colors px-1"
                >
                  <div>
                    <div className="font-semibold text-[#1C1F23]">Unpaid Student Tuition Fees</div>
                    <div className="text-[11px] text-[#5F6670]">Review and record pending student fee settlements</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#5F6670]" />
                </Link>

                <Link
                  href="/owner/salary"
                  className="py-3 flex items-center justify-between hover:bg-[#FAF9F6] transition-colors px-1"
                >
                  <div>
                    <div className="font-semibold text-[#1C1F23]">Monthly Teacher Payroll</div>
                    <div className="text-[11px] text-[#5F6670]">Review ready classes and issue consolidated invoices</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#5F6670]" />
                </Link>
              </div>
            </Card>

            {/* Quick Setup & Profile Navigation */}
            <Card>
              <CardHeader className="pb-3 border-b border-[#E4E1DA]">
                <CardTitle className="text-xs uppercase tracking-wider text-[#5F6670]">
                  System Quick Links
                </CardTitle>
              </CardHeader>
              <div className="divide-y divide-[#E4E1DA] text-xs">
                <Link
                  href="/owner/more/public-site"
                  className="py-2.5 flex items-center justify-between hover:text-[#1F5C4D] transition-colors"
                >
                  <span>Public Site Editor &amp; Teacher Visibility</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#5F6670]" />
                </Link>
                <Link
                  href="/owner/more/academic"
                  className="py-2.5 flex items-center justify-between hover:text-[#1F5C4D] transition-colors"
                >
                  <span>Academic Curriculum (Grades 1-13 &amp; Subjects)</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#5F6670]" />
                </Link>
                <Link
                  href="/owner/more/college"
                  className="py-2.5 flex items-center justify-between hover:text-[#1F5C4D] transition-colors"
                >
                  <span>College Name, Address &amp; Opening Hours</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#5F6670]" />
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </OwnerShell>
  );
}
