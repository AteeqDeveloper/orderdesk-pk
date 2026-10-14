import Link from "next/link";
import { Users2 } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import DeleteCustomerButton from "@/components/customers/DeleteCustomerButton";
import { formatPKR } from "@/lib/utils";

export default function CustomersTable({ customers, hasFilters }) {
  if (customers.length === 0) {
    return (
      <EmptyState
        icon={Users2}
        title={hasFilters ? "No customers match your search" : "No customers yet"}
        description={
          hasFilters
            ? "Try a different name, phone or email."
            : "Add your first customer to start tracking their orders."
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card">
      {/* Desktop / tablet table */}
      <table className="hidden w-full text-left text-sm sm:table">
        <thead className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-5 py-3 font-medium">Name</th>
            <th className="px-5 py-3 font-medium">Phone</th>
            <th className="px-5 py-3 font-medium">City</th>
            <th className="px-5 py-3 font-medium">Orders</th>
            <th className="px-5 py-3 font-medium">Total spent</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {customers.map((customer) => (
            <tr key={customer.id} className="hover:bg-ink-50/40">
              <td className="px-5 py-3">
                <Link
                  href={`/dashboard/customers/${customer.id}`}
                  className="font-medium text-ink-900 hover:text-brand-700"
                >
                  {customer.name}
                </Link>
                {customer.email && (
                  <p className="text-xs text-ink-400">{customer.email}</p>
                )}
              </td>
              <td className="px-5 py-3 text-ink-500">{customer.phone || "—"}</td>
              <td className="px-5 py-3 text-ink-500">{customer.city || "—"}</td>
              <td className="px-5 py-3 text-ink-900">{customer.total_orders ?? 0}</td>
              <td className="px-5 py-3 text-ink-900">{formatPKR(customer.total_spent)}</td>
              <td className="px-5 py-3">
                <div className="flex items-center justify-end gap-1">
                  <DeleteCustomerButton
                    customerId={customer.id}
                    customerName={customer.name}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <ul className="divide-y divide-ink-100 sm:hidden">
        {customers.map((customer) => (
          <li key={customer.id} className="flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <Link
                href={`/dashboard/customers/${customer.id}`}
                className="block truncate font-medium text-ink-900"
              >
                {customer.name}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                <span>{customer.phone || customer.city || "—"}</span>
                <span>&middot;</span>
                <span>{customer.total_orders ?? 0} orders</span>
                <span>&middot;</span>
                <span>{formatPKR(customer.total_spent)}</span>
              </div>
            </div>
            <DeleteCustomerButton
              customerId={customer.id}
              customerName={customer.name}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
