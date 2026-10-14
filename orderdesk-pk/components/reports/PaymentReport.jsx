import StatusBadge from "@/components/ui/StatusBadge";
import { PAYMENT_STATUSES, PAYMENT_METHODS } from "@/lib/constants";
import { formatPKR } from "@/lib/utils";

const PAYMENT_STATUS_COLORS = {
  paid: "bg-emerald-500",
  unpaid: "bg-rose-500",
  partial: "bg-amber-500",
  refunded: "bg-ink-400",
};

export default function PaymentReport({ statusCounts = {}, methodCounts = {}, total = 0 }) {
  const methodsWithData = PAYMENT_METHODS.filter(
    (m) => methodCounts[m.value]?.count > 0
  );

  return (
    <div className="space-y-4">
      {/* Payment Status */}
      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-base text-ink-900">Payment Status</h2>
            <p className="mt-0.5 text-sm text-ink-500">Based on orders.payment_status</p>
          </div>
          <span className="text-xs font-semibold text-ink-500">{total} orders</span>
        </div>

        <ul className="mt-5 space-y-2.5">
          {PAYMENT_STATUSES.map((status) => {
            const count = statusCounts[status] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;

            return (
              <li key={status}>
                <div className="mb-1 flex items-center justify-between">
                  <StatusBadge status={status} type="payment" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-400">{pct}%</span>
                    <span className="w-8 text-right text-sm font-semibold text-ink-900">
                      {count}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                  <div
                    className={`h-full rounded-full transition-all ${PAYMENT_STATUS_COLORS[status] || "bg-ink-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Payment Methods */}
      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="font-display text-base text-ink-900">Payment Methods</h2>
        <p className="mt-0.5 text-sm text-ink-500">Based on orders.payment_method</p>

        {methodsWithData.length === 0 ? (
          <p className="mt-4 text-sm text-ink-400">
            No payment method data for this period.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-100">
            {methodsWithData.map((m) => {
              const data = methodCounts[m.value];
              return (
                <li key={m.value} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="text-sm font-medium text-ink-900">{m.label}</span>
                    <p className="text-xs text-ink-400">{data.count} orders</p>
                  </div>
                  <span className="text-sm font-semibold text-ink-900">
                    {formatPKR(data.total)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
