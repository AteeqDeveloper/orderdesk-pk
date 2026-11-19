"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Bell, CheckCheck, RefreshCw } from "lucide-react";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notificationService";
import NotificationFeed from "@/components/notifications/NotificationFeed";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getNotifications(50);
      setNotifications(result.notifications || []);
      setUnreadCount(result.unreadCount || 0);
    } catch (requestError) {
      setError(requestError.message || "Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-display text-xl text-ink-900">Notifications</h1>
            <p className="mt-1 text-sm text-ink-500">
              Recent order updates and inventory alerts.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-600">
            {unreadCount} unread
          </span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {(error || actionError) && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {actionError || error}
          </span>
          <button
            type="button"
            onClick={loadNotifications}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-red-100"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card">
        {loading ? (
          <div className="space-y-3 p-5" aria-label="Loading notifications" aria-busy="true">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-lg bg-ink-50" />
            ))}
          </div>
        ) : error && notifications.length === 0 ? null : (
          <NotificationFeed
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onDelete={handleDelete}
          />
        )}
      </section>
    </div>
  );
}
