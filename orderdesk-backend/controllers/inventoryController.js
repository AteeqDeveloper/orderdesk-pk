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

// GET: Low-stock products
export const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      userId: req.user._id,
      $expr: {
        $lte: ["$stock", "$lowStockThreshold"],
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

// PATCH: Adjust stock
export const adjustStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { change } = req.body;

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

    const filter = {
      _id: id,
      userId: req.user._id,
    };

    // Prevent stock from becoming negative.
    if (change < 0) {
      filter.stock = { $gte: Math.abs(change) };
    }

    const product = await Product.findOneAndUpdate(
      filter,
      { $inc: { stock: change } },
      { new: true, runValidators: true }
    );

    if (!product) {
      const ownedProduct = await Product.exists({
        _id: id,
        userId: req.user._id,
      });

      if (!ownedProduct) {
        return res.status(404).json({
          success: false,
          message: "Product not found.",
        });
      }

      return res.status(409).json({
        success: false,
        message: "Insufficient stock for this adjustment.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stock adjusted successfully.",
      data: {
        productId: product._id,
        name: product.name,
        stock: product.stock,
        lowStock: product.stock <= product.lowStockThreshold,
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
          userId: new mongoose.Types.ObjectId(
            req.user._id.toString()
          ),
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
                { $lte: ["$stock", "$lowStockThreshold"] },
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