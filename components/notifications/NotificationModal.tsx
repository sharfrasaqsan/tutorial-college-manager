"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
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
  X,
  CreditCard,
  MessageSquare,
  Users,
  Check,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { AppNotification } from "@/types";

export interface NotificationModalProps {
  role: "owner" | "teacher";
  unreadCount?: number;
  hasNotifications?: boolean;
  onUnreadCountChange?: (count: number) => void;
}

function formatRelativeTime(isoString: string): string {
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
    return "";
  }
}

function getNotificationIcon(title: string, body: string) {
  const text = `${title} ${body}`.toLowerCase();
  if (text.includes("timetable") || text.includes("schedule") || text.includes("slot") || text.includes("session")) {
    return <Calendar className="w-3.5 h-3.5 text-[#1F5C4D]" strokeWidth={2} />;
  }
  if (text.includes("fee") || text.includes("salary") || text.includes("pay") || text.includes("invoice")) {
    return <CreditCard className="w-3.5 h-3.5 text-[#D97706]" strokeWidth={2} />;
  }
  if (text.includes("message") || text.includes("contact") || text.includes("inquiry")) {
    return <MessageSquare className="w-3.5 h-3.5 text-[#2563EB]" strokeWidth={2} />;
  }
  if (text.includes("student") || text.includes("enrol") || text.includes("admission")) {
    return <Users className="w-3.5 h-3.5 text-[#7C3AED]" strokeWidth={2} />;
  }
  if (text.includes("clash") || text.includes("alert") || text.includes("conflict") || text.includes("warning")) {
    return <AlertCircle className="w-3.5 h-3.5 text-[#A32A2A]" strokeWidth={2} />;
  }
  return <Bell className="w-3.5 h-3.5 text-[#5F6670]" strokeWidth={2} />;
}

