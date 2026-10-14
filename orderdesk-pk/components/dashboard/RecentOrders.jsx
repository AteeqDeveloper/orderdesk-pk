import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatPKR, formatDate } from "@/lib/utils";

export default function RecentOrders({ orders = [] }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base text-ink-900">Recent orders</h2>
        <Link
          href="/dashboard/orders"
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          View all
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-ink-200 py-10 text-center">
          <p className="text-sm text-ink-500">No orders yet.</p>
          <p className="mt-1 text-sm text-ink-400">
            Orders you create will show up here.
          </p>
        </div>
      ) : (
        <div className="mt-4 -mx-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-ink-400">
                <th className="px-5 py-2 font-medium">Order</th>
                <th className="px-5 py-2 font-medium">Customer</th>
                <th className="px-5 py-2 font-medium">Total</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-t border-ink-100">
                  <td className="px-5 py-3 font-medium text-ink-900">
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="hover:text-brand-700"
                    >
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-ink-600">
                    {order.customers?.name || "—"}
                  </td>
                  <td className="px-5 py-3 text-ink-900">
                    {formatPKR(order.total_amount)}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={order.order_status} />
                  </td>
                  <td className="px-5 py-3 text-ink-500">
                    {formatDate(order.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
