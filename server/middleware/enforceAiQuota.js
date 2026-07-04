/**
 * enforceAiQuota — must be used AFTER the `auth` middleware. Consumes one
 * lifetime `aiActions` credit for the current user (no-op / unlimited for
 * Pro & Pro+). Applied on general-AI routes. Reading AI (book chat / knowledge)
 * is NOT metered here — it is gated to Pro+ via requirePlan('pro_plus').
 * The AI-battle opponent (`/ai/answer-mcq`) is also excluded — that flow is
 * bounded by the battle-room limit, so per-move metering would drain the quota.
 */
const planService = require('../services/planService');

module.exports = async function enforceAiQuota(req, res, next) {
  try {
    await planService.consume(req.user.id, 'aiActions');
    next();
  } catch (err) {
    next(err);
  }
};
