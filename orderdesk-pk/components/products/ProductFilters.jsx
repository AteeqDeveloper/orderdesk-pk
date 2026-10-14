"use client";

import { Search } from "lucide-react";
import Select from "@/components/ui/Select";
import { PRODUCT_STATUSES } from "@/lib/constants";
import { useProductFilters } from "@/hooks/useProducts";

export default function ProductFilters({ categories = [] }) {
  const { search, setSearch, category, setCategory, status, setStatus } =
    useProductFilters();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or SKU..."
          aria-label="Search products"
          className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-3.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600"
        />
      </div>

      <div className="flex gap-3">
        <div className="w-40">
          <Select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-36">
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {PRODUCT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
