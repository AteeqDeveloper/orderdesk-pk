"use client";

import { Search } from "lucide-react";
import { useCustomerFilters } from "@/hooks/useCustomers";

export default function CustomerFilters() {
  const { search, setSearch } = useCustomerFilters();

  return (
    <div className="relative max-w-md">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, phone or email..."
        aria-label="Search customers"
        className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-3.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600"
      />
    </div>
  );
}
