import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    priceConfigured: {
      type: Boolean,
      default: false,
    },
    currency: {
      type: String,
      enum: ["PKR"],
      default: "PKR",
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
      required: true,
    },
    features: {
      type: [{ type: String, trim: true, maxlength: 120 }],
      default: [],
    },
    limits: {
      products: { type: Number, min: 0, default: null },
      customers: { type: Number, min: 0, default: null },
      ordersPerMonth: { type: Number, min: 0, default: null },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

planSchema.index({ isActive: 1, price: 1 });

const SubscriptionPlan = mongoose.model("SubscriptionPlan", planSchema);

export default SubscriptionPlan;
