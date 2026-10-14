import Link from "next/link";
import { Receipt, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrders } from "@/services/orderService";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import { formatPKR, formatDate } from "@/lib/utils";
import { ORDER_STATUSES } from "@/lib/constants";

export const metadata = {
  title: "Orders — OrderDesk PK",
};

export default async function OrdersPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const status = searchParams?.status || "";
  const search = searchParams?.search || "";
  const hasFilters = Boolean(status || search);

  const { orders, error } = await getOrders(supabase, user.id, {
    status,
    search,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl text-ink-900">Orders</h1>
          <p className="mt-1 text-sm text-ink-500">
            Track customer orders from placement through delivery.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 pb-3">
        <Link
          href="/dashboard/orders"
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            !status
              ? "bg-brand-50 text-brand-800"
              : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
          }`}
        >
          All
        </Link>
        {ORDER_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/dashboard/orders?status=${s}`}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              status === s
                ? "bg-brand-50 text-brand-800"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          Couldn&apos;t load orders. Please refresh the page.
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={hasFilters ? "No orders match your filter" : "No orders recorded yet"}
          description={
            hasFilters
              ? "Try selecting a different status filter."
              : "Orders from WhatsApp, Instagram, or direct sales will appear here."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card">
          <table className="hidden w-full text-left text-sm sm:table">
            <thead className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-5 py-3 font-medium">Order</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">City</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Order Status</th>
                <th className="px-5 py-3 font-medium">Payment</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-ink-50/40">
                  <td className="px-5 py-3 font-medium text-ink-900">
                    {order.order_number}
                  </td>
                  <td className="px-5 py-3 text-ink-600">
                    {order.customers?.name || "—"}
                  </td>
                  <td className="px-5 py-3 text-ink-500">
                    {order.customers?.city || "—"}
                  </td>
                  <td className="px-5 py-3 font-medium text-ink-900">
                    {formatPKR(order.total_amount)}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={order.order_status} type="order" />
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={order.payment_status} type="payment" />
                  </td>
                  <td className="px-5 py-3 text-ink-500">
                    {formatDate(order.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile view */}
          <ul className="divide-y divide-ink-100 sm:hidden">
            {orders.map((order) => (
              <li key={order.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink-900">{order.order_number}</span>
                  <span className="font-semibold text-ink-900">
                    {formatPKR(order.total_amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-ink-500">
                  <span>{order.customers?.name || "Customer"}</span>
                  <span>{formatDate(order.created_at)}</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <StatusBadge status={order.order_status} type="order" />
                  <StatusBadge status={order.payment_status} type="payment" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
