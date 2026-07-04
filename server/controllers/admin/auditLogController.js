const { listAuditLogs } = require('../../services/admin/adminAuditLogService');

async function getAuditLogs(req, res, next) {
  try {
    const data = await listAuditLogs(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getAuditLogs
};
