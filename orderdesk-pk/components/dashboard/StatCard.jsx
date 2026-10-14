import { cn } from "@/lib/utils";

export default function StatCard({ icon: Icon, label, value, tone = "default" }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-500">{label}</span>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            tone === "warning" ? "bg-clay-50 text-clay-600" : "bg-brand-50 text-brand-700"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 font-display text-2xl text-ink-900">{value}</p>
    </div>
  );
}
