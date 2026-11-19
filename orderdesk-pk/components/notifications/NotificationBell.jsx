"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, RefreshCw, X } from "lucide-react";
import {
  deleteNotification,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notificationService";
import NotificationFeed from "@/components/notifications/NotificationFeed";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    setActionError("");
    try {
      const result = await getNotifications(20);
      setNotifications(result.notifications || []);
      setUnreadCount(result.unreadCount || 0);
    } catch (requestError) {
      setError(requestError.message || "Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const pollUnreadCount = async () => {
      try {
        const count = await getUnreadNotificationCount();
        if (active) setUnreadCount(count);
      } catch {
        if (active) setError("Unread alerts could not be refreshed.");
      }
    };

    void pollUnreadCount();
    const intervalId = window.setInterval(pollUnreadCount, 30_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (open) void loadNotifications();
  }, [open, loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  async function handleMarkRead(notification) {
    try {
      await markNotificationRead(notification._id);
      setNotifications((current) =>
        current.map((item) =>
          item._id === notification._id ? { ...item, isRead: true } : item
        )
      );
      if (!notification.isRead) {
        setUnreadCount((current) => Math.max(0, current - 1));
      }
      setActionError("");
    } catch (requestError) {
      setActionError(requestError.message || "Could not mark as read.");
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((current) =>
        current.map((item) => ({ ...item, isRead: true }))
      );
      setUnreadCount(0);
      setActionError("");
    } catch (requestError) {
      setActionError(requestError.message || "Could not mark alerts as read.");
    }
  }

  async function handleDelete(notification) {
    try {
      await deleteNotification(notification._id);
      setNotifications((current) =>
        current.filter((item) => item._id !== notification._id)
      );
      if (!notification.isRead) {
        setUnreadCount((current) => Math.max(0, current - 1));
      }
      setActionError("");
    } catch (requestError) {
      setActionError(requestError.message || "Could not delete notification.");
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-600 hover:bg-ink-50 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
        aria-label={
          unreadCount
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-ink-100 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink-900">
                Notifications
              </h2>
              <p className="text-xs text-ink-500">
                {unreadCount} unread
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {(error || actionError) && (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700"
            >
              <span>{actionError || error}</span>
              <button
                type="button"
                onClick={loadNotifications}
                className="inline-flex shrink-0 items-center gap-1 font-medium"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                Retry
              </button>
            </div>
          )}

          <div className="max-h-[min(65vh,28rem)] overflow-y-auto">
            {loading ? (
              <div className="space-y-3 p-4" aria-label="Loading notifications">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-16 animate-pulse rounded-lg bg-ink-50"
                  />
                ))}
              </div>
            ) : error && notifications.length === 0 ? null : (
              <NotificationFeed
                notifications={notifications}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
                onNavigate={() => setOpen(false)}
              />
            )}
          </div>

          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-ink-100 px-4 py-3 text-center text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
