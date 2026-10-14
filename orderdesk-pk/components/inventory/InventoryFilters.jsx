"use client";

import { Search, X, Loader2 } from "lucide-react";
import Select from "@/components/ui/Select";
import { INVENTORY_STATUSES } from "@/lib/constants";
import { useInventoryFilters } from "@/hooks/useInventoryFilters";

export default function InventoryFilters({ categories = [] }) {
  const {
    search,
    setSearch,
    category,
    setCategory,
    stockStatus,
    setStockStatus,
    resetFilters,
    hasActiveFilters,
    isPending,
  } = useInventoryFilters();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by product name or SKU..."
          aria-label="Search inventory"
          className="w-full rounded-lg border border-ink-200 bg-white py-2.5 pl-9 pr-8 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        />
        {isPending && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-400" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap">
        {/* Category filter */}
        <div className="w-full sm:w-44">
          <Select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        {/* Stock Status filter */}
        <div className="w-full sm:w-44">
          <Select
            aria-label="Filter by stock status"
            value={stockStatus}
            onChange={(e) => setStockStatus(e.target.value)}
          >
            <option value="">All Stock Statuses</option>
            {INVENTORY_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Reset Filters button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-xs font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
