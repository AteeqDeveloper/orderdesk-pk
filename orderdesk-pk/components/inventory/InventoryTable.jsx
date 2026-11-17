"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageSearch, SlidersHorizontal } from "lucide-react";
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

function getVariantLabel(variant) {
  return [variant?.size, variant?.color].filter(Boolean).join(" / ") || "—";
}

export default function InventoryTable({ products, hasFilters }) {
  const router = useRouter();
  const [adjustingProduct, setAdjustingProduct] = useState(null);

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

  const rows = products.flatMap((product) => {
    if (product.has_variants && product.variants.length > 0) {
      return product.variants.map((variant) => ({ product, variant }));
    }
    return [{ product, variant: null }];
  });

  function openAdjustment(product, variant) {
    setAdjustingProduct({
      ...product,
      stock: variant ? variant.stock : product.stock,
      variant: variant || null,
    });
  }

  function handleStockUpdated() {
    router.refresh();
  }

  function renderStatus(variant, status) {
    if (variant?.status === "inactive") {
      return (
        <span className="text-xs font-medium text-ink-400">Inactive variant</span>
      );
    }
    return <StatusBadge status={status} type="inventory" />;
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="hidden w-full min-w-[1050px] text-left text-sm sm:table">
            <thead className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Variant</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Category</th>
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
              {rows.map(({ product, variant }) => {
                const stock = variant ? variant.stock : product.stock;
                const threshold = variant
                  ? variant.lowStockThreshold
                  : product.low_stock_threshold;
                const stockStatus = getProductStockStatus(stock, threshold);
                const rowKey = `${product.id}-${variant?.id || "product"}`;
                return (
                  <tr key={rowKey} className="hover:bg-ink-50/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <ProductThumb product={product} />
                        <p className="max-w-[180px] truncate font-medium text-ink-900">
                          {product.name}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {variant ? getVariantLabel(variant) : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-500">
                      {variant?.sku || product.sku || "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-500">
                      {product.category || "—"}
                    </td>
                    <td
                      className={`px-4 py-3 font-semibold ${
                        stockStatus === "out_of_stock"
                          ? "text-rose-600"
                          : stockStatus === "low_stock"
                          ? "text-amber-600"
                          : "text-ink-900"
                      }`}
                    >
                      {stock ?? 0}
                    </td>
                    <td className="px-4 py-3 text-ink-500">{threshold ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-700">
                      {formatPKR(
                        variant ? variant.costPrice : product.cost_price
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink-900">
                      {formatPKR(variant ? variant.price : product.price)}
                    </td>
                    <td className="px-4 py-3">
                      {renderStatus(variant, stockStatus)}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-400">
                      {formatDate(product.updated_at || product.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openAdjustment(product, variant)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
                        aria-label={`Adjust stock for ${product.name}${
                          variant ? ` ${getVariantLabel(variant)}` : ""
                        }`}
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

        <ul className="divide-y divide-ink-100 sm:hidden">
          {rows.map(({ product, variant }) => {
            const stock = variant ? variant.stock : product.stock;
            const threshold = variant
              ? variant.lowStockThreshold
              : product.low_stock_threshold;
            const stockStatus = getProductStockStatus(stock, threshold);
            const rowKey = `${product.id}-${variant?.id || "product"}`;
            return (
              <li key={rowKey} className="px-4 py-4">
                <div className="flex items-start gap-3">
                  <ProductThumb product={product} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink-900">{product.name}</p>
                    {variant && (
                      <p className="mt-0.5 text-xs text-ink-600">
                        {getVariantLabel(variant)}
                      </p>
                    )}
                    <p className="mt-0.5 truncate font-mono text-xs text-ink-500">
                      SKU: {variant?.sku || product.sku || "—"} ·{" "}
                      {product.category || "Uncategorized"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-600">
                      <span>
                        Stock: <strong className="text-ink-900">{stock ?? 0}</strong>
                      </span>
                      <span>·</span>
                      <span>
                        Threshold: <strong>{threshold ?? "—"}</strong>
                      </span>
                    </div>
                    <div className="mt-2">
                      {renderStatus(variant, stockStatus)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAdjustment(product, variant)}
                    className="shrink-0 rounded-lg border border-ink-200 bg-white p-2 text-ink-600 hover:bg-brand-50 hover:text-brand-700"
                    aria-label={`Adjust stock for ${product.name}${
                      variant ? ` ${getVariantLabel(variant)}` : ""
                    }`}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <StockAdjustmentModal
        product={adjustingProduct}
        open={Boolean(adjustingProduct)}
        onClose={() => setAdjustingProduct(null)}
        onUpdated={handleStockUpdated}
      />
    </>
  );
}
