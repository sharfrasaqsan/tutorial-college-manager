"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ArrowLeft, AlertCircle, CheckCircle2, CalendarPlus } from "lucide-react";
import type { AcademicYear } from "@/types";

export default function StartNextYearPage() {
  const router = useRouter();

  const [currentYear, setCurrentYear] = useState<string>("2026");
  const [nextYear, setNextYear] = useState<string>("2027");
  const [alreadyPromoted, setAlreadyPromoted] = useState(false);
  const [alreadyPromotedTo, setAlreadyPromotedTo] = useState("");

  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    promotedCount: number;
    finishedCount: number;
    totalProcessed: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadYearData() {
      try {
        const res = await fetch("/api/owner/years");
        if (res.ok) {
          const data = await res.json();
          const selected = data.selectedYear || (data.years?.[0]?.id) || "2026";
          setCurrentYear(selected);
          const computedNext = String(parseInt(selected, 10) + 1);
          setNextYear(computedNext);

          // Check if currentYear was already promoted
          const yearDoc = data.years?.find((y: AcademicYear) => y.id === selected);
          if (yearDoc?.promotedToYear) {
            setAlreadyPromoted(true);
            setAlreadyPromotedTo(yearDoc.promotedToYear);
          }
        }
      } catch (err) {
        console.error("Failed to load year details:", err);
      } finally {
        setLoading(false);
      }
    }
    loadYearData();
  }, []);

  async function handleExecutePromotion() {
    setRunning(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/owner/years/start-next-year", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromYear: currentYear,
          toYear: nextYear,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start next year.");
      }

      setResult({
        promotedCount: data.promotedCount,
        finishedCount: data.finishedCount,
        totalProcessed: data.totalProcessed,
      });
      setAlreadyPromoted(true);
      setAlreadyPromotedTo(nextYear);
      setConfirmOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to execute academic year promotion.");
      setConfirmOpen(false);
    } finally {
      setRunning(false);
    }
  }

  return (
    <OwnerShell pageTitle="Start Next Year">
      <PageContainer variant="narrow">
        <div className="mb-2">
        <Link
          href="/owner/more"
          className="inline-flex items-center text-xs font-medium text-[#1F5C4D] hover:underline min-h-[36px]"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} />
          Back to More
        </Link>
      </div>

      <PageHeader
        title="Start Next Academic Year"
        subtitle={`Advance college records from ${currentYear} to ${nextYear}`}
      />

      {errorMessage && (
        <div className="mb-4">
          <Toast message={errorMessage} variant="danger" onDismiss={() => setErrorMessage("")} />
        </div>
      )}

      {alreadyPromoted ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[#1F5C4D]">
            <CheckCircle2 className="w-5 h-5 shrink-0" strokeWidth={1.75} />
            <CardTitle>Academic Year Already Promoted</CardTitle>
          </div>
          <p className="text-xs text-[#5F6670] leading-relaxed">
            The next academic year ({alreadyPromotedTo}) has already been started from {currentYear}. By rule, promotion cannot be run twice for the same academic year.
          </p>
          <div className="mt-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => router.push("/owner")}
            >
              Return to Owner Home
            </Button>
          </div>
        </Card>
      ) : result ? (
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-[#1F5C4D]">
            <CheckCircle2 className="w-5 h-5 shrink-0" strokeWidth={2} />
            <CardTitle>Academic Year {nextYear} Successfully Started!</CardTitle>
          </div>

          <div className="flex flex-col gap-2.5 text-xs divide-y divide-[#E4E1DA]">
            <div className="flex justify-between py-1.5">
              <span className="text-[#5F6670]">Promoted Students</span>
              <span className="font-semibold text-[#1C1F23] tabular-nums">
                {result.promotedCount} students (advanced +1 grade)
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#5F6670]">Graduated Students</span>
              <span className="font-semibold text-[#1C1F23] tabular-nums">
                {result.finishedCount} Grade 13 students (Finished list)
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#5F6670]">Active Year Set To</span>
              <span className="font-semibold text-[#1F5C4D] tabular-nums">
                Year {nextYear}
              </span>
            </div>
          </div>

          <Button
            variant="primary"
            fullWidth
            onClick={() => router.push("/owner")}
          >
            Go to Year {nextYear} Home
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Rules Confirmation Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-[#1F5C4D]" strokeWidth={1.75} />
                <CardTitle>Promotion Transition Rules</CardTitle>
              </div>
              <p className="text-xs text-[#5F6670] mt-1">
                Creating Year {nextYear} from Year {currentYear} executes the following:
              </p>
            </CardHeader>

            <ul className="flex flex-col gap-2 text-xs text-[#1C1F23] list-disc list-inside leading-relaxed">
              <li>
                <strong>Student Grades:</strong> Each active student grade is advanced by exactly 1 level (e.g. Grade 10 becomes Grade 11).
              </li>
              <li>
                <strong>Grade 13 Students:</strong> Moved to the <em>Finished list</em> in Year {nextYear} for owner review.
              </li>
              <li>
                <strong>Faculty:</strong> Teachers are permanent records and carry over automatically.
              </li>
              <li>
                <strong>Uncopied Data:</strong> Classes, timetable slots, and fee enrolments are <strong>NOT copied</strong>. New classes and slots start fresh for {nextYear}.
              </li>
              <li>
                <strong>Permanent Joined Date:</strong> Student <code>joinedAt</code> is permanent and never modified.
              </li>
              <li>
                <strong>Single Run:</strong> This promotion action <strong>cannot be run twice</strong> for {currentYear}.
              </li>
            </ul>
          </Card>

          <Button
            type="button"
            variant="primary"
            fullWidth
            loading={loading || running}
            disabled={loading || running || alreadyPromoted}
            onClick={() => setConfirmOpen(true)}
          >
            Start Academic Year {nextYear}
          </Button>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleExecutePromotion}
        title={`Confirm Starting Year ${nextYear}?`}
        description={`This will promote all active students from Year ${currentYear} to ${nextYear} and graduate Grade 13 students. This action cannot be undone.`}
        confirmLabel={`Start Year ${nextYear}`}
        loading={running}
      />
      </PageContainer>
    </OwnerShell>
  );
}
