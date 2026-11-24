"use client";

import React, { useState, useEffect, useCallback } from "react";
import { TeacherShell } from "@/components/layout/TeacherShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import {
  CalendarDays,
  Clock,
  Check,
  X,
  AlertTriangle,
  Plus,
  FileQuestion,
  Calendar,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  formatDateDisplay,
  formatTimeDisplay,
  formatMonthDisplay,
  getCurrentMonthKey,
  getColomboNow,
} from "@/lib/dates";
import { format, subMonths } from "date-fns";
import type { Session } from "@/types";

interface SessionWithMarking extends Session {
  markingDetails?: {
    isOpen: boolean;
    isPastWindow: boolean;
    isBeforeWindow: boolean;
    daysLeft: number;
    deadlineDisplay: string;
    statusLabel: string;
  };
}

export default function TeacherTodayPage() {
  const [loading, setLoading] = useState(true);
  const [unmarkedUrgent, setUnmarkedUrgent] = useState<SessionWithMarking[]>([]);
  const [todaySessions, setTodaySessions] = useState<SessionWithMarking[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<SessionWithMarking[]>([]);
  const [todayDateStr, setTodayDateStr] = useState("");
  const [teacherName, setTeacherName] = useState("Teacher");
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    variant: "success" | "danger" | "warning";
  } | null>(null);

  // Mark session state
  const [markingSessionId, setMarkingSessionId] = useState<string | null>(null);

  // Make-up Class Sheet
  const [makeupSheetOpen, setMakeupSheetOpen] = useState(false);
  const [teacherClasses, setTeacherClasses] = useState<{ id: string; name: string }[]>([]);
  const [makeupClassId, setMakeupClassId] = useState("");
  const [makeupDate, setMakeupDate] = useState("");
  const [makeupStartTime, setMakeupStartTime] = useState("10:00");
  const [makeupEndTime, setMakeupEndTime] = useState("12:00");
  const [makeupCountsMonth, setMakeupCountsMonth] = useState("");
  const [makeupSubmitting, setMakeupSubmitting] = useState(false);
  const [makeupError, setMakeupError] = useState("");

  // Correction Request Sheet
  const [correctionSheetOpen, setCorrectionSheetOpen] = useState(false);
  const [correctionSession, setCorrectionSession] = useState<SessionWithMarking | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<"held" | "missed">("held");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [correctionError, setCorrectionError] = useState("");

  // Load Dashboard Data
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/teacher/today");
      if (!res.ok) throw new Error("Failed to load sessions.");
      const data = await res.json();
      setUnmarkedUrgent(data.unmarkedUrgent || []);
      setTodaySessions(data.todaySessions || []);
      setUpcomingSessions(data.upcomingSessions || []);
      setTodayDateStr(data.today || "");
      if (data.teacherName) setTeacherName(data.teacherName);
    } catch (err: any) {
      setToastMessage({ text: err.message, variant: "danger" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Load teacher classes for make-up picker
  async function loadTeacherClasses() {
    try {
      const res = await fetch("/api/teacher/classes");
      if (res.ok) {
        const data = await res.json();
        setTeacherClasses(data.classes || []);
        if (data.classes?.length > 0 && !makeupClassId) {
          setMakeupClassId(data.classes[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load teacher classes:", err);
    }
  }

  // Handle Mark Session
  async function handleMarkSession(sessionId: string, status: "held" | "missed") {
    try {
      setMarkingSessionId(sessionId);
      const res = await fetch(`/api/teacher/sessions/${sessionId}/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to mark session.");

      setToastMessage({
        text: `Session marked as ${status}.`,
        variant: "success",
      });

      await loadDashboard();
    } catch (err: any) {
      setToastMessage({ text: err.message, variant: "danger" });
    } finally {
      setMarkingSessionId(null);
    }
  }

  // Open Make-up modal
  function handleOpenMakeupModal() {
    loadTeacherClasses();
    const now = getColomboNow();
    const curMonth = format(now, "yyyy-MM");
    setMakeupDate(format(now, "yyyy-MM-dd"));
    setMakeupStartTime("14:00");
    setMakeupEndTime("16:00");
    setMakeupCountsMonth(curMonth);
    setMakeupError("");
    setMakeupSheetOpen(true);
  }

  // Submit Make-up
  async function handleSubmitMakeup(e: React.FormEvent) {
    e.preventDefault();
    setMakeupError("");

    if (!makeupClassId) {
      setMakeupError("Please select a class.");
      return;
    }
    if (makeupStartTime >= makeupEndTime) {
      setMakeupError("End time must be after start time.");
      return;
    }

    try {
      setMakeupSubmitting(true);
      const res = await fetch("/api/teacher/sessions/makeup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: makeupClassId,
          date: makeupDate,
          startTime: makeupStartTime,
          endTime: makeupEndTime,
          countsForMonth: makeupCountsMonth,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule make-up.");

      setToastMessage({
        text: "Make-up class scheduled successfully.",
        variant: "success",
      });
      setMakeupSheetOpen(false);
      await loadDashboard();
    } catch (err: any) {
      setMakeupError(err.message || "Failed to schedule make-up.");
    } finally {
      setMakeupSubmitting(false);
    }
  }

  // Open Correction Request Modal
  function handleOpenCorrection(session: SessionWithMarking) {
    setCorrectionSession(session);
    setCorrectionStatus(session.status === "held" ? "missed" : "held");
    setCorrectionReason("");
    setCorrectionError("");
    setCorrectionSheetOpen(true);
  }

  // Submit Correction Request
  async function handleSubmitCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!correctionSession) return;
    setCorrectionError("");

    if (correctionReason.trim().length < 5) {
      setCorrectionError("Please provide a reason of at least 5 characters.");
      return;
    }

    try {
      setCorrectionSubmitting(true);
      const res = await fetch(
        `/api/teacher/sessions/${correctionSession.id}/correction-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestedStatus: correctionStatus,
            reason: correctionReason,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request.");

      setToastMessage({
        text: "Correction request submitted to the college owner for approval.",
        variant: "success",
      });
      setCorrectionSheetOpen(false);
      setCorrectionSession(null);
    } catch (err: any) {
      setCorrectionError(err.message || "Failed to submit correction request.");
    } finally {
      setCorrectionSubmitting(false);
    }
  }

  // Calculate available month options for make-up
  const makeupMonthOptions = React.useMemo(() => {
    const now = getColomboNow();
    const curMonth = format(now, "yyyy-MM");
    const prevMonth = format(subMonths(now, 1), "yyyy-MM");
    const canCountPrev = now.getDate() <= 5;

    const list: { key: string; label: string }[] = [
      { key: curMonth, label: `${formatMonthDisplay(curMonth)} (Current Month)` },
    ];

    if (canCountPrev) {
      list.unshift({
        key: prevMonth,
        label: `${formatMonthDisplay(prevMonth)} (Previous Month - Eligible until 5th)`,
      });
    }

    return list;
  }, []);

  return (
    <TeacherShell pageTitle="Today's Sessions">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="mb-4">
          <Toast
            message={toastMessage.text}
            variant={toastMessage.variant}
            onDismiss={() => setToastMessage(null)}
          />
        </div>
      )}

      {/* Header with Make-up CTA */}
      <PageHeader
        title="Today's Schedule"
        subtitle={`Welcome, ${teacherName}. Mark attendance for held and missed sessions.`}
        action={
          <Button
            variant="primary"
            onClick={handleOpenMakeupModal}
            className="gap-1.5 text-xs h-9 shadow-none"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            <span>Schedule Make-up</span>
          </Button>
        }
      />

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* SECTION 1: UNMARKED URGENT SESSIONS FROM LAST 3 DAYS (APPEARS FIRST) */}
          {unmarkedUrgent.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#9A5B00] uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-[#9A5B00]" strokeWidth={2} />
                  <span>Unmarked Sessions (Action Required)</span>
                </div>
                <span className="text-[11px] font-semibold text-[#9A5B00] bg-[#FBF1DE] px-2 py-0.5 rounded">
                  {unmarkedUrgent.length} pending
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {unmarkedUrgent.map((session) => (
                  <SessionMarkCard
                    key={session.id}
                    session={session}
                    isUrgent
                    isMarking={markingSessionId === session.id}
                    onMarkHeld={() => handleMarkSession(session.id, "held")}
                    onMarkMissed={() => handleMarkSession(session.id, "missed")}
                    onRequestCorrection={() => handleOpenCorrection(session)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: TODAY'S SESSIONS */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold text-[#5F6670] uppercase tracking-wider">
                Today ({todayDateStr ? formatDateDisplay(todayDateStr) : "Today"})
              </span>
              <span className="text-[11px] text-[#5F6670]">
                {todaySessions.length} classes scheduled
              </span>
            </div>

            {todaySessions.length === 0 ? (
              <Card className="p-6 text-center text-xs text-[#5F6670] bg-white border border-[#E4E1DA]">
                No classes scheduled for today.
              </Card>
            ) : (
              <div className="flex flex-col gap-2.5">
                {todaySessions.map((session) => (
                  <SessionMarkCard
                    key={session.id}
                    session={session}
                    isMarking={markingSessionId === session.id}
                    onMarkHeld={() => handleMarkSession(session.id, "held")}
                    onMarkMissed={() => handleMarkSession(session.id, "missed")}
                    onRequestCorrection={() => handleOpenCorrection(session)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* SECTION 3: UPCOMING SESSIONS */}
          {upcomingSessions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-semibold text-[#5F6670] uppercase tracking-wider">
                  Upcoming Classes
                </span>
                <span className="text-[11px] text-[#5F6670]">
                  Next {upcomingSessions.length} sessions
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {upcomingSessions.map((session) => (
                  <Card key={session.id} className="p-3 bg-white border border-[#E4E1DA] flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[#1C1F23]">
                          {session.className}
                        </span>
                        {session.type === "makeup" && (
                          <span className="text-[10px] font-semibold text-[#1F5C4D] bg-[#E6F0EC] px-1.5 py-0.2 rounded border border-[#1F5C4D]/20">
                            Make-up
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#5F6670] mt-0.5">
                        <span>{formatDateDisplay(session.date)}</span>
                        <span>•</span>
                        <span className="tabular-nums">
                          {formatTimeDisplay(session.startTime)} - {formatTimeDisplay(session.endTime)}
                        </span>
                      </div>
                    </div>

                    <StatusChip status="neutral" label="Scheduled" />
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Make-up Class BottomSheet Modal */}
      <BottomSheet
        open={makeupSheetOpen}
        onClose={() => setMakeupSheetOpen(false)}
        title="Schedule Make-up Class"
        description="Create a make-up session for one of your classes and choose the month it counts toward."
      >
        <form onSubmit={handleSubmitMakeup} className="flex flex-col gap-3 py-1">
          {makeupError && <Toast message={makeupError} variant="danger" />}

          {/* Class Picker */}
          <Field id="makeup-class" label="Class" required hint="Select your class">
            <Select
              id="makeup-class"
              value={makeupClassId}
              onChange={(e) => setMakeupClassId(e.target.value)}
              disabled={makeupSubmitting}
            >
              {teacherClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          {/* Counts For Month */}
          <Field
            id="makeup-month"
            label="Counts for Month"
            required
            hint="Make-ups count toward previous month only up to the 5th."
          >
            <Select
              id="makeup-month"
              value={makeupCountsMonth}
              onChange={(e) => setMakeupCountsMonth(e.target.value)}
              disabled={makeupSubmitting}
            >
              {makeupMonthOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>

          {/* Date */}
          <Field id="makeup-date" label="Session Date" required>
            <Input
              id="makeup-date"
              type="date"
              value={makeupDate}
              onChange={(e) => setMakeupDate(e.target.value)}
              disabled={makeupSubmitting}
            />
          </Field>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <Field id="makeup-start" label="Start Time (24h)" required>
              <Input
                id="makeup-start"
                type="time"
                value={makeupStartTime}
                onChange={(e) => setMakeupStartTime(e.target.value)}
                disabled={makeupSubmitting}
                className="tabular-nums"
              />
            </Field>

            <Field id="makeup-end" label="End Time (24h)" required>
              <Input
                id="makeup-end"
                type="time"
                value={makeupEndTime}
                onChange={(e) => setMakeupEndTime(e.target.value)}
                disabled={makeupSubmitting}
                className="tabular-nums"
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E4E1DA] mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMakeupSheetOpen(false)}
              disabled={makeupSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={makeupSubmitting}>
              Schedule Make-up
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Correction Request BottomSheet Modal */}
      <BottomSheet
        open={correctionSheetOpen}
        onClose={() => setCorrectionSheetOpen(false)}
        title="Session Correction Request"
        description="The marking window has closed. Submit a request to the college owner with your reason."
      >
        <form onSubmit={handleSubmitCorrection} className="flex flex-col gap-3 py-1">
          {correctionError && <Toast message={correctionError} variant="danger" />}

          {correctionSession && (
            <div className="bg-[#FAF9F6] p-2.5 rounded-[6px] border border-[#E4E1DA] text-xs">
              <span className="font-semibold text-sm text-[#1C1F23] block">
                {correctionSession.className}
              </span>
              <div className="flex items-center gap-2 text-[#5F6670] mt-0.5">
                <span>{formatDateDisplay(correctionSession.date)}</span>
                <span>•</span>
                <span className="tabular-nums">
                  {formatTimeDisplay(correctionSession.startTime)} -{" "}
                  {formatTimeDisplay(correctionSession.endTime)}
                </span>
              </div>
            </div>
          )}

          {/* Desired Status */}
          <Field id="correction-status" label="Requested Mark" required>
            <div className="flex gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs text-[#1C1F23] cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="held"
                  checked={correctionStatus === "held"}
                  onChange={() => setCorrectionStatus("held")}
                  className="accent-[#1F5C4D]"
                />
                <span className="font-semibold text-[#1F5C4D]">Mark as Held</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-[#1C1F23] cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="missed"
                  checked={correctionStatus === "missed"}
                  onChange={() => setCorrectionStatus("missed")}
                  className="accent-[#A32A2A]"
                />
                <span className="font-semibold text-[#A32A2A]">Mark as Missed</span>
              </label>
            </div>
          </Field>

          {/* Reason */}
          <Field
            id="correction-reason"
            label="Reason for Late Marking"
            required
            hint="Explain why the session could not be marked within 3 days"
          >
            <Textarea
              id="correction-reason"
              placeholder="e.g. Completed make-up class; power outage prevented marking attendance."
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              disabled={correctionSubmitting}
              rows={3}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E4E1DA] mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCorrectionSheetOpen(false)}
              disabled={correctionSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={correctionSubmitting}>
              Send Request
            </Button>
          </div>
        </form>
      </BottomSheet>
    </TeacherShell>
  );
}

// Session Mark Card with Mark Held / Mark Missed buttons
function SessionMarkCard({
  session,
  isUrgent = false,
  isMarking = false,
  onMarkHeld,
  onMarkMissed,
  onRequestCorrection,
}: {
  session: SessionWithMarking;
  isUrgent?: boolean;
  isMarking?: boolean;
  onMarkHeld: () => void;
  onMarkMissed: () => void;
  onRequestCorrection: () => void;
}) {
  const details = session.markingDetails;
  const canMark = details?.isOpen && session.status === "scheduled";
  const isLocked = details?.isPastWindow || session.locked;
  const isFuture = details?.isBeforeWindow;

  return (
    <Card
      className={`p-3.5 bg-white border flex flex-col gap-2.5 transition-colors ${
        isUrgent ? "border-[#9A5B00] shadow-sm" : "border-[#E4E1DA]"
      }`}
    >
      {/* Top Banner */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <h4 className="font-semibold text-sm text-[#1C1F23]">{session.className}</h4>
            {session.type === "makeup" && (
              <span className="text-[10px] font-semibold text-[#1F5C4D] bg-[#E6F0EC] px-1.5 py-0.2 rounded border border-[#1F5C4D]/20">
                Make-up
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-[#5F6670] mt-0.5">
            <span>{formatDateDisplay(session.date)}</span>
            <span>•</span>
            <span className="tabular-nums">
              {formatTimeDisplay(session.startTime)} - {formatTimeDisplay(session.endTime)}
            </span>
          </div>
        </div>

        {/* Status / Window Badge */}
        <div>
          {session.status === "held" ? (
            <StatusChip status="success" label="Held" />
          ) : session.status === "missed" ? (
            <StatusChip status="danger" label="Missed" />
          ) : session.status === "notCompleted" ? (
            <StatusChip status="danger" label="Not Completed" />
          ) : isLocked ? (
            <StatusChip status="danger" label="Locked" />
          ) : isUrgent ? (
            <span className="text-[10px] font-bold text-[#9A5B00] bg-[#FBF1DE] px-2 py-0.5 rounded border border-[#9A5B00]/30 animate-pulse">
              {details?.statusLabel || "Expiring soon"}
            </span>
          ) : isFuture ? (
            <StatusChip status="neutral" label="Starts later" />
          ) : (
            <StatusChip status="neutral" label="Scheduled" />
          )}
        </div>
      </div>

      {/* Target Month Indicator */}
      <div className="flex items-center justify-between text-[11px] text-[#5F6670] pt-1 border-t border-[#E4E1DA]">
        <span>Counts toward: <strong>{formatMonthDisplay(session.countsForMonth)}</strong></span>

        {details?.deadlineDisplay && canMark && (
          <span>Window ends: {details.deadlineDisplay}</span>
        )}
      </div>

      {/* Action Buttons */}
      {canMark ? (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            variant="primary"
            onClick={onMarkHeld}
            loading={isMarking}
            disabled={isMarking}
            className="text-xs h-9 gap-1 bg-[#1F5C4D] hover:bg-[#17463A]"
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span>Mark Held</span>
          </Button>

          <Button
            variant="secondary"
            onClick={onMarkMissed}
            loading={isMarking}
            disabled={isMarking}
            className="text-xs h-9 gap-1 text-[#A32A2A] hover:bg-[#FBE9E7] border-[#E4E1DA]"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.5} />
            <span>Mark Missed</span>
          </Button>
        </div>
      ) : isLocked && session.status !== "held" ? (
        <div className="pt-1">
          <Button
            variant="secondary"
            onClick={onRequestCorrection}
            className="text-xs h-8 w-full gap-1.5 text-[#9A5B00] hover:bg-[#FBF1DE] border-[#E4E1DA]"
          >
            <FileQuestion className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Window Closed: Request Owner Correction</span>
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
