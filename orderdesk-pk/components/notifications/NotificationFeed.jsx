import Link from "next/link";
import { Bell, Check, ExternalLink, Trash2 } from "lucide-react";

const TYPE_PRESENTATION = {
  low_stock: {
    label: "Low stock",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-800",
  },
  out_of_stock: {
    label: "Out of stock",
    dot: "bg-rose-500",
    badge: "bg-rose-50 text-rose-800",
  },
  order_update: {
    label: "Order update",
    dot: "bg-brand-500",
    badge: "bg-brand-50 text-brand-800",
  },
  system: {
    label: "System",
    dot: "bg-ink-400",
    badge: "bg-ink-50 text-ink-700",
  },
};

function notificationHref(notification) {
  if (notification.relatedType === "order") {
    return `/dashboard/orders/${notification.relatedId}`;
  }
  if (
    notification.relatedType === "product" ||
    notification.relatedType === "variant"
  ) {
    return `/dashboard/products/${
      notification.relatedProductId || notification.relatedId
    }`;
  }
  return null;
}

function formatRelativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];
  const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const unit = units.find(([, duration]) => Math.abs(seconds) >= duration);
  if (!unit) return relative.format(seconds, "second");
  return relative.format(Math.round(seconds / unit[1]), unit[0]);
}

export default function NotificationFeed({
  notifications = [],
  onMarkRead,
  onDelete,
  onNavigate,
}) {
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center px-5 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-50">
          <Bell className="h-5 w-5 text-ink-400" aria-hidden="true" />
        </span>
        <p className="mt-3 text-sm font-medium text-ink-700">
          You&apos;re all caught up
        </p>
        <p className="mt-1 text-xs text-ink-400">
          New order and stock alerts will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-ink-100">
      {notifications.map((notification) => {
        const presentation =
          TYPE_PRESENTATION[notification.type] || TYPE_PRESENTATION.system;
        const href = notificationHref(notification);
        const dateValue = notification.updatedAt || notification.createdAt;

        return (
          <li
            key={notification._id}
            className={`px-4 py-3 ${
              notification.isRead ? "bg-white" : "bg-brand-50/60"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${presentation.dot}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={`text-sm ${
                      notification.isRead
                        ? "font-medium text-ink-800"
                        : "font-semibold text-ink-900"
                    }`}
                  >
                    {notification.title}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${presentation.badge}`}
                  >
                    {presentation.label}
                  </span>
                </div>
                <p className="mt-1 break-words text-xs leading-5 text-ink-600">
                  {notification.message}
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <time
                    dateTime={dateValue}
                    title={
                      dateValue
                        ? new Date(dateValue).toLocaleString("en-PK")
                        : undefined
                    }
                    className="text-[11px] text-ink-400"
                  >
                    {formatRelativeTime(dateValue)}
                  </time>
                  <div className="flex items-center gap-1">
                    {href && (
                      <Link
                        href={href}
                        onClick={() => {
                          if (!notification.isRead) onMarkRead(notification);
                          onNavigate?.();
                        }}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                      >
                        View
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    )}
                    {!notification.isRead && (
                      <button
                        type="button"
                        onClick={() => onMarkRead(notification)}
                        className="rounded p-1.5 text-ink-400 hover:bg-white hover:text-brand-700"
                        aria-label="Mark notification as read"
                        title="Mark as read"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(notification)}
                      className="rounded p-1.5 text-ink-400 hover:bg-white hover:text-rose-600"
                      aria-label="Delete notification"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
