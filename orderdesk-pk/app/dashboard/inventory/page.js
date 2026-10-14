import { Suspense } from "react";
import { Boxes } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getInventoryStats, getInventoryProducts } from "@/services/inventoryService";
import { getProductCategories } from "@/services/productService";
import InventoryDashboard from "@/components/inventory/InventoryDashboard";
import InventoryFilters from "@/components/inventory/InventoryFilters";
import InventoryTable from "@/components/inventory/InventoryTable";

export const metadata = {
  title: "Inventory — OrderDesk PK",
  description: "Track stock levels, low-stock alerts and inventory value for all your products.",
};

export default async function InventoryPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const search = searchParams?.search || "";
  const category = searchParams?.category || "";
  const stockStatus = searchParams?.stockStatus || "";
  const hasFilters = Boolean(search || category || stockStatus);

  const [{ stats, error: statsError }, { products, error: productsError }, { categories }] =
    await Promise.all([
      getInventoryStats(supabase, user.id).then((s) => ({ stats: s, error: s.error })),
      getInventoryProducts(supabase, user.id, { search, category, stockStatus }),
      getProductCategories(supabase, user.id),
    ]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-xl text-ink-900">Inventory</h1>
          <p className="mt-1 text-sm text-ink-500">
            Track stock levels, monitor low-stock alerts and calculate inventory value.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <Boxes className="h-4 w-4" />
          <span>Values calculated as stock × cost price</span>
        </div>
      </div>

      {/* Summary Stats */}
      {statsError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          Couldn&apos;t load inventory statistics. Please refresh the page.
        </div>
      ) : (
        <InventoryDashboard stats={stats} />
      )}

      {/* Filters */}
      <Suspense>
        <InventoryFilters categories={categories} />
      </Suspense>

      {/* Products Error */}
      {productsError ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          Couldn&apos;t load inventory products. Please refresh the page.
        </div>
      ) : (
        <InventoryTable products={products} hasFilters={hasFilters} />
      )}
    </div>
  );
}
