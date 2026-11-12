import mongoose from "mongoose";
import Product from "../models/Product.js";

// GET: All inventory
export const getInventory = async (req, res) => {
  try {
    const products = await Product.find({
      userId: req.user._id,
    }).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products,
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
      data: products,
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

      variant.stock += change;
      product.stock = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
      await product.save();

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

    if (change < 0 && existingProduct.stock < Math.abs(change)) {
      return res.status(409).json({
        success: false,
        message: "Insufficient stock for this adjustment.",
      });
    }

    existingProduct.stock += change;
    await existingProduct.save();

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
          totalUnits: { $sum: "$stock" },
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
        },
      },
      {
        $project: {
          _id: 0,
          totalProducts: 1,
          totalUnits: 1,
          lowStockCount: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: summary[0] || {
        totalProducts: 0,
        totalUnits: 0,
        lowStockCount: 0,
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
