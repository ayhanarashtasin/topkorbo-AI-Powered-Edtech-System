const adminPaymentsService = require('../../services/admin/adminPaymentsService');

async function getPaymentHistory(req, res, next) {
  try {
    const data = await adminPaymentsService.listPaymentHistory(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function getPlans(req, res, next) {
  try {
    const data = await adminPaymentsService.listPlans(req.query);
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
}

async function createPlan(req, res, next) {
  try {
    const data = await adminPaymentsService.createPlan({
      adminUser: req.user,
      payload: req.body || {}
    });
    return res.status(201).json({ success: true, data, message: 'Plan created successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function updatePlan(req, res, next) {
  try {
    const data = await adminPaymentsService.updatePlan({
      adminUser: req.user,
      planId: req.params.planId,
      payload: req.body || {}
    });
    return res.json({ success: true, data, message: 'Plan updated successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function archivePlan(req, res, next) {
  try {
    const data = await adminPaymentsService.archivePlan({
      adminUser: req.user,
      planId: req.params.planId,
      reason: req.body?.reason || ''
    });
    return res.json({ success: true, data, message: 'Plan archived successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function grantPremiumAccess(req, res, next) {
  try {
    const data = await adminPaymentsService.grantPremiumAccess({
      adminUser: req.user,
      targetUserId: req.params.userId,
      payload: req.body || {}
    });
    return res.json({ success: true, data, message: 'Premium access granted successfully.' });
  } catch (err) {
    return next(err);
  }
}

async function revokePremiumAccess(req, res, next) {
  try {
    const data = await adminPaymentsService.revokePremiumAccess({
      adminUser: req.user,
      targetUserId: req.params.userId,
      reason: req.body?.reason || ''
    });
    return res.json({ success: true, data, message: 'Premium access revoked successfully.' });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getPaymentHistory,
  getPlans,
  createPlan,
  updatePlan,
  archivePlan,
  grantPremiumAccess,
  revokePremiumAccess
};
