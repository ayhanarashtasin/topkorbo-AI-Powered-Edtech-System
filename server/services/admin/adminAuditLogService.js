const AdminAuditLog = require('../../models/AdminAuditLog');
const { ADMIN_AUDIT_ACTION_TYPES } = require('../../models/AdminAuditLog');

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function listAuditLogs({ action = '', search = '', targetType = '', page = 1, limit = 20 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const query = {};
  const trimmedSearch = String(search || '').trim();

  if (action && ADMIN_AUDIT_ACTION_TYPES.includes(action)) {
    query.actionType = action;
  }
  if (targetType) {
    query.targetEntityType = String(targetType).trim();
  }
  if (trimmedSearch) {
    const regex = new RegExp(escapeRegex(trimmedSearch), 'i');
    query.$or = [
      { actionType: regex },
      { reason: regex },
      { targetEntityType: regex },
      { targetEntityName: regex }
    ];
  }

  const [items, total, targetTypes] = await Promise.all([
    AdminAuditLog.find(query)
      .populate('adminId', 'name email')
      .populate('targetUserId', 'name email role')
      .populate('targetQuestionId', 'questionText subject chapter topic approvalStatus')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    AdminAuditLog.countDocuments(query),
    AdminAuditLog.distinct('targetEntityType', { targetEntityType: { $ne: '' } })
  ]);

  return {
    items: items.map((entry) => ({
      id: String(entry._id),
      actionType: entry.actionType,
      reason: entry.reason || '',
      previousValue: entry.previousValue || null,
      newValue: entry.newValue || null,
      createdAt: entry.createdAt || null,
      target: {
        id: entry.targetEntityId || String(entry.targetUserId?._id || entry.targetQuestionId?._id || ''),
        type: entry.targetEntityType || (entry.targetUserId ? 'user' : entry.targetQuestionId ? 'question' : ''),
        name: entry.targetEntityName || entry.targetUserId?.name || entry.targetQuestionId?.questionText || 'N/A'
      },
      admin: entry.adminId
        ? {
            id: String(entry.adminId._id),
            name: entry.adminId.name || '',
            email: entry.adminId.email || ''
          }
        : null,
      targetUser: entry.targetUserId
        ? {
            id: String(entry.targetUserId._id),
            name: entry.targetUserId.name || '',
            email: entry.targetUserId.email || '',
            role: entry.targetUserId.role || ''
          }
        : null,
      targetQuestion: entry.targetQuestionId
        ? {
            id: String(entry.targetQuestionId._id),
            questionText: entry.targetQuestionId.questionText || '',
            subject: entry.targetQuestionId.subject || '',
            chapter: entry.targetQuestionId.chapter || '',
            topic: entry.targetQuestionId.topic || '',
            approvalStatus: entry.targetQuestionId.approvalStatus || ''
          }
        : null
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    },
    meta: {
      actions: ADMIN_AUDIT_ACTION_TYPES,
      targetTypes: targetTypes.filter(Boolean).sort((a, b) => a.localeCompare(b))
    }
  };
}

module.exports = {
  listAuditLogs
};
