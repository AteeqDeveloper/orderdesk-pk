import Link from "next/link";
import { Pencil, PackageSearch } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import EmptyState from "@/components/ui/EmptyState";
import ProductImage from "@/components/ui/ProductImage";
import DeleteProductButton from "@/components/products/DeleteProductButton";
import { formatPKR, cn } from "@/lib/utils";

function isLowStock(product) {
  if (product.has_variants && product.variants?.length) {
    return product.variants.some(
      (variant) =>
        variant.status === "active" &&
        Number(variant.stock) <= Number(variant.lowStockThreshold ?? 5)
    );
  }

  return (
    product.status !== "archived" &&
    Number(product.stock) <= Number(product.low_stock_threshold ?? 0)
  );
}

function getPriceLabel(product) {
  const prices = (product.variants || [])
    .filter((variant) => variant.status === "active")
    .map((variant) => Number(variant.price))
    .filter(Number.isFinite);

  if (prices.length === 0) return formatPKR(product.price);

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max
    ? formatPKR(min)
    : `${formatPKR(min)} – ${formatPKR(max)}`;
}

function getVariantSummary(product) {
  const variants = product.variants || [];
  if (!product.has_variants || variants.length === 0) return "";
  const activeVariants = variants.filter((variant) => variant.status === "active");

  const sizes = Array.from(
    new Set(activeVariants.map((variant) => variant.size).filter(Boolean))
  );
  const colors = Array.from(
    new Set(activeVariants.map((variant) => variant.color).filter(Boolean))
  );

  return [
    `${variants.length} ${variants.length === 1 ? "variant" : "variants"}`,
    sizes.length ? `Sizes ${sizes.join(", ")}` : "",
    colors.length ? `Colors ${colors.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function ProductThumb({ product }) {
  return (
    <ProductImage
      src={product.image_url}
      className="h-11 w-11 rounded-lg border border-ink-100"
    />
  );
}

export default function ProductsTable({ products, hasFilters }) {
  if (products.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title={hasFilters ? "No products match your filters" : "No products yet"}
        description={
          hasFilters
            ? "Try a different search term or clear the filters."
            : "Add your first product to start tracking stock and prices."
        }
        action={
          !hasFilters && (
            <Link
              href="/dashboard/products/new"
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Add a product &rarr;
            </Link>
          )
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-ink-100 bg-white shadow-card">
      {/* Desktop / tablet table */}
      <table className="hidden w-full text-left text-sm sm:table">
        <thead className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-5 py-3 font-medium">Product</th>
            <th className="px-5 py-3 font-medium">SKU</th>
            <th className="px-5 py-3 font-medium">Category</th>
            <th className="px-5 py-3 font-medium">Price</th>
            <th className="px-5 py-3 font-medium">Stock</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {products.map((product) => (
            <tr key={product.id} className="hover:bg-ink-50/40">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <ProductThumb product={product} />
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/products/${product.id}`}
                      className="font-medium text-ink-900 hover:text-brand-700"
                    >
                      {product.name}
                    </Link>
                    {getVariantSummary(product) && (
                      <p className="mt-0.5 max-w-[280px] truncate text-xs text-ink-500">
                        {getVariantSummary(product)}
                      </p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-5 py-3 text-ink-500">{product.sku || "—"}</td>
              <td className="px-5 py-3 text-ink-500">{product.category || "—"}</td>
              <td className="px-5 py-3 text-ink-900">{getPriceLabel(product)}</td>
              <td className="px-5 py-3">
                <span
                  className={cn(
                    "font-medium",
                    isLowStock(product) ? "text-clay-600" : "text-ink-900"
                  )}
                >
                  {product.stock}
                </span>
                {isLowStock(product) && (
                  <span className="ml-1.5 rounded-full bg-clay-50 px-2 py-0.5 text-xs font-medium text-clay-600">
                    Low stock
                  </span>
                )}
              </td>
              <td className="px-5 py-3">
                <StatusBadge status={product.status} type="product" />
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/dashboard/products/${product.id}`}
                    className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                    aria-label={`Edit ${product.name}`}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <DeleteProductButton productId={product.id} productName={product.name} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <ul className="divide-y divide-ink-100 sm:hidden">
        {products.map((product) => (
          <li key={product.id} className="flex items-center gap-3 px-4 py-3.5">
            <ProductThumb product={product} />
            <div className="min-w-0 flex-1">
              <Link
                href={`/dashboard/products/${product.id}`}
                className="block truncate font-medium text-ink-900"
              >
                {product.name}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                <span>{getPriceLabel(product)}</span>
                <span>&middot;</span>
                <span className={isLowStock(product) ? "font-medium text-clay-600" : ""}>
                  Stock: {product.stock}
                </span>
                <StatusBadge status={product.status} type="product" />
              </div>
              {getVariantSummary(product) && (
                <p className="mt-1 truncate text-xs text-ink-400">
                  {getVariantSummary(product)}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href={`/dashboard/products/${product.id}`}
                className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
                aria-label={`Edit ${product.name}`}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Link>
              <DeleteProductButton productId={product.id} productName={product.name} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
