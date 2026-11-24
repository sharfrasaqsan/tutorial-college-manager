import React from "react";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotificationsClientView } from "@/components/notifications/NotificationsClientView";

export default function OwnerNotificationsPage() {
  return (
    <OwnerShell pageTitle="Notifications">
      <PageContainer variant="default">
        <PageHeader
          title="Notifications"
          subtitle="Make-up classes, salary milestones, correction requests, and fee reminders"
        />
        <NotificationsClientView role="owner" />
      </PageContainer>
    </OwnerShell>
  );
}
