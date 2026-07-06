const AdminAuditLog = require('../../models/AdminAuditLog');

async function listAuditLogs({ action = '', page = 1, limit = 20 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const query = {};

  if (action) {
    query.actionType = action;
  }

  const [items, total] = await Promise.all([
    AdminAuditLog.find(query)
      .populate('adminId', 'name email')
      .populate('targetUserId', 'name email role')
      .populate('targetQuestionId', 'questionText subject chapter topic approvalStatus')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    AdminAuditLog.countDocuments(query)
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
    }
  };
}

module.exports = {
  listAuditLogs
};
