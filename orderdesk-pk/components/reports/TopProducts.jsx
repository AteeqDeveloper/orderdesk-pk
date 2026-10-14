import { Trophy, Package } from "lucide-react";
import { formatPKR } from "@/lib/utils";

/**
 * TopProducts — Server Component.
 * Receives pre-sorted product list from reportService.getTopProducts().
 * sortBy prop is passed from the parent for the UI label only.
 */
export default function TopProducts({ products = [], sortBy = "unitsSold" }) {
  const maxValue =
    sortBy === "revenue"
      ? Math.max(...products.map((p) => p.revenue), 1)
      : Math.max(...products.map((p) => p.unitsSold), 1);

  return (
    <div className="rounded-xl border border-ink-100 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base text-ink-900">Top Selling Products</h2>
          <p className="mt-0.5 text-sm text-ink-500">
            From non-cancelled/returned orders ·{" "}
            <span className="font-medium text-ink-700">
              sorted by {sortBy === "revenue" ? "revenue" : "units sold"}
            </span>
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
        <ol className="mt-5 space-y-3">
          {products.map((product, index) => {
            const barValue =
              sortBy === "revenue" ? product.revenue : product.unitsSold;
            const pct = Math.max((barValue / maxValue) * 100, 2);

            return (
              <li key={product.product_id} className="group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                        index === 0
                          ? "bg-amber-100 text-amber-700"
                          : index === 1
                          ? "bg-ink-100 text-ink-600"
                          : index === 2
                          ? "bg-clay-50 text-clay-700"
                          : "bg-ink-50 text-ink-400"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="truncate text-sm font-medium text-ink-900 max-w-[200px]">
                      {product.name}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold text-ink-900">
                      {product.unitsSold} units
                    </p>
                    <p className="text-xs text-ink-400">
                      {formatPKR(product.revenue)}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
