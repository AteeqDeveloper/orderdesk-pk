import StatusBadge from "@/components/ui/StatusBadge";
import { ORDER_STATUSES } from "@/lib/constants";

const STATUS_LABELS = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export default function OrderStatusReport({ counts = {}, total = 0 }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-base text-ink-900">Order Status</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Breakdown by order status in selected period
          </p>
        </div>
        <span className="text-xs font-semibold text-ink-500">
          {total} total
        </span>
      </div>

      <ul className="mt-5 space-y-2.5">
        {ORDER_STATUSES.map((status) => {
          const count = counts[status] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;

          return (
            <li key={status}>
              <div className="mb-1 flex items-center justify-between">
                <StatusBadge status={status} type="order" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-400">{pct}%</span>
                  <span className="w-8 text-right text-sm font-semibold text-ink-900">
                    {count}
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
