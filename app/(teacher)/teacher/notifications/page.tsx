import React from "react";
import { TeacherShell } from "@/components/layout/TeacherShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotificationsClientView } from "@/components/notifications/NotificationsClientView";

export default function TeacherNotificationsPage() {
  return (
    <TeacherShell pageTitle="Notifications" maxWidth="wide">
      <PageHeader
        title="Notifications"
        subtitle="Timetable updates, salary payments, correction decisions, and session reminders"
      />
      <NotificationsClientView role="teacher" />
    </TeacherShell>
  );
}
