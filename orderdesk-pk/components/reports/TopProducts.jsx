import { Trophy, Package } from "lucide-react";
import { formatPKR } from "@/lib/utils";
import ProductImage from "@/components/ui/ProductImage";

export default function TopProducts({ products = [] }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base text-ink-900">Top Selling Products</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Delivered, non-refunded orders · ranked by units sold
          </p>
        </div>
        <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
      </div>

      {products.length === 0 ? (
        <div className="mt-6 flex flex-col items-center py-6 text-center text-sm text-ink-400">
          <Package className="mb-2 h-8 w-8 text-ink-200" />
          No sales data for this period.
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 font-medium">SKU</th>
                <th className="pb-2 text-right font-medium">Units</th>
                <th className="pb-2 text-right font-medium">Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
          {products.map((product, index) => {
            return (
              <tr key={`${product.productId}-${product.variantId || "product"}`}>
                <td className="py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-xs font-semibold text-ink-400">
                      {index + 1}
                    </span>
                    <ProductImage
                      src={product.imageUrl}
                      alt=""
                      className="h-9 w-9 rounded-md"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900">
                        {product.name}
                      </p>
                      {product.variant && (
                        <p className="truncate text-xs text-ink-400">
                          {[product.variant.size, product.variant.color]
                            .filter(Boolean)
                            .join(" / ") || "Variant"}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 text-xs text-ink-500">
                  {product.variant?.sku || product.sku || "—"}
                </td>
                <td className="py-3 text-right font-medium text-ink-800">
                  {Number(product.unitsSold) || 0}
                </td>
                <td className="py-3 text-right font-semibold text-ink-900">
                  {formatPKR(product.revenueGenerated)}
                </td>
              </tr>
            );
          })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
