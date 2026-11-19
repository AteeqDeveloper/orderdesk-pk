"use client";

import { formatPKR } from "@/lib/utils";

const INTERVALS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

function formatBucketDate(value, interval) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toLocaleDateString("en-PK", {
    timeZone: "UTC",
    day: interval === "monthly" ? undefined : "numeric",
    month: "short",
    year: interval === "monthly" ? "2-digit" : undefined,
  });
}

export default function SalesChart({
  trend = [],
  interval = "daily",
  onIntervalChange,
}) {
  const values = trend.map((row) => Number(row.deliveredSales) || 0);
  const max = Math.max(...values, 1);
  const totalRevenue = values.reduce((sum, value) => sum + value, 0);
  const periodsWithSales = values.filter((value) => value > 0).length;
  const labelInterval =
    trend.length <= 7 ? 1 : trend.length <= 30 ? 5 : 10;
  const chartWidth = trend.length > 30 ? `${trend.length * 24}px` : "100%";

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base text-ink-900">Revenue over time</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Delivered, non-refunded order totals by creation date (UTC)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-right">
            <p className="font-display text-xl font-semibold text-ink-900">
              {formatPKR(totalRevenue)}
            </p>
            <p className="text-xs text-ink-400">
              {periodsWithSales} of {trend.length} periods with sales
            </p>
          </div>
          <label className="sr-only" htmlFor="sales-interval">
            Sales chart interval
          </label>
          <select
            id="sales-interval"
            value={interval}
            onChange={(event) => onIntervalChange(event.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
          >
            {INTERVALS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {trend.length === 0 ? (
        <p className="mt-6 text-center text-sm text-ink-400">
          No trend data is available for this range.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto pb-2">
          <div
            className="relative flex h-40 items-end gap-1"
            style={{ minWidth: chartWidth }}
            role="img"
            aria-label={`Delivered revenue by ${interval} period`}
          >
            {trend.map((row, index) => {
              const revenue = Number(row.deliveredSales) || 0;
              const height = Math.max((revenue / max) * 100, revenue > 0 ? 4 : 1);

              return (
                <div
                  key={row.date}
                  className="group relative flex h-full min-w-0 flex-1 items-end"
                  title={`${formatBucketDate(row.date, interval)} · ${formatPKR(revenue)} · ${row.deliveredSalesOrders || 0} delivered sales orders`}
                >
                  <div
                    className={`w-full rounded-t-sm ${
                      revenue > 0
                        ? "bg-brand-500 group-hover:bg-brand-600"
                        : "bg-ink-100"
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  {index % labelInterval === 0 && (
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-ink-400">
                      {formatBucketDate(row.date, interval)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {trend.length > 0 && totalRevenue === 0 && (
        <p className="mt-3 text-center text-xs text-ink-400">
          No delivered revenue was recorded in this period.
        </p>
      )}
    </div>
  );
}
