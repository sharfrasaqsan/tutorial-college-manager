"use client";

import React, { useState, useEffect, useCallback } from "react";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Inbox,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Calendar,
  AlertCircle,
  FileQuestion,
} from "lucide-react";
import { formatDateDisplay } from "@/lib/dates";

interface CorrectionRequestItem {
  id: string;
  sessionId: string;
  sessionDate: string;
  sessionTime: string;
  className: string;
  teacherId: string;
  teacherName: string;
  currentStatus: string;
  requestedStatus: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export default function OwnerRequestsPage() {
  const [requests, setRequests] = useState<CorrectionRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "resolved">("pending");
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    variant: "success" | "danger";
  } | null>(null);

  // Resolution confirmation
  const [selectedRequest, setSelectedRequest] = useState<CorrectionRequestItem | null>(null);
  const [resolutionAction, setResolutionAction] = useState<"approve" | "reject">("approve");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/owner/requests");
      if (!res.ok) throw new Error("Failed to load correction requests.");
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (err: any) {
      setToastMessage({ text: err.message, variant: "danger" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const resolvedRequests = requests.filter((r) => r.status !== "pending");

  function promptResolution(req: CorrectionRequestItem, action: "approve" | "reject") {
    setSelectedRequest(req);
    setResolutionAction(action);
    setConfirmOpen(true);
  }

  async function handleConfirmResolution() {
    if (!selectedRequest) return;
    try {
      setIsResolving(true);
      const res = await fetch(`/api/owner/requests/${selectedRequest.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: resolutionAction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve request.");

      setToastMessage({
        text: data.message || `Request ${resolutionAction}d.`,
        variant: "success",
      });
      setConfirmOpen(false);
      setSelectedRequest(null);
      await loadRequests();
    } catch (err: any) {
      setToastMessage({ text: err.message, variant: "danger" });
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <OwnerShell pageTitle="Requests Inbox" maxWidth="wide">
      <div className="max-w-5xl mx-auto space-y-5 pb-12">
        {toastMessage && (
          <div>
            <Toast
              message={toastMessage.text}
              variant={toastMessage.variant}
              onDismiss={() => setToastMessage(null)}
            />
          </div>
        )}

        <PageHeader
          title="Session Correction Requests"
          subtitle="Review faculty requests to update attendance on locked session records"
        />

      {/* Tabs */}
      <div className="flex border-b border-[#E4E1DA] mb-4 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`min-h-[44px] px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "pending"
              ? "border-[#1F5C4D] text-[#1F5C4D]"
              : "border-transparent text-[#5F6670] hover:text-[#1C1F23]"
          }`}
        >
          <span>Pending</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              pendingRequests.length > 0
                ? "bg-[#1F5C4D] text-white"
                : "bg-[#FAF9F6] text-[#5F6670]"
            }`}
          >
            {pendingRequests.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("resolved")}
          className={`min-h-[44px] px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "resolved"
              ? "border-[#1F5C4D] text-[#1F5C4D]"
              : "border-transparent text-[#5F6670] hover:text-[#1C1F23]"
          }`}
        >
          <span>Resolved</span>
          <span className="bg-[#FAF9F6] text-[#5F6670] px-1.5 py-0.2 rounded-full text-[10px]">
            {resolvedRequests.length}
          </span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : activeTab === "pending" ? (
        pendingRequests.length === 0 ? (
          <EmptyState
            icon={<Inbox className="w-8 h-8 text-[#5F6670]" strokeWidth={1.5} />}
            title="No pending requests"
            description="All teacher session correction requests have been resolved."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {pendingRequests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                onApprove={() => promptResolution(req, "approve")}
                onReject={() => promptResolution(req, "reject")}
              />
            ))}
          </div>
        )
      ) : resolvedRequests.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-8 h-8 text-[#5F6670]" strokeWidth={1.5} />}
          title="No resolved requests"
          description="Approved and rejected correction requests will appear here in the history log."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {resolvedRequests.map((req) => (
            <RequestCard key={req.id} request={req} />
          ))}
        </div>
      )}

        {/* Confirmation Dialog */}
        <ConfirmDialog
          open={confirmOpen}
          title={
            resolutionAction === "approve"
              ? "Approve Correction Request?"
              : "Reject Correction Request?"
          }
          description={
            selectedRequest
              ? resolutionAction === "approve"
                ? `Approving will change ${selectedRequest.className} on ${formatDateDisplay(
                    selectedRequest.sessionDate
                  )} to "${selectedRequest.requestedStatus}". This will be logged in the college audit records.`
                : `Rejecting will leave the session in its current "${selectedRequest.currentStatus}" status.`
              : ""
          }
          confirmLabel={resolutionAction === "approve" ? "Approve & Update Mark" : "Reject Request"}
          cancelLabel="Cancel"
          variant={resolutionAction === "approve" ? "primary" : "danger"}
          loading={isResolving}
          onConfirm={handleConfirmResolution}
          onClose={() => {
            setConfirmOpen(false);
            setSelectedRequest(null);
          }}
        />
      </div>
    </OwnerShell>
  );
}

