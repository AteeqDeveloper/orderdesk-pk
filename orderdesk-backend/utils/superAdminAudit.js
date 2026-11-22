import SuperAdminAuditLog from "../models/SuperAdminAuditLog.js";

export async function writeSuperAdminAudit({
  actorId,
  action,
  targetType,
  targetId = null,
  reason = "",
  metadata = {},
}) {
  return SuperAdminAuditLog.create({
    actorId,
    action,
    targetType,
    targetId,
    reason,
    metadata,
  });
}
