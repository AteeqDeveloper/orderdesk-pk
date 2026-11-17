import { apiRequest } from "@/lib/api";

/**
 * Determine the stock status for a product based on its current stock
 * and low_stock_threshold.
 * 
 * Logic specified:
 * - stock === 0 -> "out_of_stock"
 * - stock <= low_stock_threshold -> "low_stock"
 * - otherwise -> "in_stock"
 */
export function getProductStockStatus(stock, threshold = 5) {
  const currentStock = Number(stock) || 0;
  const lowThreshold = Number(threshold ?? 5);

  if (currentStock === 0) {
    return "out_of_stock";
  }
  if (currentStock <= lowThreshold) {
    return "low_stock";
  }
  return "in_stock";
}

function mapProduct(product) {
  return {
    ...product,
    id: String(product._id || product.id),
    cost_price: product.costPrice ?? product.cost_price ?? 0,
    image_url: product.imageUrl ?? product.image_url ?? "",
    low_stock_threshold: product.lowStockThreshold ?? product.low_stock_threshold ?? 5,
    created_at: product.createdAt ?? product.created_at,
    has_variants: Boolean(product.hasVariants ?? product.has_variants),
    variants: Array.isArray(product.variants)
      ? product.variants.map((variant) => ({
          ...variant,
          id: String(variant._id || variant.id),
        }))
      : [],
  };
}

export function filterInventoryProducts(products, filters = {}) {
  let filtered = products;
  if (filters.search?.trim()) {
    const term = filters.search.trim().toLowerCase();
    filtered = filtered.filter((product) => {
      const variantSearch = product.variants
        .map((variant) => `${variant.sku || ""} ${variant.size || ""} ${variant.color || ""}`)
        .join(" ");
      return `${product.name} ${product.sku || ""} ${variantSearch}`
        .toLowerCase()
        .includes(term);
    });
  }
  if (filters.category) {
    filtered = filtered.filter((product) => product.category === filters.category);
  }
  if (filters.stockStatus) {
    filtered = filtered.filter((product) =>
      getProductStockStatus(product.stock, product.low_stock_threshold) === filters.stockStatus
    );
  }
  return filtered;
}

export async function getInventoryStats(request) {
  try {
    const [{ data: summary }, { data }] = await Promise.all([
      request("inventory/summary"),
      request("inventory"),
    ]);
    const products = (data || []).map(mapProduct);
    const stats = {
      totalProducts: summary.totalProducts,
      totalStockUnits: summary.totalUnits,
      lowStockCount: summary.lowStockCount,
      lowStockVariantCount: summary.lowStockVariantCount || 0,
      outOfStockCount: 0,
      inStockCount: 0,
      totalInventoryValue: 0,
      products,
      categories: Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort(),
    };
    for (const product of products) {
      const stock = Number(product.stock) || 0;
      if (stock === 0) stats.outOfStockCount += 1;
      else if (stock > Number(product.low_stock_threshold ?? 5)) stats.inStockCount += 1;
      if (product.has_variants && product.variants.length > 0) {
        stats.totalInventoryValue += product.variants.reduce(
          (total, variant) =>
            total +
            (Number(variant.stock) || 0) * (Number(variant.costPrice) || 0),
          0
        );
      } else {
        stats.totalInventoryValue += stock * (Number(product.cost_price) || 0);
      }
    }
    return { ...stats, error: null };
  } catch (error) {
    return {
      totalProducts: 0,
      totalStockUnits: 0,
      lowStockCount: 0,
      lowStockVariantCount: 0,
      outOfStockCount: 0,
      inStockCount: 0,
      totalInventoryValue: 0,
      products: [],
      categories: [],
      error,
    };
  }
}

export async function updateProductStock(
  productId,
  newStock,
  currentStock = 0,
  variantId = null
) {
  const parsedStock = Number(newStock);

  if (!Number.isSafeInteger(parsedStock) || parsedStock < 0) {
    return {
      product: null,
      error: { message: "Stock must be a non-negative whole number." },
    };
  }
  if (parsedStock === Number(currentStock)) {
    return { product: { id: productId, stock: parsedStock }, error: null };
  }
  try {
    const response = await apiRequest(`inventory/${productId}/adjust`, {
      method: "PATCH",
      body: JSON.stringify({
        change: parsedStock - Number(currentStock),
        ...(variantId ? { variantId } : {}),
      }),
    });
    return {
      product: {
        ...response.data,
        id: response.data.productId,
        stock:
          response.data.totalProductStock ?? response.data.stock ?? parsedStock,
      },
      error: null,
    };
  } catch (error) {
    return { product: null, error };
  }
}
