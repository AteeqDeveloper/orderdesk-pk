import { cn } from "@/lib/utils";

/**
 * Generic report summary card.
 * tone: "default" | "success" | "warning" | "danger" | "info"
 */
export default function ReportCard({
  icon: Icon,
  label,
  value,
  subtext,
  tone = "default",
  className,
}) {
  const iconColors = {
    default: "bg-brand-50 text-brand-700 border-brand-100",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    danger: "bg-rose-50 text-rose-700 border-rose-100",
    info: "bg-blue-50 text-blue-700 border-blue-100",
  };

  const valueColors = {
    default: "text-ink-900",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-rose-700",
    info: "text-blue-700",
  };

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border border-ink-100 bg-white p-5 shadow-card transition-all hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-500 leading-tight">
          {label}
        </span>
        {Icon && (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
              iconColors[tone] || iconColors.default
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="mt-3">
        <p
          className={cn(
            "font-display text-2xl font-bold tracking-tight",
            valueColors[tone] || valueColors.default
          )}
        >
          {value}
        </p>
        {subtext && (
          <p className="mt-0.5 text-[11px] text-ink-400">{subtext}</p>
        )}
      </div>
    </div>
  );
}
