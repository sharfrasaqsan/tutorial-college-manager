"use client";

import React, { useState, useEffect, useCallback } from "react";
import { OwnerShell } from "@/components/layout/OwnerShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  MessageSquare,
  Mail,
  Phone,
  MessageCircle,
  Clock,
  CheckCircle2,
  Trash2,
  Search,
  CheckCheck,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";
import type { ContactMessage } from "@/types";

export default function OwnerMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "read" | "replied">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    variant: "success" | "danger";
  } | null>(null);

  // Deletion confirm state
  const [deleteTarget, setDeleteTarget] = useState<ContactMessage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/owner/messages");
      if (!res.ok) throw new Error("Failed to load contact messages.");
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err: any) {
      setToastMessage({ text: err.message, variant: "danger" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const unreadCount = messages.filter((m) => m.status === "unread").length;
  const readCount = messages.filter((m) => m.status === "read").length;
  const repliedCount = messages.filter((m) => m.status === "replied").length;

  // Filter messages by active tab and search query
  const filteredMessages = messages.filter((msg) => {
    if (activeTab !== "all" && msg.status !== activeTab) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = msg.name.toLowerCase().includes(q);
      const matchEmail = msg.email.toLowerCase().includes(q);
      const matchPhone = msg.phone ? msg.phone.toLowerCase().includes(q) : false;
      const matchSubject = msg.subject ? msg.subject.toLowerCase().includes(q) : false;
      const matchText = msg.message.toLowerCase().includes(q);
      return matchName || matchEmail || matchPhone || matchSubject || matchText;
    }
    return true;
  });

  // Optimistic status update
  async function handleUpdateStatus(id: string, newStatus: "unread" | "read" | "replied") {
    const previous = [...messages];
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m))
    );

    try {
      const res = await fetch(`/api/owner/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        throw new Error("Failed to update status on server.");
      }
      setToastMessage({
        text: `Message marked as ${newStatus}.`,
        variant: "success",
      });
    } catch {
      setMessages(previous);
      setToastMessage({
        text: "Error updating message status.",
        variant: "danger",
      });
    }
  }

  // Delete message
  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const previous = [...messages];
    setMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id));

    try {
      const res = await fetch(`/api/owner/messages/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete message.");
      }
      setToastMessage({
        text: `Message from ${deleteTarget.name} deleted.`,
        variant: "success",
      });
      setDeleteTarget(null);
    } catch {
      setMessages(previous);
      setToastMessage({
        text: "Error deleting message.",
        variant: "danger",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function formatDateTime(isoString: string) {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
        timeZone: "Asia/Colombo",
      }).format(d);
    } catch {
      return isoString;
    }
  }

  return (
    <OwnerShell pageTitle="Contact Messages">
      {toastMessage && (
        <div className="mb-4">
          <Toast
            message={toastMessage.text}
            variant={toastMessage.variant}
            onDismiss={() => setToastMessage(null)}
          />
        </div>
      )}

      <PageHeader
        title="Public Contact Inquiries"
        subtitle="Manage visitor messages and admission questions submitted via the public college website."
      />

      {/* Top Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px] overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "all"
                ? "bg-[#1F5C4D] text-[#FFFFFF]"
                : "text-[#5F6670] hover:text-[#1C1F23]"
            }`}
          >
            All ({messages.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("unread")}
            className={`px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === "unread"
                ? "bg-[#1F5C4D] text-[#FFFFFF]"
                : "text-[#5F6670] hover:text-[#1C1F23]"
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === "unread" ? "bg-[#FFFFFF] text-[#1F5C4D]" : "bg-[#A32A2A] text-[#FFFFFF]"
              }`}>
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("read")}
            className={`px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "read"
                ? "bg-[#1F5C4D] text-[#FFFFFF]"
                : "text-[#5F6670] hover:text-[#1C1F23]"
            }`}
          >
            Read ({readCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("replied")}
            className={`px-3 py-1.5 text-xs font-medium rounded-[4px] transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "replied"
                ? "bg-[#1F5C4D] text-[#FFFFFF]"
                : "text-[#5F6670] hover:text-[#1C1F23]"
            }`}
          >
            Replied ({repliedCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[#5F6670] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full pl-9 pr-3 py-1.5 text-xs text-[#1C1F23] bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] focus:outline-hidden focus:border-[#1F5C4D] focus:ring-1 focus:ring-[#1F5C4D]"
          />
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 space-y-3">
              <div className="flex justify-between items-start">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-16 w-full" />
              <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-24" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredMessages.length === 0 ? (
        <EmptyState
          title={
            searchQuery
              ? "No Matching Messages"
              : activeTab === "unread"
              ? "No Unread Inquiries"
              : "No Contact Messages"
          }
          description={
            searchQuery
              ? `No messages matched your search term "${searchQuery}".`
              : activeTab === "unread"
              ? "All received public website messages have been reviewed."
              : "Inquiries submitted by students and parents on the public contact page will show here."
          }
          icon={<MessageSquare className="w-8 h-8 text-[#5F6670]" strokeWidth={1.75} />}
        />
      ) : (
        <div className="space-y-4">
          {filteredMessages.map((msg) => {
            const cleanPhone = (msg.phone || "").replace(/[^0-9]/g, "");
            const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : "";
            const telUrl = msg.phone ? `tel:${msg.phone.replace(/\s+/g, "")}` : "";
            const mailtoUrl = `mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.subject || "Tutorial College Inquiry")}`;

            return (
              <Card
                key={msg.id}
                className={`p-5 transition-colors shadow-xs ${
                  msg.status === "unread"
                    ? "border-l-4 border-l-[#1F5C4D] bg-[#FFFFFF]"
                    : "bg-[#FFFFFF]"
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3 pb-3 border-b border-[#E4E1DA]">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#E6F0EC] text-[#1F5C4D] flex items-center justify-center font-serif font-bold text-sm shrink-0">
                      {msg.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-[#1C1F23]">
                          {msg.name}
                        </span>
                        {msg.status === "unread" && (
                          <StatusChip status="danger" label="Unread" />
                        )}
                        {msg.status === "read" && (
                          <StatusChip status="notApplicable" label="Read" />
                        )}
                        {msg.status === "replied" && (
                          <StatusChip status="paid" label="Replied" />
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-[#5F6670] mt-0.5 flex-wrap">
                        <a
                          href={mailtoUrl}
                          className="hover:text-[#1F5C4D] hover:underline flex items-center gap-1 font-medium text-[#1C1F23]"
                        >
                          <Mail className="w-3 h-3 text-[#5F6670]" />
                          <span>{msg.email}</span>
                        </a>

                        {msg.phone && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-[#5F6670]" />
                              <span>{msg.phone}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-[#5F6670] self-start sm:self-auto shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDateTime(msg.createdAt)}</span>
                  </div>
                </div>

                {/* Subject & Message Content */}
                <div className="mb-4">
                  {msg.subject && (
                    <div className="text-xs font-semibold text-[#1C1F23] mb-1.5">
                      Subject: <span className="font-normal text-[#5F6670]">{msg.subject}</span>
                    </div>
                  )}
                  <div className="text-xs text-[#1C1F23] bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px] p-3.5 leading-relaxed whitespace-pre-wrap">
                    {msg.message}
                  </div>
                </div>

                {/* Footer Action Controls */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  {/* Quick Contact CTAs */}
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={mailtoUrl}
                      onClick={() => {
                        if (msg.status === "unread") {
                          handleUpdateStatus(msg.id, "replied");
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#1F5C4D] hover:bg-[#17473B] text-xs font-medium text-[#FFFFFF] transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Reply via Email</span>
                    </a>

                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          if (msg.status === "unread") {
                            handleUpdateStatus(msg.id, "replied");
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#FFFFFF] border border-[#E4E1DA] hover:bg-[#FAF9F6] text-xs font-medium text-[#1C1F23] transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-[#1F5C4D]" />
                        <span>WhatsApp</span>
                      </a>
                    )}

                    {telUrl && (
                      <a
                        href={telUrl}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#FFFFFF] border border-[#E4E1DA] hover:bg-[#FAF9F6] text-xs font-medium text-[#1C1F23] transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5 text-[#5F6670]" />
                        <span>Call</span>
                      </a>
                    )}
                  </div>

                  {/* Status Toggle & Delete */}
                  <div className="flex items-center gap-1.5">
                    {msg.status !== "replied" && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(msg.id, "replied")}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[#1F5C4D] hover:bg-[#E6F0EC] rounded-[4px] transition-colors cursor-pointer"
                        title="Mark as Replied"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark Replied</span>
                      </button>
                    )}

                    {msg.status === "unread" ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(msg.id, "read")}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[#5F6670] hover:text-[#1C1F23] hover:bg-[#FAF9F6] rounded-[4px] transition-colors cursor-pointer"
                        title="Mark as Read"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Mark Read</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(msg.id, "unread")}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[#5F6670] hover:text-[#1C1F23] hover:bg-[#FAF9F6] rounded-[4px] transition-colors cursor-pointer"
                        title="Mark as Unread"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Mark Unread</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setDeleteTarget(msg)}
                      className="p-1.5 text-[#5F6670] hover:text-[#A32A2A] hover:bg-[#FBE9E7] rounded-[4px] transition-colors cursor-pointer"
                      title="Delete message"
                      aria-label="Delete message"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Contact Inquiry"
        description={
          deleteTarget
            ? `Are you sure you want to delete the message from ${deleteTarget.name} (${deleteTarget.email})? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete Message"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </OwnerShell>
  );
}
