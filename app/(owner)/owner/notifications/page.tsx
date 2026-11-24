import React from "react";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotificationsClientView } from "@/components/notifications/NotificationsClientView";

export default function OwnerNotificationsPage() {
  return (
    <OwnerShell pageTitle="Notifications">
      <PageHeader
        title="Notifications"
        subtitle="Make-up classes, salary milestones, correction requests, and fee reminders"
      />
      <NotificationsClientView role="owner" />
    </OwnerShell>
  );
}
