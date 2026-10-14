import StatusBadge from "@/components/ui/StatusBadge";
import { ORDER_STATUSES } from "@/lib/constants";

export default function OrderStatusSummary({ counts = {} }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <h2 className="font-display text-base text-ink-900">Order status</h2>
      <p className="mt-0.5 text-sm text-ink-500">Across all orders</p>

      <ul className="mt-5 space-y-3">
        {ORDER_STATUSES.map((status) => (
          <li key={status} className="flex items-center justify-between">
            <StatusBadge status={status} />
            <span className="text-sm font-medium text-ink-700">
              {counts[status] ?? 0}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
