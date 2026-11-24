"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Clock,
  ArrowRight,
  ExternalLink,
  Calendar,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PushPermissionPrompt } from "@/components/notifications/PushPermissionPrompt";
import type { AppNotification } from "@/types";

interface NotificationsClientViewProps {
  role: "owner" | "teacher";
}

export function NotificationsClientView({ role }: NotificationsClientViewProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [markingAll, setMarkingAll] = useState<boolean>(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const fetchNotifications = useCallback(async (isBg = false) => {
    if (!isBg) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleItemClick = async (notif: AppNotification) => {
    // Mark as read if not already read
    if (!notif.readAt) {
      try {
        await fetch(`/api/notifications/${notif.id}/read`, { method: "PATCH" });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Failed to mark as read:", err);
      }
    }

    if (notif.link && notif.link !== "/") {
      router.push(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (res.ok) {
        const now = new Date().toISOString();
        setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || now })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Failed to mark all notifications read:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    } catch {
      return isoString;
    }
  };

  const displayedNotifications = notifications.filter(
    (n) => filter === "all" || !n.readAt
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-12">
      {/* Web Push Permission Prompt & iPhone Install Help Card */}
      <PushPermissionPrompt />

      {/* Header Action Bar with Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-[#1C1F23]">Notifications</span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-[#A32A2A] text-[#FFFFFF] rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>

          {/* Filter Row: All / Unread */}
          <div className="inline-flex items-center p-0.5 bg-[#FAF9F6] border border-[#E4E1DA] rounded-[6px] text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors ${
                filter === "all"
                  ? "bg-[#1F5C4D] text-white shadow-xs"
                  : "text-[#5F6670] hover:text-[#1C1F23]"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors ${
                filter === "unread"
                  ? "bg-[#1F5C4D] text-white shadow-xs"
                  : "text-[#5F6670] hover:text-[#1C1F23]"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="text-xs flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchNotifications(true)}
            disabled={refreshing}
            className="h-9 w-9 p-0"
            aria-label="Refresh notifications"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {/* Empty State */}
      {!loading && displayedNotifications.length === 0 && (
        <EmptyState
          title={filter === "unread" ? "No unread notifications" : "No notifications yet"}
          description={
            filter === "unread"
              ? "You have read all your alerts. Switch to 'All' to view your notification history."
              : "You will receive alerts here for timetable updates, salary milestones, and class reminders."
          }
          icon={<Bell className="w-8 h-8" strokeWidth={1.75} />}
        />
      )}

      {/* Notifications List */}
      {!loading && displayedNotifications.length > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E4E1DA] rounded-[6px] divide-y divide-[#E4E1DA] overflow-hidden">
          {displayedNotifications.map((notif) => {
            const isUnread = !notif.readAt;

            return (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif)}
                className={`p-4 flex items-start gap-3.5 cursor-pointer transition-colors ${
                  isUnread
                    ? "bg-[#FAF9F6] hover:bg-[#F2EFE9]"
                    : "hover:bg-[#FAF9F6]/50"
                }`}
              >
                {/* Unread indicator */}
                <div className="pt-1.5 shrink-0">
                  <span
                    className={`w-2 h-2 rounded-full block ${
                      isUnread ? "bg-[#1F5C4D]" : "bg-transparent"
                    }`}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <h4
                      className={`text-sm ${
                        isUnread ? "font-bold text-[#1C1F23]" : "font-medium text-[#1C1F23]"
                      }`}
                    >
                      {notif.title}
                    </h4>
                    <span className="text-[11px] text-[#5F6670] whitespace-nowrap shrink-0 text-right pt-0.5">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-[#5F6670] mt-1 leading-relaxed">
                    {notif.body}
                  </p>

                  {notif.link && notif.link !== "/" && (
                    <div className="pt-2 flex items-center gap-1 text-[11px] font-semibold text-[#1F5C4D]">
                      <span>View details</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
