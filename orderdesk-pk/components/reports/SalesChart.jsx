"use client";

import { formatPKR } from "@/lib/utils";

/**
 * SalesChart — pure CSS bar chart, no extra dependencies.
 *
 * Props:
 *   buckets: Array<{ label: string, total: number, date: Date }>
 *   preset: string — used to format x-axis labels
 */
export default function SalesChart({ buckets = [], preset = "7d" }) {
  const max = Math.max(...buckets.map((b) => b.total), 1);
  const totalRevenue = buckets.reduce((s, b) => s + b.total, 0);
  const daysWithSales = buckets.filter((b) => b.total > 0).length;

  // Only show every Nth label on crowded charts
  const labelInterval = buckets.length <= 7 ? 1 : buckets.length <= 30 ? 5 : 10;

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base text-ink-900">Delivered Sales</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Revenue from delivered orders only
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-semibold text-ink-900">
            {formatPKR(totalRevenue)}
          </p>
          <p className="text-xs text-ink-400">
            {daysWithSales} of {buckets.length} days with sales
          </p>
        </div>
      </div>

      {/* Bar chart */}
      <div
        className="relative mt-6 flex items-end gap-0.5 sm:gap-1"
        style={{ height: 140 }}
        role="img"
        aria-label="Sales bar chart"
      >
        {buckets.map((bucket) => {
          const heightPct = Math.max(
            (bucket.total / max) * 100,
            bucket.total > 0 ? 4 : 1
          );

          return (
            <div
              key={bucket.dateKey}
              className="group relative flex flex-1 flex-col items-center"
              style={{ height: "100%" }}
            >
              {/* Tooltip */}
              <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 rounded-md bg-ink-900 px-2 py-1 text-[10px] font-medium text-white whitespace-nowrap shadow group-hover:block">
                {formatPKR(bucket.total)}
              </div>

              <div className="flex h-full w-full items-end">
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    bucket.total > 0
                      ? "bg-brand-500 group-hover:bg-brand-600"
                      : "bg-ink-100"
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="mt-2 flex gap-0.5 sm:gap-1">
        {buckets.map((bucket, i) => (
          <div
            key={bucket.dateKey + "_label"}
            className="flex-1 text-center"
          >
            <span
              className={`text-[10px] text-ink-400 ${
                i % labelInterval === 0 ? "" : "invisible"
              }`}
            >
              {bucket.label}
            </span>
          </div>
        ))}
      </div>

      {/* Empty state note */}
      {totalRevenue === 0 && (
        <p className="mt-3 text-center text-xs text-ink-400">
          No revenue recorded in this period.
        </p>
      )}
    </div>
  );
}
