import { notFound } from "next/navigation";
import { Mail, Phone, MapPin, Receipt, Wallet } from "lucide-react";
import { getServerUser, serverApiRequest } from "@/lib/serverApi";
import { getCustomerById, getCustomerOrders } from "@/services/customerService";
import StatCard from "@/components/dashboard/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import EditCustomerButton from "@/components/customers/EditCustomerButton";
import DeleteCustomerButton from "@/components/customers/DeleteCustomerButton";
import { formatPKR, formatDate } from "@/lib/utils";

export const metadata = {
  title: "Customer — OrderDesk PK",
};

export default async function CustomerDetailPage({ params }) {
  const user = await getServerUser();
  const [{ customer, error }, { orders, totalOrders }] = await Promise.all([
    getCustomerById(serverApiRequest, params.id),
    getCustomerOrders(serverApiRequest, params.id),
  ]);

  if (error || !customer) {
    notFound();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-xl text-ink-900">{customer.name}</h1>
          <p className="mt-1 text-sm text-ink-500">Customer details and order history.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <EditCustomerButton userId={user.id} customer={customer} />
          <DeleteCustomerButton
            customerId={customer.id}
            customerName={customer.name}
            redirectTo="/dashboard/customers"
            iconOnly={false}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard icon={Receipt} label="Total orders" value={totalOrders} />
        <StatCard icon={Wallet} label="Total spent" value={formatPKR(customer.total_spent)} />
      </div>

      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-base text-ink-900">Contact information</h2>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
            <div>
              <dt className="text-xs text-ink-400">Phone</dt>
              <dd className="text-sm text-ink-900">{customer.phone || "—"}</dd>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
            <div>
              <dt className="text-xs text-ink-400">Email</dt>
              <dd className="text-sm text-ink-900">{customer.email || "—"}</dd>
            </div>
          </div>

          <div className="flex items-start gap-2.5 sm:col-span-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
            <div>
              <dt className="text-xs text-ink-400">Address</dt>
              <dd className="text-sm text-ink-900">
                {[customer.address, customer.city].filter(Boolean).join(", ") || "—"}
              </dd>
            </div>
          </div>
        </dl>

        {customer.notes && (
          <div className="mt-4 rounded-lg bg-ink-50 px-3.5 py-3 text-sm text-ink-700">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-400">
              Notes
            </p>
            {customer.notes}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card sm:p-6">
        <h2 className="font-display text-base text-ink-900">Recent orders</h2>

        {orders.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Receipt}
              title="No orders yet"
              description="Orders placed by this customer will show up here."
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-ink-100">
            {orders.map((order) => (
              <li key={order.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-ink-900">{order.order_number}</p>
                  <p className="text-xs text-ink-400">{formatDate(order.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={order.order_status} />
                  <span className="font-medium text-ink-900">
                    {formatPKR(order.total_amount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
