const AdminAuditLog = require('../../models/AdminAuditLog');

async function createAdminAuditLog({
  adminId,
  targetUserId,
  actionType,
  previousValue,
  newValue,
  reason = ''
}) {
  return AdminAuditLog.create({
    adminId,
    targetUserId,
    actionType,
    previousValue,
    newValue,
    reason: reason ? String(reason).slice(0, 500) : ''
  });
}

module.exports = {
  createAdminAuditLog
};
