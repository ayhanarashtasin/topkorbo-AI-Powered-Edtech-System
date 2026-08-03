/**
 * requirePlan(minPlan) — route guard that must be used AFTER the `auth`
 * middleware. Loads the user from the DB (the JWT does NOT carry plan) and
 * rejects with 403 { code:'UPGRADE_REQUIRED' } unless the effective plan is at
 * least `minPlan`. Mirrors the middleware/admin.js pattern.
 *
 *   router.post('/annotations', auth, requirePlan('pro_plus'), c.createAnnotation)
 */
const planService = require('../services/planService');

module.exports = function requirePlan(minPlan = 'pro') {
  return async (req, res, next) => {
    try {
      const user = req.authUserDoc || await planService.loadUser(req.user.id);
      planService.assertPlanAtLeast(user, minPlan);
      req.fullUser = user; // hand the loaded doc downstream to avoid a re-query
      next();
    } catch (err) {
      next(err);
    }
  };
};
