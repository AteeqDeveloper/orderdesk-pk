import Link from "next/link";
import { Plus } from "lucide-react";
import { serverApiRequest } from "@/lib/serverApi";
import { getProducts } from "@/services/productService";
import ProductFilters from "@/components/products/ProductFilters";
import ProductsTable from "@/components/products/ProductsTable";

export const metadata = {
  title: "Products — OrderDesk PK",
};

export default async function ProductsPage({ searchParams }) {
  const search = searchParams?.search || "";
  const category = searchParams?.category || "";
  const status = searchParams?.status || "";
  const hasFilters = Boolean(search || category || status);

  const { products, categories = [], error } = await getProducts(serverApiRequest, {
    search,
    category,
    status,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl text-ink-900">Products</h1>
          <p className="mt-1 text-sm text-ink-500">
            Manage what you sell, prices and stock levels.
          </p>
        </div>
        <Link
          href="/dashboard/products/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add product
        </Link>
      </div>

      <ProductFilters categories={categories} />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          Couldn&apos;t load products. Please refresh the page.
        </div>
      ) : (
        <ProductsTable products={products} hasFilters={hasFilters} />
      )}
    </div>
  );
}
