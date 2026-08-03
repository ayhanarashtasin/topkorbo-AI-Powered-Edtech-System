const AdminAuditLog = require('../../models/AdminAuditLog');

async function createAdminAuditLog({
  adminId,
  targetUserId,
  targetQuestionId,
  targetEntityId,
  targetEntityType,
  targetEntityName,
  actionType,
  previousValue,
  newValue,
  reason = '',
  session
}) {
  const [entry] = await AdminAuditLog.create([{
    adminId,
    targetUserId,
    targetQuestionId,
    targetEntityId: targetEntityId ? String(targetEntityId) : '',
    targetEntityType: targetEntityType || '',
    targetEntityName: targetEntityName || '',
    actionType,
    previousValue,
    newValue,
    reason: reason ? String(reason).slice(0, 500) : ''
  }], { session });
  return entry;
}

module.exports = {
  createAdminAuditLog
};