export function NotificationModal({
  role,
  unreadCount: initialUnreadCount = 0,
  hasNotifications = false,
  onUnreadCountChange,
}: NotificationModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [count, setCount] = useState(initialUnreadCount);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync internal count when prop changes
  useEffect(() => {
    setCount(initialUnreadCount);
  }, [initialUnreadCount]);

  // Load notifications from server
  const loadNotifications = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        const notifs: AppNotification[] = data.notifications || [];
        const unread: number = typeof data.unreadCount === "number" ? data.unreadCount : 0;
        setNotifications(notifs);
        setCount(unread);
        onUnreadCountChange?.(unread);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onUnreadCountChange]);

  // Fetch when modal opens
  useEffect(() => {
    if (isOpen) {
      loadNotifications(notifications.length > 0);
    }
  }, [isOpen, loadNotifications, notifications.length]);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Mark single notification as read
  const handleItemClick = async (notif: AppNotification) => {
    if (!notif.readAt) {
      try {
        await fetch(`/api/notifications/${notif.id}/read`, { method: "PATCH" });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, readAt: new Date().toISOString() } : n))
        );
        const newCount = Math.max(0, count - 1);
        setCount(newCount);
        onUnreadCountChange?.(newCount);
      } catch (err) {
        console.error("Failed to mark notification read:", err);
      }
    }

    if (notif.link && notif.link !== "/") {
      handleClose();
      router.push(notif.link);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    if (count === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/read-all", { method: "POST" });
      if (res.ok) {
        const now = new Date().toISOString();
        setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || now })));
        setCount(0);
        onUnreadCountChange?.(0);
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    } finally {
      setMarkingAll(false);
    }
  };

  const displayedNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.readAt;
    return true;
  });

  const fullHistoryUrl = role === "owner" ? "/owner/notifications" : "/teacher/notifications";

  return (
    <div className="relative inline-block text-left">
      {/* Notifications Bell Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className="min-h-[44px] min-w-[44px] relative flex items-center justify-center text-[#5F6670] hover:text-[#1C1F23] rounded-[6px] transition-colors cursor-pointer"
        aria-label={`Notifications (${count} unread)`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="w-5 h-5" strokeWidth={1.75} />
        {(count > 0 || hasNotifications) && (
          <span className="absolute top-2 right-2 min-w-[16px] h-4 px-1 text-[10px] font-bold bg-[#A32A2A] text-[#FFFFFF] rounded-full flex items-center justify-center leading-none select-none">
            {count > 9 ? "9+" : count || "•"}
          </span>
        )}
      </button>

      {/* Popover / Modal Dialog */}
      {isOpen && (
        <>
          {/* Mobile Backdrop Overlay */}
          <div
            className="sm:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-2xs transition-opacity"
            onClick={handleClose}
            aria-hidden="true"
          />

          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Notifications Panel"
            aria-modal="true"
            className="
              fixed inset-x-2 bottom-3 z-50 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2
              w-auto sm:w-[380px] max-w-[calc(100vw-16px)] sm:max-w-none
              bg-white dark:bg-[#181B1F] border border-[#E4E1DA] dark:border-[#2C3036] rounded-[12px] sm:rounded-[8px]
              shadow-xl flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150
            "
          >
            {/* Modal Header */}
            <div className="px-3.5 py-2.5 border-b border-[#E4E1DA] dark:border-[#2C3036] bg-[#FAF9F6] dark:bg-[#1F2328] flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#E6F0EC] dark:bg-[#1F5C4D]/20 text-[#1F5C4D] dark:text-[#34D399] flex items-center justify-center">
                  <Bell className="w-3.5 h-3.5" strokeWidth={2} />
                </div>
                <h3 className="font-semibold text-xs text-[#1C1F23] dark:text-[#F3F4F6] flex items-center gap-1.5">
                  <span>Notifications</span>
                  {count > 0 && (
                    <span className="text-[10px] font-bold bg-[#A32A2A] text-white px-1.5 py-0.2 rounded-full tabular-nums">
                      {count} new
                    </span>
                  )}
                </h3>
              </div>

              <div className="flex items-center gap-1">
                {count > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={markingAll}
                    title="Mark all as read"
                    aria-label="Mark all as read"
                    className="p-1 text-xs text-[#5F6670] dark:text-[#A0A6B1] hover:text-[#1F5C4D] dark:hover:text-[#34D399] hover:bg-white dark:hover:bg-[#2A2E35] rounded transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px] font-medium">Mark read</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => loadNotifications(true)}
                  disabled={refreshing}
                  title="Refresh notifications"
                  aria-label="Refresh notifications"
                  className="p-1 text-[#5F6670] dark:text-[#A0A6B1] hover:text-[#1C1F23] dark:hover:text-white hover:bg-white dark:hover:bg-[#2A2E35] rounded transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  title="Close"
                  aria-label="Close"
                  className="p-1 text-[#5F6670] dark:text-[#A0A6B1] hover:text-[#1C1F23] dark:hover:text-white hover:bg-white dark:hover:bg-[#2A2E35] rounded transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-3 py-1.5 border-b border-[#E4E1DA] dark:border-[#2C3036] bg-white dark:bg-[#181B1F] flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-2.5 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                  filter === "all"
                    ? "bg-[#1F5C4D] text-white font-semibold"
                    : "text-[#5F6670] dark:text-[#A0A6B1] hover:bg-[#FAF9F6] dark:hover:bg-[#23272F] hover:text-[#1C1F23] dark:hover:text-white"
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`px-2.5 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                  filter === "unread"
                    ? "bg-[#1F5C4D] text-white font-semibold"
                    : "text-[#5F6670] dark:text-[#A0A6B1] hover:bg-[#FAF9F6] dark:hover:bg-[#23272F] hover:text-[#1C1F23] dark:hover:text-white"
                }`}
              >
                Unread ({count})
              </button>
            </div>

            {/* Notifications Scroll Area */}
            <div className="max-h-[340px] sm:max-h-[380px] overflow-y-auto divide-y divide-[#E4E1DA] dark:divide-[#2C3036] bg-white dark:bg-[#181B1F] overscroll-contain">
              {loading ? (
                <div className="p-3 flex flex-col gap-2.5">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : displayedNotifications.length === 0 ? (
                <div className="p-6 text-center flex flex-col items-center justify-center gap-1.5 text-xs text-[#5F6670] dark:text-[#A0A6B1]">
                  <div className="w-8 h-8 rounded-full bg-[#FAF9F6] dark:bg-[#23272F] flex items-center justify-center text-[#8E95A0] dark:text-[#6C727F] mb-0.5 border border-[#E4E1DA] dark:border-[#2C3036]">
                    <Bell className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <span className="font-semibold text-[#1C1F23] dark:text-white">
                    {filter === "unread" ? "No unread notifications" : "No notifications yet"}
                  </span>
                  <span className="text-[11px]">
                    {filter === "unread"
                      ? "You are all caught up!"
                      : "New alerts and timetable updates will appear here."}
                  </span>
                </div>
              ) : (
                displayedNotifications.map((notif) => {
                  const isUnread = !notif.readAt;
                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleItemClick(notif)}
                      className={`p-3 transition-colors flex items-start gap-2.5 cursor-pointer relative group ${
                        isUnread
                          ? "bg-[#FAF9F6]/80 dark:bg-[#23272F]/50 hover:bg-[#FAF9F6] dark:hover:bg-[#23272F]"
                          : "bg-white dark:bg-[#181B1F] hover:bg-[#FAF9F6]/50 dark:hover:bg-[#23272F]/20"
                      }`}
                    >
                      {/* Notification Category Icon */}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                          isUnread
                            ? "bg-white dark:bg-[#1F2328] border-[#1F5C4D]/30 shadow-2xs"
                            : "bg-[#FAF9F6] dark:bg-[#23272F] border-[#E4E1DA] dark:border-[#2C3036]"
                        }`}
                      >
                        {getNotificationIcon(notif.title, notif.body)}
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <h4
                            className={`text-xs line-clamp-1 ${
                              isUnread ? "font-bold text-[#1C1F23] dark:text-white" : "font-medium text-[#5F6670] dark:text-[#A0A6B1]"
                            }`}
                            title={notif.title}
                          >
                            {notif.title}
                          </h4>
                          <span className="text-[10.5px] text-[#8E95A0] dark:text-[#6C727F] whitespace-nowrap shrink-0 tabular-nums">
                            {formatRelativeTime(notif.createdAt)}
                          </span>
                        </div>

                        <p className="text-[11.5px] text-[#5F6670] dark:text-[#A0A6B1] mt-0.5 leading-snug line-clamp-2">
                          {notif.body}
                        </p>

                        {notif.link && notif.link !== "/" && (
                          <div className="pt-1.5 flex items-center gap-1 text-[10.5px] font-semibold text-[#1F5C4D] dark:text-[#34D399] group-hover:underline">
                            <span>Open details</span>
                            <ArrowRight className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>

                      {/* Unread indicator dot */}
                      {isUnread && (
                        <div className="shrink-0 self-center pl-1">
                          <span
                            className="w-2 h-2 rounded-full bg-[#1F5C4D] block"
                            title="Unread"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer Link */}
            <div className="border-t border-[#E4E1DA] dark:border-[#2C3036] bg-[#FAF9F6] dark:bg-[#1F2328] p-2 text-center shrink-0">
              <Link
                href={fullHistoryUrl}
                onClick={handleClose}
                className="w-full py-1.5 px-3 text-xs font-semibold text-[#1F5C4D] dark:text-[#34D399] hover:text-[#17463A] dark:hover:text-[#6EE7B7] hover:bg-white dark:hover:bg-[#2A2E35] rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>View full notification center</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
