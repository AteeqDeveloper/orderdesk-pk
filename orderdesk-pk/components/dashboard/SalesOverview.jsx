import { formatPKR } from "@/lib/utils";

// A plain CSS bar chart — no charting library needed for 7 bars, and it
// keeps the dependency list exactly what was asked for.
export default function SalesOverview({ days = [] }) {
  const max = Math.max(...days.map((d) => d.total), 1);

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <h2 className="font-display text-base text-ink-900">Delivered sales</h2>
      <p className="mt-0.5 text-sm text-ink-500">Last 7 days</p>

      <div className="mt-6 flex items-end gap-3 sm:gap-4" style={{ height: 140 }}>
        {days.map((day) => {
          const heightPct = Math.max((day.total / max) * 100, day.total > 0 ? 6 : 2);
          return (
            <div key={day.dateKey} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-full w-full items-end">
                <div
                  className="w-full rounded-t-md bg-brand-500 transition-all"
                  style={{ height: `${heightPct}%` }}
                  title={formatPKR(day.total)}
                />
              </div>
              <span className="text-[11px] text-ink-400">
                {day.date.toLocaleDateString("en-PK", { weekday: "short" })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
