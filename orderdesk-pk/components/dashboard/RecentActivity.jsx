import Link from "next/link";
import { Activity, Clock3 } from "lucide-react";

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

export default function RecentActivity({ logs = [], error }) {
  return (
    <section className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base text-ink-900">Recent activity</h2>
        <Link
          href="/dashboard/activity-logs"
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          View all
        </Link>
      </div>

      {error ? (
        <p role="alert" className="mt-5 text-sm text-red-700">
          Recent activity could not be loaded.
        </p>
      ) : logs.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-ink-200 py-8 text-center">
          <Activity className="mx-auto h-6 w-6 text-ink-300" aria-hidden="true" />
          <p className="mt-2 text-sm text-ink-500">No activity yet.</p>
        </div>
      ) : (
        <ol className="mt-4 divide-y divide-ink-100">
          {logs.slice(0, 5).map((log) => (
            <li key={log._id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Activity className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-800">
                  {log.description}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  {formatLabel(log.action)}
                  {log.metadata?.entityName ? ` · ${log.metadata.entityName}` : ""}
                  {log.metadata?.variantName ? ` / ${log.metadata.variantName}` : ""}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-ink-400">
                  <Clock3 className="h-3 w-3" aria-hidden="true" />
                  <time dateTime={log.createdAt}>
                    {formatTimestamp(log.createdAt)}
                  </time>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
