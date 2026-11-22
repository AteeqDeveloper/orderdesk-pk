import mongoose from "mongoose";

const superAdminAuditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "super_admin_login",
        "super_admin_logout",
        "user_suspended",
        "user_reactivated",
        "subscription_status_changed",
        "subscription_plan_assigned",
        "subscription_plan_assignment_attempted",
        "plan_created",
        "plan_updated",
        "plan_activated",
        "plan_deactivated",
        "payment_records_viewed",
        "payment_verification_attempted",
        "payment_verified",
      ],
    },
    targetType: {
      type: String,
      required: true,
      enum: ["user", "subscription", "plan", "payment", "session"],
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, bufferCommands: false }
);

superAdminAuditLogSchema.index({ createdAt: -1, _id: -1 });
superAdminAuditLogSchema.index({ actorId: 1, createdAt: -1 });
superAdminAuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

for (const operation of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
]) {
  superAdminAuditLogSchema.pre(operation, function rejectAuditMutation() {
    throw new Error("Super Admin audit entries are immutable");
  });
}

const SuperAdminAuditLog = mongoose.model(
  "SuperAdminAuditLog",
  superAdminAuditLogSchema
);

export default SuperAdminAuditLog;
