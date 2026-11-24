"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Field } from "@/components/ui/Field";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusChip, StatusChipType } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { DataRow } from "@/components/ui/DataRow";
import { MoneyText } from "@/components/ui/MoneyText";
import { Calendar, Plus } from "lucide-react";

export default function DesignReviewPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(true);

  const statuses: StatusChipType[] = [
    "scheduled",
    "held",
    "missed",
    "notCompleted",
    "unpaid",
    "paid",
    "notApplicable",
    "onHold",
    "ready",
    "pending",
    "approved",
    "rejected",
  ];

  return (
    <div className="w-full bg-[#FAF9F6] min-h-screen py-6 px-3">
      {/* 375px Phone Width Container */}
      <div className="w-full max-w-[375px] mx-auto bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] p-4 shadow-none text-[#1C1F23]">
        <div className="mb-6 pb-3 border-b border-[#E4E1DA]">
          <h1 className="text-xl font-semibold text-[#1C1F23] tracking-tight">
            Design System Review
          </h1>
          <p className="text-xs text-[#5F6670] mt-1">
            Component states at 375px phone viewport width.
          </p>
        </div>

        {/* 1. Typography */}
        <section aria-labelledby="typography-heading" className="mb-8">
          <h2
            id="typography-heading"
            className="text-xs font-semibold uppercase tracking-wider text-[#5F6670] mb-3"
          >
            1. Typography & Numerics
          </h2>
          <Card className="flex flex-col gap-2">
            <div>
              <p className="text-xs text-[#5F6670]">Public Heading (Newsreader Serif)</p>
              <h3 className="font-serif text-lg font-semibold text-[#1C1F23]">
                Knowledge Academic College
              </h3>
            </div>
            <div>
              <p className="text-xs text-[#5F6670]">UI Body (IBM Plex Sans)</p>
              <p className="text-sm text-[#1C1F23]">
                Professional administrative software for tutorial colleges.
              </p>
            </div>
            <div>
              <p className="text-xs text-[#5F6670]">Tabular Numbers</p>
              <p className="text-sm font-medium tabular-nums text-[#1C1F23]">
                08:30 - 10:30 • LKR 12,500 • 2026-11-24
              </p>
            </div>
          </Card>
        </section>

        {/* 2. Buttons */}
        <section aria-labelledby="buttons-heading" className="mb-8">
          <h2
            id="buttons-heading"
            className="text-xs font-semibold uppercase tracking-wider text-[#5F6670] mb-3"
          >
            2. Buttons & Tap Targets (≥44px)
          </h2>
          <div className="flex flex-col gap-2.5">
            <Button variant="primary" fullWidth>
              Primary Action
            </Button>
            <Button variant="primary" loading fullWidth>
              Saving Changes...
            </Button>
            <Button variant="primary" disabled fullWidth>
              Primary Disabled
            </Button>
            <Button variant="secondary" fullWidth>
              Secondary Action
            </Button>
            <Button variant="secondary" disabled fullWidth>
              Secondary Disabled
            </Button>
            <Button variant="quiet" fullWidth>
              Quiet Action
            </Button>
            <Button variant="danger" fullWidth>
              Danger Action
            </Button>
          </div>
        </section>

        {/* 3. Form Inputs & Field */}
        <section aria-labelledby="forms-heading" className="mb-8">
          <h2
            id="forms-heading"
            className="text-xs font-semibold uppercase tracking-wider text-[#5F6670] mb-3"
          >
            3. Form Inputs with Accessible Labels
          </h2>
          <div className="flex flex-col gap-3.5">
            <Field
              id="student-name"
              label="Student Name"
              required
              hint="Enter full name as on identity card"
            >
              <Input placeholder="e.g. Kaveen Perera" />
            </Field>

            <Field
              id="student-amount"
              label="Monthly Fee Amount"
              hint="Currency in Sri Lankan Rupees"
            >
              <Input type="number" defaultValue={3500} />
            </Field>

            <Field
              id="class-grade"
              label="Grade Level"
              required
            >
              <Select defaultValue="10">
                <option value="9">Grade 9</option>
                <option value="10">Grade 10</option>
                <option value="11">Grade 11</option>
              </Select>
            </Field>

            <Field
              id="class-error"
              label="Contact Phone"
              error="Phone number must be a valid 10-digit Sri Lankan number."
            >
              <Input defaultValue="07123" />
            </Field>

            <Field
              id="student-notes"
              label="Administrative Notes"
              hint="Internal college reference only"
            >
              <Textarea placeholder="Special remarks regarding enrolments or concessions..." />
            </Field>

            <Field
              id="input-disabled"
              label="Locked Academic Year"
            >
              <Input defaultValue="2025 (Archived)" disabled />
            </Field>
          </div>
        </section>

        {/* 4. Status Chips */}
        <section aria-labelledby="chips-heading" className="mb-8">
          <h2
            id="chips-heading"
            className="text-xs font-semibold uppercase tracking-wider text-[#5F6670] mb-3"
          >
            4. Status Chips (Word in Subtle Chip)
          </h2>
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <StatusChip key={status} status={status} />
            ))}
          </div>
        </section>

        {/* 5. Financial & Data Rows */}
        <section aria-labelledby="datarow-heading" className="mb-8">
          <h2
            id="datarow-heading"
            className="text-xs font-semibold uppercase tracking-wider text-[#5F6670] mb-3"
          >
            5. Financial & Data Rows
          </h2>
          <Card className="p-0 overflow-hidden divide-y divide-[#E4E1DA]">
            <DataRow
              title="Kaveen Perera"
              subtitle="Grade 10 Maths • Joined 12 Jan 2026"
              rightValue={<StatusChip status="paid" />}
              onClick={() => {}}
            />
            <DataRow
              title="Nisal Gunasekara"
              subtitle="Grade 10 Science"
              rightValue={<StatusChip status="unpaid" />}
              onClick={() => {}}
            />
            <DataRow
              title="Monthly Tuition Fee"
              subtitle="Due on 1st of every month"
              rightValue={<MoneyText amount={4500} />}
            />
            <DataRow
              title="Total Ready Salaries"
              subtitle="4 classes completed requirements"
              rightValue={<MoneyText amount={142000} className="text-[#1F5C4D]" />}
            />
          </Card>
        </section>

        {/* 6. PageHeader */}
        <section aria-labelledby="header-heading" className="mb-8">
          <h2
            id="header-heading"
            className="text-xs font-semibold uppercase tracking-wider text-[#5F6670] mb-3"
          >
            6. PageHeader
          </h2>
          <PageHeader
            title="Class Timetable"
            subtitle="Grade 10 weekly schedule"
            action={
              <Button size="sm" variant="primary">
                <Plus className="w-3.5 h-3.5 mr-1" strokeWidth={1.75} />
                Add Slot
              </Button>
            }
          />
        </section>

        {/* 7. Empty State */}
        <section aria-labelledby="empty-heading" className="mb-8">
          <h2
            id="empty-heading"
            className="text-xs font-semibold uppercase tracking-wider text-[#5F6670] mb-3"
          >
            7. Empty State
          </h2>
          <EmptyState
            title="No sessions scheduled"
            description="There are no regular or make-up sessions planned for this date."
            icon={<Calendar className="w-8 h-8" strokeWidth={1.75} />}
            action={
              <Button variant="secondary" size="sm">
                Schedule Make-up
              </Button>
            }
          />
        </section>

        {/* 8. Skeletons */}
        <section aria-labelledby="skeleton-heading" className="mb-8">
          <h2
            id="skeleton-heading"
            className="text-xs font-semibold uppercase tracking-wider text-[#5F6670] mb-3"
          >
            8. Loading Skeletons
          </h2>
          <Card className="flex flex-col gap-2.5">
            <Skeleton variant="text" width="60%" height={16} />
            <Skeleton variant="text" width="90%" height={12} />
            <Skeleton variant="text" width="40%" height={12} />
            <Skeleton variant="rectangular" height={36} className="mt-1" />
          </Card>
        </section>

        {/* 9. Interactive Overlays & Toasts */}
        <section aria-labelledby="dialogs-heading" className="mb-8">
          <h2
            id="dialogs-heading"
            className="text-xs font-semibold uppercase tracking-wider text-[#5F6670] mb-3"
          >
            9. Dialogs, Sheets & Feedback
          </h2>
          <div className="flex flex-col gap-2.5">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setSheetOpen(true)}
            >
              Open Bottom Sheet Preview
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setDialogOpen(true)}
            >
              Open Confirm Dialog Preview
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {toastVisible && (
              <Toast
                message="Session marked as Held successfully."
                variant="success"
                onDismiss={() => setToastVisible(false)}
              />
            )}
            <Toast
              message="3 students have unpaid fees for November."
              variant="warning"
            />
            <Toast
              message="Timetable clash: Mr. Silva is already teaching at this time."
              variant="danger"
            />
          </div>
        </section>

        {/* 10. Shell Navigation Previews */}
        <section aria-labelledby="shells-heading" className="mb-4">
          <h2
            id="shells-heading"
            className="text-xs font-semibold uppercase tracking-wider text-[#5F6670] mb-3"
          >
            10. Shell Navigation Overview
          </h2>
          <Card className="p-3">
            <CardHeader className="pb-1 mb-2">
              <CardTitle className="text-xs text-[#5F6670]">Owner Navigation</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-5 text-center text-xs text-[#5F6670] py-2 border border-[#E4E1DA] rounded-[4px] bg-[#FAF9F6]">
              <span className="text-[#1F5C4D] font-semibold">Home</span>
              <span>Classes</span>
              <span>Fees</span>
              <span>Salary</span>
              <span>More</span>
            </div>
            <CardHeader className="pb-1 mb-2 mt-4">
              <CardTitle className="text-xs text-[#5F6670]">Teacher Navigation</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-5 text-center text-xs text-[#5F6670] py-2 border border-[#E4E1DA] rounded-[4px] bg-[#FAF9F6]">
              <span className="text-[#1F5C4D] font-semibold">Today</span>
              <span>Timetable</span>
              <span>Classes</span>
              <span>Salary</span>
              <span>More</span>
            </div>
          </Card>
        </section>

        {/* Modals */}
        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Filter Sessions"
          description="Refine session list by class and status"
        >
          <div className="flex flex-col gap-3 py-2">
            <Field id="filter-class" label="Class">
              <Select defaultValue="all">
                <option value="all">All Classes</option>
                <option value="maths">Grade 10 Maths</option>
              </Select>
            </Field>
            <Button
              variant="primary"
              fullWidth
              onClick={() => setSheetOpen(false)}
            >
              Apply Filter
            </Button>
          </div>
        </BottomSheet>

        <ConfirmDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onConfirm={() => setDialogOpen(false)}
          title="Lock Fee Term Change?"
          description="Changing terms effective from November 2026 will not alter fee records of earlier months."
          confirmLabel="Apply Terms"
        />
      </div>
    </div>
  );
}
