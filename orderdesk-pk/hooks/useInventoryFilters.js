"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function useInventoryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("search") || "");

  function updateParam(key, value) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  // Debounce the search input
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (search !== (searchParams.get("search") || "")) {
        updateParam("search", search);
      }
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function resetFilters() {
    startTransition(() => {
      router.push(pathname);
    });
    setSearch("");
  }

  return {
    search,
    setSearch,
    category: searchParams.get("category") || "",
    setCategory: (value) => updateParam("category", value),
    stockStatus: searchParams.get("stockStatus") || "",
    setStockStatus: (value) => updateParam("stockStatus", value),
    resetFilters,
    hasActiveFilters: Boolean(
      (searchParams.get("search") || "") ||
      (searchParams.get("category") || "") ||
      (searchParams.get("stockStatus") || "")
    ),
    isPending,
  };
}
