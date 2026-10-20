import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, MapPin, Receipt, Calendar } from "lucide-react";
import { serverApiRequest } from "@/lib/serverApi";
import { getOrderById } from "@/services/orderService";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatPKR, formatDate } from "@/lib/utils";

export const metadata = {
  title: "Order Details — OrderDesk PK",
};

export default async function OrderDetailPage({ params }) {
  const { order, error } = await getOrderById(serverApiRequest, params.id);

  if (error || !order) {
    notFound();
  }

  const items = order.order_items || [];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/orders"
          className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
          aria-label="Back to orders"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-xl text-ink-900">
            Order {order.order_number}
          </h1>
          <p className="text-xs text-ink-400">
            Placed on {formatDate(order.created_at)}
          </p>
        </div>
      </div>

      {/* Order Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="space-y-1">
          <span className="text-xs text-ink-400">Current Status</span>
          <div className="flex items-center gap-2">
            <StatusBadge status={order.order_status} type="order" />
            <StatusBadge status={order.payment_status} type="payment" />
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-ink-400">Total Amount</span>
          <p className="font-display text-2xl text-ink-900">
            {formatPKR(order.total_amount)}
          </p>
        </div>
      </div>

      {/* Customer Info */}
      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-base text-ink-900">Customer Details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <User className="mt-0.5 h-4 w-4 text-ink-400" />
            <div>
              <dt className="text-xs text-ink-400">Name</dt>
              <dd className="text-sm font-medium text-ink-900">
                {order.customers?.name || "Customer"}
              </dd>
              {order.customers?.phone && (
                <p className="text-xs text-ink-500">{order.customers.phone}</p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <MapPin className="mt-0.5 h-4 w-4 text-ink-400" />
            <div>
              <dt className="text-xs text-ink-400">Shipping Address</dt>
              <dd className="text-sm font-medium text-ink-900">
                {[order.customers?.address, order.customers?.city]
                  .filter(Boolean)
                  .join(", ") || "No address specified"}
              </dd>
            </div>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-base text-ink-900">Order Items</h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">No item details recorded.</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-100">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-ink-900">
                    {item.products?.name || "Product Item"}
                  </p>
                  <p className="text-xs text-ink-400">
                    Qty: {item.quantity} &times; {formatPKR(item.unit_price)}
                  </p>
                </div>
                <span className="font-medium text-ink-900">
                  {formatPKR((item.quantity || 1) * (item.unit_price || 0))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