function RequestCard({
  request,
  onApprove,
  onReject,
}: {
  request: CorrectionRequestItem;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  const isPending = request.status === "pending";

  return (
    <Card className="p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-semibold text-sm text-[#1C1F23] block">{request.className}</span>
          <div className="flex items-center gap-1.5 text-xs text-[#5F6670] mt-0.5">
            <User className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{request.teacherName}</span>
          </div>
        </div>

        <div>
          {request.status === "approved" ? (
            <StatusChip status="success" label="Approved" />
          ) : request.status === "rejected" ? (
            <StatusChip status="danger" label="Rejected" />
          ) : (
            <StatusChip status="warning" label="Pending Review" />
          )}
        </div>
      </div>

      {/* Session Details */}
      <div className="flex items-center gap-3 text-xs bg-[#FAF9F6] p-2.5 rounded-[6px] border border-[#E4E1DA]">
        <div className="flex items-center gap-1 text-[#5F6670]">
          <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>{formatDateDisplay(request.sessionDate)}</span>
        </div>
        <div className="flex items-center gap-1 text-[#5F6670] tabular-nums">
          <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>{request.sessionTime}</span>
        </div>
      </div>

      {/* Status Transition */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[#5F6670]">Requested Change:</span>
        <span className="capitalize font-medium text-[#5F6670] bg-[#FAF9F6] px-2 py-0.5 rounded border border-[#E4E1DA]">
          {request.currentStatus}
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-[#5F6670]" strokeWidth={2} />
        <span className="capitalize font-semibold text-[#1F5C4D] bg-[#E6F0EC] px-2 py-0.5 rounded border border-[#1F5C4D]/30">
          {request.requestedStatus}
        </span>
      </div>

      {/* Teacher Reason */}
      <div className="text-xs text-[#1C1F23] bg-[#FAF9F6] p-2.5 rounded-[6px] border-l-2 border-[#1F5C4D]">
        <span className="text-[11px] font-semibold text-[#5F6670] block mb-0.5 uppercase tracking-wider">
          Teacher&apos;s Reason
        </span>
        <p className="italic text-[#1C1F23]">&ldquo;{request.reason}&rdquo;</p>
      </div>

      {/* Action Footer */}
      {isPending && onApprove && onReject && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E1DA]">
          <Button variant="secondary" onClick={onReject} className="text-xs h-8 px-3">
            Reject
          </Button>
          <Button variant="primary" onClick={onApprove} className="text-xs h-8 px-3">
            Approve Change
          </Button>
        </div>
      )}

      {!isPending && request.resolvedAt && (
        <div className="text-[11px] text-[#5F6670] text-right pt-1 border-t border-[#E4E1DA]">
          Resolved on {formatDateDisplay(request.resolvedAt.slice(0, 10))}
        </div>
      )}
    </Card>
  );
}
