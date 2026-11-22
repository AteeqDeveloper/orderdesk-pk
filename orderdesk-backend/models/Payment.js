import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserSubscription",
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["PKR"],
      default: "PKR",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "cancelled"],
      default: "pending",
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: [
        "unconfigured",
        "manual_bank_transfer",
        "manual_jazzcash",
        "manual_easypaisa",
        "safepay",
        "jazzcash",
        "easypaisa",
      ],
      default: "unconfigured",
    },
    paymentProvider: {
      type: String,
      enum: ["unconfigured", "manual", "safepay", "jazzcash", "easypaisa"],
      default: "unconfigured",
    },
    transactionReference: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    providerEventId: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    paidAt: {
      type: Date,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  { timestamps: true }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index(
  { transactionReference: 1 },
  {
    unique: true,
    partialFilterExpression: {
      transactionReference: { $type: "string", $gt: "" },
    },
  }
);
paymentSchema.index(
  { providerEventId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerEventId: { $type: "string", $gt: "" },
    },
  }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
