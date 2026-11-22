import mongoose from "mongoose";

const usageLockSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    resource: {
      type: String,
      enum: ["products", "customers", "ordersPerMonth"],
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

usageLockSchema.index(
  { userId: 1, resource: 1 },
  { unique: true, name: "one_usage_write_lock_per_resource" }
);
usageLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const UsageLock = mongoose.model("UsageLock", usageLockSchema);

export default UsageLock;
