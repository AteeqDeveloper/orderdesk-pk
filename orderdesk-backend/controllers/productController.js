import mongoose from "mongoose";
import Product from "../models/Product.js";
import { isSkuAvailable, sanitizeVariantData } from "../utils/skuValidator.js";

const getProductData = (body) => {
  const allowedFields = [
    "name",
    "sku",
    "description",
    "price",
    "costPrice",
    "stock",
    "category",
    "imageUrl",
    "lowStockThreshold",
    "status",
    "hasVariants",
    "variants",
  ];

  const data = {};

  for (const field of allowedFields) {
    if (Object.hasOwn(body, field)) {
      data[field] = body[field];
    }
  }

  return data;
};

// CREATE PRODUCT
export const createProduct = async (req, res) => {
  try {
    const data = getProductData(req.body);

    if (
      typeof data.name !== "string" ||
      !data.name.trim() ||
      data.price === undefined ||
      data.price === null ||
      data.price === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Product name and price are required",
      });
    }

    if (
      data.sku !== undefined &&
      data.sku !== null &&
      typeof data.sku !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Product SKU must be a string",
      });
    }

    const price = Number(data.price);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({
        success: false,
        message: "Price cannot be negative",
      });
    }

    if (data.costPrice !== undefined && data.costPrice !== null && data.costPrice !== "") {
      const cost = Number(data.costPrice);
      if (!Number.isFinite(cost) || cost < 0) {
        return res.status(400).json({
          success: false,
          message: "Cost price cannot be negative",
        });
      }
    }

    if (data.stock !== undefined && data.stock !== null && data.stock !== "") {
      const stock = Number(data.stock);
      if (!Number.isInteger(stock) || stock < 0) {
        return res.status(400).json({
          success: false,
          message: "Stock must be a non-negative whole number",
        });
      }
    }

    // Check parent SKU uniqueness
    if (data.sku && typeof data.sku === "string" && data.sku.trim()) {
      const available = await isSkuAvailable(req.user._id, data.sku);
      if (!available) {
        return res.status(409).json({
          success: false,
          message: "This SKU already exists in your products",
        });
      }
    }

    // Process variants if provided
    let variants = [];
    if (Array.isArray(data.variants) && data.variants.length > 0) {
      const seenSkus = new Set();
      const parentSku = data.sku?.trim().toUpperCase();

      // First pass: sanitize each variant and check intra-payload SKU duplicates
      for (let i = 0; i < data.variants.length; i++) {
        const { sanitized, error } = sanitizeVariantData(data.variants[i], {
          price,
          costPrice: data.costPrice,
          lowStockThreshold: data.lowStockThreshold,
        });

        if (error) {
          return res.status(400).json({
            success: false,
            message: `Variant ${i + 1}: ${error}`,
          });
        }

        if (sanitized.sku) {
          if (parentSku && sanitized.sku === parentSku) {
            return res.status(409).json({
              success: false,
              message: `Variant SKU "${sanitized.sku}" cannot match the product SKU`,
            });
          }

          if (seenSkus.has(sanitized.sku)) {
            return res.status(409).json({
              success: false,
              message: `Duplicate SKU "${sanitized.sku}" within product variants`,
            });
          }
          seenSkus.add(sanitized.sku);
        }

        variants.push(sanitized);
      }

      // Second pass: check database availability for all unique variant SKUs
      for (const v of variants) {
        if (v.sku) {
          const available = await isSkuAvailable(req.user._id, v.sku);
          if (!available) {
            return res.status(409).json({
              success: false,
              message: `SKU "${v.sku}" already exists in your products`,
            });
          }
        }
      }

      data.variants = variants;
      data.hasVariants = true;
      data.stock = variants.reduce((sum, v) => sum + v.stock, 0);
    } else {
      data.variants = [];
      data.hasVariants = false;
    }

    const product = await Product.create({
      ...data,
      userId: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This SKU already exists in your products",
      });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Create product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET ALL PRODUCTS OF LOGGED-IN USER
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find({
      userId: req.user._id,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Get products error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET SINGLE PRODUCT
export const getProductById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    console.error("Get product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE PRODUCT
export const updateProduct = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const data = getProductData(req.body);

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update",
      });
    }

    const currentProduct = await Product.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!currentProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (data.variants !== undefined && !Array.isArray(data.variants)) {
      return res.status(400).json({
        success: false,
        message: "Variants must be an array",
      });
    }

    if (
      data.sku !== undefined &&
      data.sku !== null &&
      typeof data.sku !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Product SKU must be a string",
      });
    }

    if (data.price !== undefined) {
      const price = Number(data.price);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: "Price cannot be negative",
        });
      }
    }

    if (data.costPrice !== undefined && data.costPrice !== null && data.costPrice !== "") {
      const cost = Number(data.costPrice);
      if (!Number.isFinite(cost) || cost < 0) {
        return res.status(400).json({
          success: false,
          message: "Cost price cannot be negative",
        });
      }
    }

    if (data.stock !== undefined && data.stock !== null && data.stock !== "") {
      const stock = Number(data.stock);
      if (!Number.isInteger(stock) || stock < 0) {
        return res.status(400).json({
          success: false,
          message: "Stock must be a non-negative whole number",
        });
      }
    }

    // Check SKU if updated
    if (data.sku && data.sku.trim()) {
      const normalizedSku = data.sku.trim().toUpperCase();
      const variantsToCheck = Array.isArray(data.variants)
        ? data.variants
        : currentProduct.variants;

      if (
        variantsToCheck.some(
          (variant) =>
            typeof variant?.sku === "string" &&
            variant.sku.trim().toUpperCase() === normalizedSku
        )
      ) {
        return res.status(409).json({
          success: false,
          message: "Product SKU cannot match one of its variant SKUs",
        });
      }

      const available = await isSkuAvailable(req.user._id, data.sku, {
        excludeProductId: req.params.id,
      });
      if (!available) {
        return res.status(409).json({
          success: false,
          message: "This SKU already exists in your products",
        });
      }
    }

    // If variants array is provided in update
    if (Array.isArray(data.variants)) {
      const seenSkus = new Set();
      const parentSku = (data.sku || currentProduct.sku)?.trim().toUpperCase();
      const sanitizedVariants = [];

      for (let i = 0; i < data.variants.length; i++) {
        const rawVariant = data.variants[i];
        const { sanitized, error } = sanitizeVariantData(rawVariant, {
          price: data.price ?? currentProduct.price,
          costPrice: data.costPrice ?? currentProduct.costPrice,
          lowStockThreshold: data.lowStockThreshold ?? currentProduct.lowStockThreshold,
        });

        if (error) {
          return res.status(400).json({
            success: false,
            message: `Variant ${i + 1}: ${error}`,
          });
        }

        const submittedVariantId = rawVariant?._id ?? rawVariant?.id;
        if (submittedVariantId !== undefined) {
          if (!mongoose.isValidObjectId(submittedVariantId)) {
            return res.status(400).json({
              success: false,
              message: `Variant ${i + 1} has an invalid ID`,
            });
          }

          const existingVariant = currentProduct.variants.id(submittedVariantId);
          if (!existingVariant) {
            return res.status(400).json({
              success: false,
              message: `Variant ${i + 1} does not belong to this product`,
            });
          }
          sanitized._id = existingVariant._id;
        }

        if (sanitized.sku) {
          if (parentSku && sanitized.sku === parentSku) {
            return res.status(409).json({
              success: false,
              message: `Variant SKU "${sanitized.sku}" cannot match the product SKU`,
            });
          }

          if (seenSkus.has(sanitized.sku)) {
            return res.status(409).json({
              success: false,
              message: `Duplicate SKU "${sanitized.sku}" within product variants`,
            });
          }
          seenSkus.add(sanitized.sku);

          const available = await isSkuAvailable(req.user._id, sanitized.sku, {
            excludeProductId: req.params.id,
            excludeVariantId: sanitized._id,
          });

          if (!available) {
            return res.status(409).json({
              success: false,
              message: `SKU "${sanitized.sku}" already exists in your products`,
            });
          }
        }

        sanitizedVariants.push(sanitized);
      }

      data.variants = sanitizedVariants;
      data.hasVariants = sanitizedVariants.length > 0;
      data.stock = sanitizedVariants.reduce((sum, v) => sum + v.stock, 0);
    } else if (currentProduct.hasVariants && currentProduct.variants.length > 0) {
      // If product has variants and variants are not being updated, preserve stock sum
      data.stock = currentProduct.variants.reduce((sum, v) => sum + v.stock, 0);
      data.hasVariants = true;
    }

    const product = await Product.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
      },
      { $set: data },
      {
        new: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This SKU already exists in your products",
      });
    }

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Update product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE PRODUCT
export const deleteProduct = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    console.error("Delete product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// --- VARIANT CRUD OPERATIONS ---

// GET ALL VARIANTS OF A PRODUCT
export const getVariants = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      count: product.variants.length,
      variants: product.variants,
    });
  } catch (error) {
    console.error("Get variants error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// GET SINGLE VARIANT
export const getVariantById = async (req, res) => {
  try {
    const { id, variantId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(variantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product or variant ID",
      });
    }

    const product = await Product.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    return res.status(200).json({
      success: true,
      variant,
    });
  } catch (error) {
    console.error("Get variant by ID error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ADD VARIANT TO PRODUCT
export const addVariant = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const { sanitized, error } = sanitizeVariantData(req.body, {
      price: product.price,
      costPrice: product.costPrice,
      lowStockThreshold: product.lowStockThreshold,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    // Validate SKU uniqueness
    if (sanitized.sku) {
      if (product.sku && sanitized.sku === product.sku) {
        return res.status(409).json({
          success: false,
          message: "Variant SKU cannot match the product SKU",
        });
      }

      const existingVariantWithSku = product.variants.find(
        (v) => v.sku && v.sku.toUpperCase() === sanitized.sku
      );
      if (existingVariantWithSku) {
        return res.status(409).json({
          success: false,
          message: "This SKU already exists in this product's variants",
        });
      }

      const available = await isSkuAvailable(req.user._id, sanitized.sku, {
        excludeProductId: product._id,
      });
      if (!available) {
        return res.status(409).json({
          success: false,
          message: "This SKU already exists in your products",
        });
      }
    }

    product.variants.push(sanitized);
    product.hasVariants = true;
    product.stock = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);

    await product.save();

    const createdVariant = product.variants[product.variants.length - 1];

    return res.status(201).json({
      success: true,
      message: "Variant added successfully",
      variant: createdVariant,
      product,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Add variant error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// UPDATE VARIANT
export const updateVariant = async (req, res) => {
  try {
    const { id, variantId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(variantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product or variant ID",
      });
    }

    const product = await Product.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    const updates = req.body;
    if (!updates || typeof updates !== "object" || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update",
      });
    }

    // Price validation
    if (updates.price !== undefined) {
      const price = Number(updates.price);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: "Variant price must be a valid non-negative number",
        });
      }
      variant.price = price;
    }

    // Cost price validation
    if (updates.costPrice !== undefined) {
      const cost = Number(updates.costPrice);
      if (!Number.isFinite(cost) || cost < 0) {
        return res.status(400).json({
          success: false,
          message: "Variant cost price must be a valid non-negative number",
        });
      }
      variant.costPrice = cost;
    }

    // Stock validation
    if (updates.stock !== undefined) {
      const stock = Number(updates.stock);
      if (!Number.isInteger(stock) || stock < 0) {
        return res.status(400).json({
          success: false,
          message: "Variant stock must be a non-negative whole number",
        });
      }
      variant.stock = stock;
    }

    // Low stock threshold
    if (updates.lowStockThreshold !== undefined) {
      const threshold = Number(updates.lowStockThreshold);
      if (!Number.isFinite(threshold) || threshold < 0) {
        return res.status(400).json({
          success: false,
          message: "Low stock threshold must be a non-negative number",
        });
      }
      variant.lowStockThreshold = threshold;
    }

    // Status validation
    if (updates.status !== undefined) {
      if (!["active", "inactive"].includes(updates.status)) {
        return res.status(400).json({
          success: false,
          message: "Variant status must be either 'active' or 'inactive'",
        });
      }
      variant.status = updates.status;
    }

    // Size, Color, ImageUrl
    if (typeof updates.size === "string") variant.size = updates.size.trim();
    if (typeof updates.color === "string") variant.color = updates.color.trim();
    if (typeof updates.imageUrl === "string") variant.imageUrl = updates.imageUrl.trim();

    // SKU validation
    if (updates.sku !== undefined) {
      const newSku = typeof updates.sku === "string" ? updates.sku.trim().toUpperCase() : "";
      if (newSku && newSku !== variant.sku) {
        if (product.sku && newSku === product.sku) {
          return res.status(409).json({
            success: false,
            message: "Variant SKU cannot match the product SKU",
          });
        }

        const conflictVariant = product.variants.find(
          (v) =>
            String(v._id) !== String(variantId) &&
            v.sku &&
            v.sku.toUpperCase() === newSku
        );
        if (conflictVariant) {
          return res.status(409).json({
            success: false,
            message: "This SKU already exists in this product's variants",
          });
        }

        const available = await isSkuAvailable(req.user._id, newSku, {
          excludeVariantId: variantId,
        });
        if (!available) {
          return res.status(409).json({
            success: false,
            message: "This SKU already exists in your products",
          });
        }
      }
      variant.sku = newSku;
    }

    product.stock = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Variant updated successfully",
      variant,
      product,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Update variant error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// DELETE VARIANT
export const deleteVariant = async (req, res) => {
  try {
    const { id, variantId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(variantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product or variant ID",
      });
    }

    const product = await Product.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    product.variants.pull({ _id: variantId });
    product.hasVariants = product.variants.length > 0;
    product.stock = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Variant deleted successfully",
      product,
    });
  } catch (error) {
    console.error("Delete variant error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
