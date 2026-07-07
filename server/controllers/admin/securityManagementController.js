const adminSecurityService = require('../../services/admin/adminSecurityService');

async function getLoginHistory(req, res, next) {
  try {
    const data = await adminSecurityService.getLoginHistory(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getSuspiciousActivity(req, res, next) {
  try {
    const data = await adminSecurityService.getSuspiciousActivity(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getLoginHistory,
  getSuspiciousActivity
};
