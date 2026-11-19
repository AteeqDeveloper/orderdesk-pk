"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "last7days", label: "Last 7 Days" },
  { value: "last30days", label: "Last 30 Days" },
  { value: "thisMonth", label: "This Month" },
  { value: "custom", label: "Custom Range" },
];

export default function DateFilter({
  period,
  startDate,
  endDate,
  loading,
  onPeriodChange,
  onApplyCustom,
}) {
  const [localFrom, setLocalFrom] = useState(startDate);
  const [localTo, setLocalTo] = useState(endDate);

  useEffect(() => {
    setLocalFrom(startDate);
    setLocalTo(endDate);
  }, [startDate, endDate]);

  function applyCustomRange() {
    if (!localFrom || !localTo || localFrom > localTo) return;
    onApplyCustom(localFrom, localTo);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays className="h-4 w-4 text-ink-400" aria-hidden="true" />
        <span className="text-xs font-medium text-ink-500">Date Range:</span>

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => onPeriodChange(preset.value)}
              disabled={loading}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                period === preset.value
                  ? "bg-brand-700 text-white"
                  : "border border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {loading && (
          <Loader2 className="h-4 w-4 animate-spin text-ink-400" />
        )}
      </div>

      {/* Custom date pickers */}
      {period === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-500">From:</span>
          <input
            type="date"
            value={localFrom}
            max={localTo || undefined}
            onChange={(e) => setLocalFrom(e.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
          />
          <span className="text-xs text-ink-500">To:</span>
          <input
            type="date"
            value={localTo}
            min={localFrom || undefined}
            onChange={(e) => setLocalTo(e.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
          />
          <button
            type="button"
            onClick={applyCustomRange}
            disabled={!localFrom || !localTo || localFrom > localTo || loading}
            className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
