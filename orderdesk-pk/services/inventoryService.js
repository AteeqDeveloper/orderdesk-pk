import { createClient } from "@/lib/supabase/client";

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

/**
 * Read functions accept a Supabase client instance (server or client)
 * and the user id.
 */
export async function getInventoryProducts(supabase, userId, filters = {}) {
  const { search = "", category = "", stockStatus = "" } = filters;

  let query = supabase
    .from("products")
    .select("*, product_variants(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (search.trim()) {
    const term = search.trim().replace(/[%_]/g, "");
    query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  }

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  let products = data || [];

  // Filter by stock status if requested
  if (stockStatus) {
    products = products.filter((product) => {
      const status = getProductStockStatus(product.stock, product.low_stock_threshold);
      return status === stockStatus;
    });
  }

  return { products, error };
}

export async function getInventoryStats(supabase, userId) {
  const { data, error } = await supabase
    .from("products")
    .select("id, stock, cost_price, price, low_stock_threshold, status")
    .eq("user_id", userId);

  const products = data || [];

  const totalProducts = products.length;
  let totalStockUnits = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let inStockCount = 0;
  let totalInventoryValue = 0;

  for (const product of products) {
    const stock = Number(product.stock) || 0;
    const costPrice = Number(product.cost_price) || 0;
    const threshold = Number(product.low_stock_threshold ?? 5);

    totalStockUnits += stock;
    totalInventoryValue += stock * costPrice;

    if (stock === 0) {
      outOfStockCount += 1;
    } else if (stock <= threshold) {
      lowStockCount += 1;
    } else {
      inStockCount += 1;
    }
  }

  return {
    totalProducts,
    totalStockUnits,
    lowStockCount,
    outOfStockCount,
    inStockCount,
    totalInventoryValue,
    error,
  };
}

/**
 * Updates product stock level in Supabase.
 * Validates that stock cannot be negative.
 */
export async function updateProductStock(productId, newStock) {
  const parsedStock = Math.floor(Number(newStock));

  if (Number.isNaN(parsedStock) || parsedStock < 0) {
    return { product: null, error: { message: "Stock quantity cannot be negative." } };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .update({
      stock: parsedStock,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId)
    .select("*, product_variants(*)")
    .single();

  return { product: data || null, error };
}

/**
 * Updates variant stock level in Supabase.
 * Validates that stock cannot be negative.
 */
export async function updateVariantStock(variantId, newStock) {
  const parsedStock = Math.floor(Number(newStock));

  if (Number.isNaN(parsedStock) || parsedStock < 0) {
    return { variant: null, error: { message: "Variant stock cannot be negative." } };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .update({ stock: parsedStock })
    .eq("id", variantId)
    .select()
    .single();

  return { variant: data || null, error };
}
