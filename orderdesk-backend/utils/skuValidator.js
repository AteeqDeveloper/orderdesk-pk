import mongoose from "mongoose";
import Product from "../models/Product.js";

/**
 * Checks whether a given SKU is available for the given seller (userId).
 * Searches both parent products and subdocument variants.
 *
 * @param {string|mongoose.Types.ObjectId} userId - The owner ID
 * @param {string} sku - The SKU string to check
 * @param {Object} options - Options to exclude an existing product or variant during updates
 * @param {string|mongoose.Types.ObjectId} [options.excludeProductId]
 * @param {string|mongoose.Types.ObjectId} [options.excludeVariantId]
 * @returns {Promise<boolean>} - True if available, false if already taken
 */
export async function isSkuAvailable(
  userId,
  sku,
  { excludeProductId = null, excludeVariantId = null } = {}
) {
  if (!sku || typeof sku !== "string" || !sku.trim()) {
    return true;
  }

  const normalized = sku.trim().toUpperCase();

  // 1. Check parent product root SKUs
  const productQuery = {
    userId,
    sku: normalized,
  };
  if (excludeProductId) {
    productQuery._id = { $ne: excludeProductId };
  }

  const query1 = Product.findOne(productQuery, "_id");
  const existingProduct = typeof query1?.lean === "function" ? await query1.lean() : await query1;
  if (existingProduct) {
    return false;
  }

  // 2. Check variant SKUs
  const variantQuery = {
    userId,
    "variants.sku": normalized,
  };

  const query2 = Product.find(variantQuery, "_id variants");
  const matchingProducts = typeof query2?.lean === "function" ? await query2.lean() : await query2;

  for (const prod of matchingProducts || []) {
    for (const v of prod.variants || []) {
      if (v.sku && v.sku.toUpperCase() === normalized) {
        if (
          excludeVariantId &&
          String(v._id) === String(excludeVariantId)
        ) {
          continue;
        }
        return false;
      }
    }
  }

  return true;
}

/**
 * Validates and sanitizes a variant object before saving.
 *
 * @param {Object} rawVariant - Input variant data
 * @param {Object} [fallback] - Fallback values (e.g. from parent product)
 * @returns {{ sanitized: Object|null, error: string|null }}
 */
export function sanitizeVariantData(rawVariant, fallback = {}) {
  if (!rawVariant || typeof rawVariant !== "object") {
    return { sanitized: null, error: "Variant data must be an object" };
  }

  const size = typeof rawVariant.size === "string" ? rawVariant.size.trim() : "";
  const color = typeof rawVariant.color === "string" ? rawVariant.color.trim() : "";
  const sku = typeof rawVariant.sku === "string" ? rawVariant.sku.trim().toUpperCase() : "";
  const imageUrl = typeof rawVariant.imageUrl === "string" ? rawVariant.imageUrl.trim() : "";

  // Price validation
  let price = rawVariant.price !== undefined ? Number(rawVariant.price) : fallback.price;
  if (price === undefined || !Number.isFinite(price) || price < 0) {
    return {
      sanitized: null,
      error: "Variant price must be a valid non-negative number",
    };
  }

  // Cost price validation
  let costPrice = 0;
  if (rawVariant.costPrice !== undefined && rawVariant.costPrice !== null && rawVariant.costPrice !== "") {
    costPrice = Number(rawVariant.costPrice);
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      return {
        sanitized: null,
        error: "Variant cost price must be a valid non-negative number",
      };
    }
  } else if (fallback.costPrice !== undefined) {
    costPrice = Number(fallback.costPrice) || 0;
  }

  // Stock validation
  let stock = 0;
  if (rawVariant.stock !== undefined && rawVariant.stock !== null && rawVariant.stock !== "") {
    stock = Number(rawVariant.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      return {
        sanitized: null,
        error: "Variant stock must be a non-negative whole number",
      };
    }
  }

  // Low stock threshold
  let lowStockThreshold = 5;
  if (
    rawVariant.lowStockThreshold !== undefined &&
    rawVariant.lowStockThreshold !== null &&
    rawVariant.lowStockThreshold !== ""
  ) {
    lowStockThreshold = Number(rawVariant.lowStockThreshold);
    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
      return {
        sanitized: null,
        error: "Variant low stock threshold must be a non-negative number",
      };
    }
  } else if (fallback.lowStockThreshold !== undefined) {
    lowStockThreshold = Number(fallback.lowStockThreshold) || 5;
  }

  // Status
  let status = "active";
  if (rawVariant.status !== undefined) {
    if (!["active", "inactive"].includes(rawVariant.status)) {
      return {
        sanitized: null,
        error: "Variant status must be either 'active' or 'inactive'",
      };
    }
    status = rawVariant.status;
  }

  return {
    sanitized: {
      size,
      color,
      sku,
      price,
      costPrice,
      stock,
      lowStockThreshold,
      imageUrl,
      status,
    },
    error: null,
  };
}
