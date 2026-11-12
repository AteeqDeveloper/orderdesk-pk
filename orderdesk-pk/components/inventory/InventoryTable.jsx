"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PackageSearch,
  SlidersHorizontal,
} from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ProductImage from "@/components/ui/ProductImage";
import StockAdjustmentModal from "@/components/inventory/StockAdjustmentModal";
import { formatPKR, formatDate } from "@/lib/utils";
import { getProductStockStatus } from "@/services/inventoryService";

function ProductThumb({ product }) {
  return (
    <ProductImage
      src={product.image_url}
      className="h-11 w-11 rounded-lg border border-ink-100"
    />
  );
}

export default function InventoryTable({ products, hasFilters }) {
  const router = useRouter();
  const [adjustingProduct, setAdjustingProduct] = useState(null);
  // Track local overrides so updates reflect immediately without a full page reload
  const [stockOverrides, setStockOverrides] = useState({});

  if (products.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title={hasFilters ? "No products match your filters" : "No inventory records yet"}
        description={
          hasFilters
            ? "Try a different search term, category or stock status filter."
            : "Add products to start tracking inventory levels."
        }
      />
    );
  }

  function getDisplayProduct(product) {
    if (stockOverrides[product.id] !== undefined) {
      return { ...product, stock: stockOverrides[product.id] };
    }
    return product;
  }

  function handleStockUpdated(updatedProduct) {
    if (updatedProduct) {
      setStockOverrides((prev) => ({
        ...prev,
        [updatedProduct.id]: updatedProduct.stock,
      }));
    }
    // Also do a soft router refresh for fresh server data
    router.refresh();
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card">
        {/* Desktop table */}
        <div className="overflow-x-auto">
          <table className="hidden w-full min-w-[900px] text-left text-sm sm:table">
            <thead className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">Threshold</th>
                <th className="px-4 py-3 font-medium">Cost Price</th>
                <th className="px-4 py-3 font-medium">Sell Price</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {products.map((rawProduct) => {
                const product = getDisplayProduct(rawProduct);
                const stockStatus = getProductStockStatus(
                  product.stock,
                  product.low_stock_threshold
                );
                return (
                  <tr key={product.id} className="hover:bg-ink-50/40">
                    {/* Product */}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <ProductThumb product={product} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink-900 max-w-[180px]">
                            {product.name}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* SKU */}
                    <td className="px-5 py-3 font-mono text-xs text-ink-500">
                      {product.sku || "—"}
                    </td>

                    {/* Category */}
                    <td className="px-5 py-3 text-ink-500">
                      {product.category || "—"}
                    </td>

                    {/* Stock */}
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          stockStatus === "out_of_stock"
                            ? "text-rose-600"
                            : stockStatus === "low_stock"
                            ? "text-amber-600"
                            : "text-ink-900"
                        }`}
                      >
                        {product.stock ?? 0}
                      </span>
                    </td>

                    {/* Threshold */}
                    <td className="px-4 py-3 text-ink-500">
                      {product.low_stock_threshold ?? "—"}
                    </td>

                    {/* Cost Price */}
                    <td className="px-4 py-3 text-ink-700">
                      {product.cost_price != null
                        ? formatPKR(product.cost_price)
                        : "—"}
                    </td>

                    {/* Selling Price */}
                    <td className="px-4 py-3 font-medium text-ink-900">
                      {formatPKR(product.price)}
                    </td>

                    {/* Stock Status Badge */}
                    <td className="px-4 py-3">
                      <StatusBadge status={stockStatus} type="inventory" />
                    </td>

                    {/* Last Updated */}
                    <td className="px-4 py-3 text-xs text-ink-400">
                      {formatDate(product.updated_at || product.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setAdjustingProduct(rawProduct)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                        aria-label={`Adjust stock for ${product.name}`}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Adjust
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="divide-y divide-ink-100 sm:hidden">
          {products.map((rawProduct) => {
            const product = getDisplayProduct(rawProduct);
            const stockStatus = getProductStockStatus(
              product.stock,
              product.low_stock_threshold
            );
            return (
              <li key={product.id} className="px-4 py-4">
                <div className="flex items-start gap-3">
                  <ProductThumb product={product} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-900">{product.name}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      SKU: {product.sku || "—"} · {product.category || "Uncategorized"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-600">
                      <span>Stock: <strong className="text-ink-900">{product.stock ?? 0}</strong></span>
                      <span>·</span>
                      <span>Threshold: <strong>{product.low_stock_threshold ?? "—"}</strong></span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={stockStatus} type="inventory" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdjustingProduct(rawProduct)}
                    className="shrink-0 rounded-lg border border-ink-200 bg-white p-2 text-ink-600 hover:bg-brand-50 hover:text-brand-700"
                    aria-label={`Adjust stock for ${product.name}`}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Modals */}
      <StockAdjustmentModal
        product={adjustingProduct}
        open={Boolean(adjustingProduct)}
        onClose={() => setAdjustingProduct(null)}
        onUpdated={handleStockUpdated}
      />

    </>
  );
}
