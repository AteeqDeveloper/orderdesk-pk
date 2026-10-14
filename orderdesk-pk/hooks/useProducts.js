"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Keeps the products list's search/filter controls in sync with the URL
 * query string, so the server component page (app/dashboard/products/page.js)
 * re-runs its Supabase query with the new filters. The search input is
 * debounced so we don't push a new URL on every keystroke.
 */
export function useProductFilters() {
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

  // Debounce the search box so typing doesn't trigger a navigation per key.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (search !== (searchParams.get("search") || "")) {
        updateParam("search", search);
      }
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return {
    search,
    setSearch,
    category: searchParams.get("category") || "",
    setCategory: (value) => updateParam("category", value),
    status: searchParams.get("status") || "",
    setStatus: (value) => updateParam("status", value),
    isPending,
  };
}
