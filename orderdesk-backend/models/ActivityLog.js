import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "product_created",
        "product_updated",
        "product_deleted",
        "customer_created",
        "customer_updated",
        "customer_deleted",
        "order_created",
        "order_status_changed",
        "payment_status_changed",
        "order_cancelled",
        "stock_increased",
        "stock_decreased",
        "low_stock_threshold_updated",
        "variant_created",
        "variant_updated",
        "variant_deleted",
        "notification_read",
        "notification_deleted",
      ],
    },
    entityType: {
      type: String,
      required: true,
      enum: [
        "product",
        "customer",
        "order",
        "inventory",
        "variant",
        "notification",
      ],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, bufferCommands: false }
);

activityLogSchema.index({ userId: 1, createdAt: -1, _id: -1 });
activityLogSchema.index({ userId: 1, action: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, entityType: 1, createdAt: -1 });

const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

export default ActivityLog;
