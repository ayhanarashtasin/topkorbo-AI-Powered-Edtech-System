const adminIeltsSetService = require('../../services/admin/adminIeltsSetService');

async function listIeltsSets(req, res, next) {
  try {
    const data = await adminIeltsSetService.listIeltsSets(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getIeltsSetDetails(req, res, next) {
  try {
    const data = await adminIeltsSetService.getIeltsSetDetails(req.params.setType, req.params.setId);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function approveIeltsSet(req, res, next) {
  try {
    const data = await adminIeltsSetService.approveIeltsSet({
      adminUser: req.user,
      setType: req.params.setType,
      setId: req.params.setId,
      reason: req.body?.reason || ''
    });
    return res.json({ success: true, data, message: 'IELTS set approved successfully' });
  } catch (err) {
    return next(err);
  }
}

async function rejectIeltsSet(req, res, next) {
  try {
    const data = await adminIeltsSetService.rejectIeltsSet({
      adminUser: req.user,
      setType: req.params.setType,
      setId: req.params.setId,
      reason: req.body?.reason || ''
    });
    return res.json({ success: true, data, message: 'IELTS set rejected successfully' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listIeltsSets,
  getIeltsSetDetails,
  approveIeltsSet,
  rejectIeltsSet
};
