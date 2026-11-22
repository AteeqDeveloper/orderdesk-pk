import mongoose from "mongoose";
import Product from "../models/Product.js";
import {
  safelyNotify,
  syncStockAlert,
  syncProductStockAlerts,
} from "../utils/notificationService.js";
import { recordActivity } from "../utils/activityLog.js";

const getInventoryProduct = (product) => {
  const data =
    typeof product.toObject === "function" ? product.toObject() : { ...product };
  const variants = data.variants || [];

  if (data.hasVariants && variants.length > 0) {
    data.stock = variants.reduce((total, variant) => total + (variant.stock || 0), 0);
  }

  data.lowStockVariants = variants
    .filter(
      (variant) =>
        variant.status === "active" &&
        variant.stock <= variant.lowStockThreshold
    )
    .map((variant) => ({
      ...variant,
      variantName:
        [variant.size, variant.color].filter(Boolean).join(" / ") || "Variant",
    }));

  return data;
};

// GET: All inventory
export const getInventory = async (req, res) => {
  try {
    const products = await Product.find({
      userId: req.user._id,
    }).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products.map(getInventoryProduct),
    });
  } catch (error) {
    console.error("Get inventory error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch inventory.",
    });
  }
};

// GET: Low-stock products (checks both parent level and variant level)
export const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      userId: req.user._id,
      $expr: {
        $or: [
          { $lte: ["$stock", "$lowStockThreshold"] },
          {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: { $ifNull: ["$variants", []] },
                    as: "v",
                    cond: {
                      $and: [
                        { $eq: ["$$v.status", "active"] },
                        { $lte: ["$$v.stock", "$$v.lowStockThreshold"] },
                      ],
                    },
                  },
                },
              },
              0,
            ],
          },
        ],
      },
    }).sort({ stock: 1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products.map(getInventoryProduct),
    });
  } catch (error) {
    console.error("Low-stock error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch low-stock products.",
    });
  }
};

// PATCH: Adjust stock (supports both parent product and variant level)
export const adjustStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { change, variantId } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    if (
      typeof change !== "number" ||
      !Number.isSafeInteger(change) ||
      change === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Change must be a non-zero whole number.",
      });
    }

    // 1. Variant-level adjustment
    if (variantId) {
      if (!mongoose.isValidObjectId(variantId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid variant ID.",
        });
      }

      const product = await Product.findOne({
        _id: id,
        userId: req.user._id,
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found.",
        });
      }

      const variant = product.variants.id(variantId);
      if (!variant) {
        return res.status(404).json({
          success: false,
          message: "Variant not found in this product.",
        });
      }

      if (change < 0 && variant.stock < Math.abs(change)) {
        return res.status(409).json({
          success: false,
          message: "Insufficient stock for this variant adjustment.",
        });
      }

      const previousProduct = product.toObject();
      const previousStock = variant.stock;
      variant.stock += change;
      product.stock = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
      await product.save();
      await safelyNotify(
        () =>
          syncStockAlert({
            userId: req.user._id,
            productId: product._id,
            variantId: variant._id,
            productName: product.name,
            variantName:
              [variant.size, variant.color].filter(Boolean).join(" / ") ||
              "Variant",
            before: {
              stock: previousStock,
              lowStockThreshold: variant.lowStockThreshold,
              active:
                previousProduct.status === "active" &&
                variant.status === "active",
            },
            after: {
              stock: variant.stock,
              lowStockThreshold: variant.lowStockThreshold,
              active:
                product.status === "active" && variant.status === "active",
            },
          }),
        "Manual variant stock"
      );
      await recordActivity({
        userId: req.user._id,
        action: change > 0 ? "stock_increased" : "stock_decreased",
        entityType: "inventory",
        entityId: product._id,
        description: `Stock ${change > 0 ? "increased" : "decreased"} for ${product.name}`,
        metadata: {
          entityName: product.name,
          variantName:
            [variant.size, variant.color].filter(Boolean).join(" / ") ||
            "Variant",
          variantId: variant._id,
          previousStock,
          stock: variant.stock,
          change,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Variant stock adjusted successfully.",
        data: {
          productId: product._id,
          variantId: variant._id,
          name: product.name,
          variantName:
            [variant.size, variant.color].filter(Boolean).join(" / ") || "Variant",
          stock: variant.stock,
          totalProductStock: product.stock,
          lowStock: variant.stock <= variant.lowStockThreshold,
        },
      });
    }

    // 2. Product-level adjustment
    const existingProduct = await Product.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    if (existingProduct.hasVariants && existingProduct.variants.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "This product has variants. Please specify a variantId to adjust stock.",
      });
    }

    const previousProduct = existingProduct.toObject();
    if (change < 0 && existingProduct.stock < Math.abs(change)) {
      return res.status(409).json({
        success: false,
        message: "Insufficient stock for this adjustment.",
      });
    }

    existingProduct.stock += change;
    await existingProduct.save();
    await safelyNotify(
      () =>
        syncProductStockAlerts(
          req.user._id,
          previousProduct,
          existingProduct
        ),
      "Manual product stock"
    );
    await recordActivity({
      userId: req.user._id,
      action: change > 0 ? "stock_increased" : "stock_decreased",
      entityType: "inventory",
      entityId: existingProduct._id,
      description: `Stock ${change > 0 ? "increased" : "decreased"} for ${existingProduct.name}`,
      metadata: {
        entityName: existingProduct.name,
        previousStock: previousProduct.stock,
        stock: existingProduct.stock,
        change,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Stock adjusted successfully.",
      data: {
        productId: existingProduct._id,
        name: existingProduct.name,
        stock: existingProduct.stock,
        lowStock: existingProduct.stock <= existingProduct.lowStockThreshold,
      },
    });
  } catch (error) {
    console.error("Adjust stock error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to adjust stock.",
    });
  }
};

// GET: Inventory summary
export const getInventorySummary = async (req, res) => {
  try {
    const summary = await Product.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(req.user._id.toString()),
        },
      },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalUnits: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$hasVariants", true] },
                    {
                      $gt: [
                        { $size: { $ifNull: ["$variants", []] } },
                        0,
                      ],
                    },
                  ],
                },
                {
                  $reduce: {
                    input: { $ifNull: ["$variants", []] },
                    initialValue: 0,
                    in: { $add: ["$$value", "$$this.stock"] },
                  },
                },
                "$stock",
              ],
            },
          },
          lowStockCount: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $lte: ["$stock", "$lowStockThreshold"] },
                    {
                      $gt: [
                        {
                          $size: {
                            $filter: {
                              input: { $ifNull: ["$variants", []] },
                              as: "v",
                              cond: {
                                $and: [
                                  { $eq: ["$$v.status", "active"] },
                                  { $lte: ["$$v.stock", "$$v.lowStockThreshold"] },
                                ],
                              },
                            },
                          },
                        },
                        0,
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
          lowStockVariantCount: {
            $sum: {
              $size: {
                $filter: {
                  input: { $ifNull: ["$variants", []] },
                  as: "v",
                  cond: {
                    $and: [
                      { $eq: ["$$v.status", "active"] },
                      { $lte: ["$$v.stock", "$$v.lowStockThreshold"] },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalProducts: 1,
          totalUnits: 1,
          lowStockCount: 1,
          lowStockVariantCount: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: summary[0] || {
        totalProducts: 0,
        totalUnits: 0,
        lowStockCount: 0,
        lowStockVariantCount: 0,
      },
    });
  } catch (error) {
    console.error("Inventory summary error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch inventory summary.",
    });
  }
};
