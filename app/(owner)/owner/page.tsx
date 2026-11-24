import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageContainer } from "@/components/layout/PageContainer";
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
  FileSpreadsheet,
  Inbox,
  Clock,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
} from "lucide-react";
import { adminDb } from "@/lib/firebase-admin";
import { getColomboNow, WEEKDAY_NAMES } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function OwnerHomePage() {
  const cookieStore = await cookies();
  const selectedYear = cookieStore.get("tcm_year")?.value || "2026";

  let studentCount = 0;
  let teacherCount = 0;
  let classCount = 0;
  let pendingRequestCount = 0;
  let todayClasses: Array<{
    id: string;
    subject: string;
    grade: string;
    teacherName: string;
    startTime: string;
    endTime: string;
  }> = [];

  const now = getColomboNow();
  const currentWeekday = now.getDay();
  const todayName = WEEKDAY_NAMES[currentWeekday] || "Today";

  try {
    const [studentsSnap, teachersSnap, classesSnap, requestsSnap, slotsSnap] =
      await Promise.all([
        adminDb.collection("students").where("active", "==", true).count().get(),
        adminDb.collection("teachers").where("active", "==", true).count().get(),
        adminDb
          .collection("years")
          .doc(selectedYear)
          .collection("classes")
          .where("active", "==", true)
          .count()
          .get(),
        adminDb
          .collection("correctionRequests")
          .where("status", "==", "pending")
          .count()
          .get(),
        adminDb
          .collection("years")
          .doc(selectedYear)
          .collection("timetableSlots")
          .where("weekday", "==", currentWeekday)
          .get(),
      ]);

    studentCount = studentsSnap.data().count;
    teacherCount = teachersSnap.data().count;
    classCount = classesSnap.data().count;
    pendingRequestCount = requestsSnap.data().count;

    todayClasses = slotsSnap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          subject: d.subject || d.className || "Class",
          grade: d.grade || "",
          teacherName: d.teacherName || "Teacher",
          startTime: d.startTime || "08:00",
          endTime: d.endTime || "10:00",
        };
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  } catch (err) {
    console.warn("Could not load full owner dashboard counts:", err);
  }

  return (
    <OwnerShell pageTitle={`College Overview (${selectedYear})`}>
      <PageContainer variant="default">
        <PageHeader
          title={`Academic Year ${selectedYear} Overview`}
          subtitle="Real-time institutional dashboard, today's schedule & core management consoles"
          action={
            <div className="flex items-center gap-2">
              <Link
                href="/owner/classes"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#1F5C4D] hover:bg-[#17473B] text-xs font-semibold text-[#FFFFFF] transition-colors shadow-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Manage Classes</span>
              </Link>
            </div>
          }
        />

        <div className="flex flex-col gap-6">
          {/* ============================================================ */}
          {/* 1. 4 SUMMARY TILES IN A ROW (Grid 1 -> 2 -> 4)               */}
          {/* ============================================================ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tile 1: Students */}
            <Link href="/owner/students">
              <Card className="p-4 hover:border-[#1F5C4D] transition-all cursor-pointer group shadow-xs">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center">
                    <GraduationCap className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#5F6670] group-hover:text-[#1F5C4D] transition-colors" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold font-serif text-[#1C1F23] tabular-nums">
                    {studentCount}
                  </div>
                  <div className="text-xs font-medium text-[#1C1F23]">Enrolled Students</div>
                  <div className="text-[11px] text-[#5F6670] mt-0.5">Directory &amp; admission fees</div>
                </div>
              </Card>
            </Link>

            {/* Tile 2: Teachers */}
            <Link href="/owner/teachers">
              <Card className="p-4 hover:border-[#1F5C4D] transition-all cursor-pointer group shadow-xs">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center">
                    <Users className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#5F6670] group-hover:text-[#1F5C4D] transition-colors" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold font-serif text-[#1C1F23] tabular-nums">
                    {teacherCount}
                  </div>
                  <div className="text-xs font-medium text-[#1C1F23]">Teaching Faculty</div>
                  <div className="text-[11px] text-[#5F6670] mt-0.5">Logins &amp; subject assignments</div>
                </div>
              </Card>
            </Link>

            {/* Tile 3: Classes */}
            <Link href="/owner/classes">
              <Card className="p-4 hover:border-[#1F5C4D] transition-all cursor-pointer group shadow-xs">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center">
                    <BookOpen className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#5F6670] group-hover:text-[#1F5C4D] transition-colors" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold font-serif text-[#1C1F23] tabular-nums">
                    {classCount}
                  </div>
                  <div className="text-xs font-medium text-[#1C1F23]">Active Classes</div>
                  <div className="text-[11px] text-[#5F6670] mt-0.5">Grade + subject combinations</div>
                </div>
              </Card>
            </Link>

            {/* Tile 4: Fees & Collections */}
            <Link href="/owner/fees">
              <Card className="p-4 hover:border-[#1F5C4D] transition-all cursor-pointer group shadow-xs">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-[6px] bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center">
                    <CreditCard className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#5F6670] group-hover:text-[#1F5C4D] transition-colors" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold font-serif text-[#1C1F23]">
                    Fees
                  </div>
                  <div className="text-xs font-medium text-[#1C1F23]">Fee Collections</div>
                  <div className="text-[11px] text-[#5F6670] mt-0.5">Payment recording &amp; arrears</div>
                </div>
              </Card>
            </Link>
          </div>

          {/* ============================================================ */}
          {/* 2. TODAY'S CLASSES & NEEDS ATTENTION SIDE-BY-SIDE (lg:grid)  */}
          {/* ============================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Today's Classes */}
            <Card className="p-5 shadow-xs flex flex-col justify-between">
              <div>
                <CardHeader className="p-0 pb-3 border-b border-[#E4E1DA] flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-[#1F5C4D]" />
                    <CardTitle>Today&apos;s Classes ({todayName})</CardTitle>
                  </div>
                  <Link
                    href="/owner/timetable"
                    className="text-xs text-[#1F5C4D] hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <span>Full Timetable</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </CardHeader>

                {todayClasses.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#5F6670]">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-[#5F6670]/60" />
                    <p className="font-medium text-[#1C1F23]">No classes scheduled for {todayName}</p>
                    <p className="mt-0.5">Check the weekly timetable for other weekday slots.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E4E1DA] mt-1 text-xs">
                    {todayClasses.slice(0, 5).map((cls) => (
                      <div key={cls.id} className="py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[11px] font-semibold text-[#1F5C4D] bg-[#E6F0EC] px-2 py-1 rounded-[4px]">
                            {cls.startTime} - {cls.endTime}
                          </span>
                          <div>
                            <span className="font-medium text-[#1C1F23]">{cls.subject}</span>
                            <span className="text-[#5F6670] text-[11px] block">
                              {cls.grade} &bull; {cls.teacherName}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {todayClasses.length > 5 && (
                <div className="pt-3 border-t border-[#E4E1DA] text-center">
                  <Link
                    href="/owner/timetable"
                    className="text-xs text-[#1F5C4D] hover:underline font-medium"
                  >
                    View all {todayClasses.length} classes scheduled today &rarr;
                  </Link>
                </div>
              )}
            </Card>

            {/* Right Column: Needs Attention & Quick Tools */}
            <Card className="p-5 shadow-xs flex flex-col justify-between">
              <div>
                <CardHeader className="p-0 pb-3 border-b border-[#E4E1DA] flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-[#1F5C4D]" />
                    <CardTitle>Needs Attention &amp; Operations</CardTitle>
                  </div>
                  {pendingRequestCount > 0 && (
                    <span className="text-[10px] font-bold bg-[#A32A2A] text-[#FFFFFF] px-2 py-0.5 rounded-full">
                      {pendingRequestCount} Pending
                    </span>
                  )}
                </CardHeader>

                <div className="divide-y divide-[#E4E1DA] mt-1 text-xs">
                  {/* Correction Requests */}
                  <Link
                    href="/owner/requests"
                    className="py-3 flex items-center justify-between hover:text-[#1F5C4D] transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Inbox className="w-4 h-4 text-[#1F5C4D] shrink-0" />
                      <div>
                        <span className="font-semibold text-[#1C1F23] block group-hover:text-[#1F5C4D]">
                          Session Correction Requests
                        </span>
                        <span className="text-[#5F6670] block text-[11px]">
                          {pendingRequestCount > 0
                            ? `${pendingRequestCount} teacher requests awaiting owner resolution`
                            : "No pending session corrections"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#5F6670] group-hover:text-[#1F5C4D]" />
                  </Link>

                  {/* Teacher Salaries */}
                  <Link
                    href="/owner/salary"
                    className="py-3 flex items-center justify-between hover:text-[#1F5C4D] transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Banknote className="w-4 h-4 text-[#1F5C4D] shrink-0" />
                      <div>
                        <span className="font-semibold text-[#1C1F23] block group-hover:text-[#1F5C4D]">
                          Teacher Salaries &amp; Invoices
                        </span>
                        <span className="text-[#5F6670] block text-[11px]">
                          Review session thresholds and execute consolidated payouts
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#5F6670] group-hover:text-[#1F5C4D]" />
                  </Link>

                  {/* Monthly Reports */}
                  <Link
                    href="/owner/reports"
                    className="py-3 flex items-center justify-between hover:text-[#1F5C4D] transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet className="w-4 h-4 text-[#1F5C4D] shrink-0" />
                      <div>
                        <span className="font-semibold text-[#1C1F23] block group-hover:text-[#1F5C4D]">
                          Reports &amp; Financial Statements
                        </span>
                        <span className="text-[#5F6670] block text-[11px]">
                          Student receipts, arrears &amp; monthly revenue summaries
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#5F6670] group-hover:text-[#1F5C4D]" />
                  </Link>
                </div>
              </div>

              {/* Bottom Quick Status */}
              <div className="pt-3 border-t border-[#E4E1DA] flex items-center justify-between text-[11px] text-[#5F6670]">
                <span>Timezone: Asia/Colombo</span>
                <span>Currency: LKR</span>
              </div>
            </Card>
          </div>
        </div>
      </PageContainer>
    </OwnerShell>
  );
}
