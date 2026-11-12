import mongoose from "mongoose";

const variantSchema = new mongoose.Schema(
  {
    size: {
      type: String,
      trim: true,
      default: "",
    },

    color: {
      type: String,
      trim: true,
      default: "",
    },

    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    price: {
      type: Number,
      required: [true, "Variant price is required"],
      min: [0, "Variant price cannot be negative"],
    },

    costPrice: {
      type: Number,
      default: 0,
      min: [0, "Variant cost price cannot be negative"],
    },

    stock: {
      type: Number,
      default: 0,
      min: [0, "Variant stock cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Variant stock must be a whole number",
      },
    },

    lowStockThreshold: {
      type: Number,
      default: 5,
      min: [0, "Variant low stock threshold cannot be negative"],
    },

    imageUrl: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { _id: true, timestamps: true }
);

const productSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },

    sku: {
      type: String,
      trim: true,
      uppercase: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },

    costPrice: {
      type: Number,
      default: 0,
      min: [0, "Cost price cannot be negative"],
    },

    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
      validate: {
        validator: Number.isInteger,
        message: "Stock must be a whole number",
      },
    },

    hasVariants: {
      type: Boolean,
      default: false,
    },

    variants: {
      type: [variantSchema],
      default: [],
    },

    category: {
      type: String,
      trim: true,
      default: "General",
    },

    imageUrl: {
      type: String,
      trim: true,
      default: "",
    },

    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// SKU unique per user, if provided
productSchema.index(
  { userId: 1, sku: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sku: { $type: "string", $gt: "" },
    },
  }
);

productSchema.index(
  { userId: 1, "variants.sku": 1 },
  { sparse: true }
);

const Product = mongoose.model("Product", productSchema);

export default Product;