import mongoose from "mongoose";
import { createHash } from "node:crypto";

export const getOrderRequestFingerprint = (requestBody) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        customerId: requestBody.customerId,
        items: requestBody.items,
        discount: requestBody.discount ?? 0,
        deliveryCharges: requestBody.deliveryCharges ?? 0,
        paymentMethod: requestBody.paymentMethod ?? "COD",
        notes: requestBody.notes ?? "",
      })
    )
    .digest("hex");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    name: {
      type: String,
      required: true,
    },

    size: {
      type: String,
      default: "",
    },

    color: {
      type: String,
      default: "",
    },

    sku: {
      type: String,
      default: "",
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    idempotencyKey: {
      type: String,
      trim: true,
    },

    idempotencyFingerprint: {
      type: String,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    customerSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      address: { type: String, default: "" },
      city: { type: String, default: "" },
    },

    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: "An order must contain at least one product",
      },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    deliveryCharges: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["COD", "JazzCash", "Easypaisa", "Bank Transfer"],
      default: "COD",
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
    },

    orderStatus: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },
    quotaCreatedAt: {
      type: Date,
      default: Date.now,
      select: false,
    },
  },
  { timestamps: true }
);

orderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    name: "unique_seller_order_idempotency_key",
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string", $gt: "" },
    },
  }
);
orderSchema.index({ userId: 1, createdAt: 1 });
orderSchema.index({ userId: 1, quotaCreatedAt: 1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;   