import SuperAdminAuditLog from "../models/SuperAdminAuditLog.js";

export async function writeSuperAdminAudit({
  actorId,
  action,
  targetType,
  targetId = null,
  reason = "",
  metadata = {},
  idempotencyKey = "",
}) {
  try {
    return await SuperAdminAuditLog.create({
      actorId,
      action,
      targetType,
      targetId,
      reason,
      metadata,
      idempotencyKey,
    });
  } catch (error) {
    if (error.code !== 11000 || !idempotencyKey) throw error;
    const existing = await SuperAdminAuditLog.findOne({ idempotencyKey });
    if (!existing) throw error;
    return existing;
  }
}
