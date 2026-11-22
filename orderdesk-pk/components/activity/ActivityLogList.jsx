"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
  Search,
} from "lucide-react";
import { getActivityLogs } from "@/services/activityLogService";

const PAGE_SIZE = 20;

const ACTIONS = [
  "product_created",
  "product_updated",
  "product_deleted",
  "customer_created",
  "customer_updated",
  "customer_deleted",
  "order_created",
  "order_status_changed",
  "payment_status_changed",
  "order_cancelled",
  "stock_increased",
  "stock_decreased",
  "low_stock_threshold_updated",
  "variant_created",
  "variant_updated",
  "variant_deleted",
  "notification_read",
  "notification_deleted",
];

const ENTITY_TYPES = [
  "product",
  "customer",
  "order",
  "inventory",
  "variant",
  "notification",
];

const formatLabel = (value = "") =>
  value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const formatTimestamp = (value) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

function ActivitySkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading activity" aria-live="polite">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-xl border border-ink-100 bg-white p-5"
        >
          <div className="h-4 w-2/5 rounded bg-ink-100" />
          <div className="mt-3 h-3 w-1/4 rounded bg-ink-100" />
          <div className="mt-5 h-3 w-1/3 rounded bg-ink-100" />
        </div>
      ))}
    </div>
  );
}

function ActivityDetails({ metadata = {} }) {
  const detailLabels = {
    previousStatus: "Previous status",
    orderStatus: "Order status",
    paymentStatus: "Payment status",
    previousStock: "Previous stock",
    stock: "Current stock",
    change: "Stock change",
    previousThreshold: "Previous threshold",
    threshold: "Current threshold",
    count: "Notifications",
    totalAmount: "Order total",
  };
  const details = Object.entries(detailLabels).filter(
    ([key]) => metadata[key] !== undefined
  );

  if (details.length === 0) return null;

  return (
    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-500">
      {details.map(([key, label]) => (
        <div key={key} className="flex gap-1">
          <dt>{label}:</dt>
          <dd className="font-medium text-ink-700">{String(metadata[key])}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActivityEntries({ logs }) {
  return (
    <ol className="divide-y divide-ink-100">
      {logs.map((log) => (
        <li key={log._id} className="flex gap-4 py-5 first:pt-0 last:pb-0">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <Activity className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-ink-900">
                {log.description}
              </p>
              <span className="rounded-full bg-ink-50 px-2 py-0.5 text-xs text-ink-600">
                {formatLabel(log.action)}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              {formatLabel(log.entityType)}
              {log.metadata?.entityName ? ` · ${log.metadata.entityName}` : ""}
              {log.metadata?.variantName ? ` / ${log.metadata.variantName}` : ""}
              {log.entityId ? ` · #${String(log.entityId).slice(-6)}` : ""}
            </p>
            <ActivityDetails metadata={log.metadata} />
            <p className="mt-2 flex items-center gap-1 text-xs text-ink-400">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              <time dateTime={log.createdAt}>
                {formatTimestamp(log.createdAt)}
              </time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function ActivityLogList() {
  const [filters, setFilters] = useState({
    search: "",
    action: "",
    entityType: "",
    startDate: "",
    endDate: "",
  });
  const [page, setPage] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getActivityLogs({ ...filters, page: String(page), limit: String(PAGE_SIZE) })
      .then((result) => {
        if (!active) return;
        setLogs(result.logs || []);
        setPagination(result.pagination || { page: 1, pages: 0, total: 0 });
      })
      .catch((requestError) => {
        if (active) setError(requestError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filters, page, retryCount]);

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="space-y-5">
      <div className="grid gap-3 rounded-xl border border-ink-100 bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Search activities</span>
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search activities"
            className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <label>
          <span className="sr-only">Filter by action</span>
          <select
            value={filters.action}
            onChange={(event) => updateFilter("action", event.target.value)}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="">All actions</option>
            {ACTIONS.map((action) => (
              <option key={action} value={action}>
                {formatLabel(action)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Filter by entity</span>
          <select
            value={filters.entityType}
            onChange={(event) => updateFilter("entityType", event.target.value)}
            className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="">All entities</option>
            {ENTITY_TYPES.map((entity) => (
              <option key={entity} value={entity}>
                {formatLabel(entity)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Activities from date</span>
          <input
            type="date"
            value={filters.startDate}
            max={filters.endDate || undefined}
            onChange={(event) => updateFilter("startDate", event.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-700 focus:border-brand-500 focus:outline-none"
          />
        </label>

        <label>
          <span className="sr-only">Activities through date</span>
          <input
            type="date"
            value={filters.endDate}
            min={filters.startDate || undefined}
            onChange={(event) => updateFilter("endDate", event.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-700 focus:border-brand-500 focus:outline-none"
          />
        </label>
      </div>

      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
        {loading ? (
          <ActivitySkeleton />
        ) : error ? (
          <div role="alert" className="py-10 text-center">
            <p className="text-sm text-red-700">
              Activity logs could not be loaded.
            </p>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center">
            <Activity className="mx-auto h-8 w-8 text-ink-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-ink-700">
              No activity found
            </p>
            <p className="mt-1 text-sm text-ink-500">
              {filters.search || filters.action || filters.entityType || filters.startDate || filters.endDate
                ? "Try changing or clearing your filters."
                : "Successful actions in your account will appear here."}
            </p>
          </div>
        ) : (
          <>
            <ActivityEntries logs={logs} />
            <div className="mt-5 flex items-center justify-between border-t border-ink-100 pt-4">
              <p className="text-xs text-ink-500">
                {pagination.total} {pagination.total === 1 ? "activity" : "activities"}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-lg border border-ink-200 p-2 text-ink-600 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <span className="min-w-20 text-center text-xs text-ink-500">
                  Page {page} of {Math.max(pagination.pages, 1)}
                </span>
                <button
                  type="button"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-lg border border-ink-200 p-2 text-ink-600 hover:bg-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
