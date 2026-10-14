"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "3m", label: "Last 3 Months" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

export default function DateFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activePreset = searchParams.get("datePreset") || "30d";
  const customFrom = searchParams.get("from") || "";
  const customTo = searchParams.get("to") || "";
  const [localFrom, setLocalFrom] = useState(customFrom);
  const [localTo, setLocalTo] = useState(customTo);

  function navigate(params) {
    const p = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => {
      if (v) p.set(k, v);
      else p.delete(k);
    });
    startTransition(() => router.push(`${pathname}?${p.toString()}`));
  }

  function selectPreset(preset) {
    if (preset !== "custom") {
      navigate({ datePreset: preset, from: "", to: "" });
    } else {
      navigate({ datePreset: "custom" });
    }
  }

  function applyCustomRange() {
    if (!localFrom || !localTo) return;
    navigate({ datePreset: "custom", from: localFrom, to: localTo });
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
              onClick={() => selectPreset(preset.value)}
              disabled={isPending}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                activePreset === preset.value
                  ? "bg-brand-700 text-white"
                  : "border border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {isPending && (
          <Loader2 className="h-4 w-4 animate-spin text-ink-400" />
        )}
      </div>

      {/* Custom date pickers */}
      {activePreset === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-500">From:</span>
          <input
            type="date"
            value={localFrom}
            onChange={(e) => setLocalFrom(e.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
          />
          <span className="text-xs text-ink-500">To:</span>
          <input
            type="date"
            value={localTo}
            onChange={(e) => setLocalTo(e.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
          />
          <button
            type="button"
            onClick={applyCustomRange}
            disabled={!localFrom || !localTo || isPending}
            className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800 disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
