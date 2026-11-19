import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: ["low_stock", "out_of_stock", "order_update", "system"],
      required: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    relatedType: {
      type: String,
      enum: ["product", "variant", "order", null],
      default: null,
    },
    relatedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    dedupeKey: {
      type: String,
      trim: true,
      select: false,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

notificationSchema.index(
  { userId: 1, updatedAt: -1 },
  { name: "seller_notifications_by_recent_update" }
);

notificationSchema.index(
  { userId: 1, dedupeKey: 1 },
  {
    name: "unique_seller_notification_dedupe_key",
    unique: true,
    partialFilterExpression: { dedupeKey: { $type: "string" } },
  }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
