import { createClient } from "@/lib/supabase/server";
import { getCustomers } from "@/services/customerService";
import CustomerFilters from "@/components/customers/CustomerFilters";
import CustomersTable from "@/components/customers/CustomersTable";
import AddCustomerButton from "@/components/customers/AddCustomerButton";

export const metadata = {
  title: "Customers — OrderDesk PK",
};

export default async function CustomersPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const search = searchParams?.search || "";
  const hasFilters = Boolean(search);

  const { customers, error } = await getCustomers(supabase, user.id, { search });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl text-ink-900">Customers</h1>
          <p className="mt-1 text-sm text-ink-500">Keep track of who you sell to.</p>
        </div>
        <AddCustomerButton userId={user.id} />
      </div>

      <CustomerFilters />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          Couldn&apos;t load customers. Please refresh the page.
        </div>
      ) : (
        <CustomersTable customers={customers} hasFilters={hasFilters} />
      )}
    </div>
  );
}
