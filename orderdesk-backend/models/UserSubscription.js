import mongoose from "mongoose";

const planSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    priceConfigured: { type: Boolean, default: false },
    currency: { type: String, enum: ["PKR"], default: "PKR" },
    billingCycle: { type: String, enum: ["monthly", "yearly"], required: true },
    features: { type: [String], default: [] },
    limits: {
      products: { type: Number, min: 0, default: null },
      customers: { type: Number, min: 0, default: null },
      ordersPerMonth: { type: Number, min: 0, default: null },
    },
  },
  { _id: false }
);

const userSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
      index: true,
    },
    planSnapshot: {
      type: planSnapshotSchema,
      default: undefined,
    },
    status: {
      type: String,
      enum: [
        "pending_payment",
        "active",
        "cancel_at_period_end",
        "past_due",
        "failed",
        "cancelled",
        "expired",
      ],
      required: true,
      index: true,
    },
    isCurrent: {
      type: Boolean,
      default: false,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    nextBillingDate: {
      type: Date,
      default: null,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
    },
    priceAtPurchase: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["PKR"],
      default: "PKR",
    },
    paymentProvider: {
      type: String,
      enum: ["unconfigured", "manual", "safepay", "jazzcash", "easypaisa"],
      default: "unconfigured",
    },
    providerSubscriptionId: {
      type: String,
      trim: true,
      default: "",
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    cancelReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    adminNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    activatedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userSubscriptionSchema.index(
  { userId: 1 },
  {
    name: "one_current_subscription_per_user",
    unique: true,
    partialFilterExpression: { isCurrent: true },
  }
);
userSubscriptionSchema.index(
  { userId: 1 },
  {
    name: "one_pending_subscription_request_per_user",
    unique: true,
    partialFilterExpression: {
      status: "pending_payment",
      isCurrent: false,
    },
  }
);
userSubscriptionSchema.index({ userId: 1, status: 1, createdAt: -1 });
userSubscriptionSchema.index(
  { providerSubscriptionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerSubscriptionId: { $type: "string", $gt: "" },
    },
  }
);

const UserSubscription = mongoose.model(
  "UserSubscription",
  userSubscriptionSchema
);

export default UserSubscription;
