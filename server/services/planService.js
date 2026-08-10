/**
 * planService — subscription tier logic (limits, feature flags, usage).
 *
 * The JWT is long-lived (60d) and carries only { id, role }, so plan/usage are
 * ALWAYS read from the DB here — never trusted from the token. All enforcement
 * lives in this module; client-side gating is cosmetic only.
 */
const User = require('../models/User');
const ReadingState = require('../models/ReadingState');
const { getPlanConfig } = require('../config/plans');

/**
 * A gate failure. Serialized by middleware/errorHandler.js into
 * { success:false, message, code, feature, requiredPlan }.
 */
class PlanError extends Error {
  constructor(message, { statusCode = 402, code = 'LIMIT_REACHED', feature = null, requiredPlan = null } = {}) {
    super(message);
    this.name = 'PlanError';
    this.isPlanError = true;
    this.statusCode = statusCode;
    this.code = code;
    this.feature = feature;
    this.requiredPlan = requiredPlan;
  }
}

/**
 * Resolve the effective plan for a user document. A paid plan whose
 * planExpiresAt has passed is treated as 'free' (lazy monthly expiry).
 */
function getEffectivePlan(user) {
  if (!user || !user.plan || user.plan === 'free') return 'free';
  if (user.planExpiresAt && new Date(user.planExpiresAt).getTime() < Date.now()) {
    return 'free';
  }
  return user.plan;
}

/**
 * Load the full user doc from the DB by id (req.user.id from the JWT).
 */
async function loadUser(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new PlanError('User not found', { statusCode: 401, code: 'AUTH_REQUIRED' });
  }
  return user;
}

/**
 * Throw if the user's effective plan has hit its lifetime cap for `key`.
 * No-op when the plan has no limit for that key (Pro / Pro+ = unlimited).
 */
function assertWithinLimit(user, key) {
  const plan = getEffectivePlan(user);
  const { limits } = getPlanConfig(plan);
  const cap = limits[key];
  if (cap === undefined || cap === Infinity) return; // unlimited for this plan
  const used = (user.usage && user.usage[key]) || 0;
  if (used >= cap) {
    throw new PlanError(
      `You've reached your free-plan limit for this feature. Upgrade to continue.`,
      { statusCode: 402, code: 'LIMIT_REACHED', feature: key }
    );
  }
}

/**
 * Atomically increment a lifetime usage counter. Safe to call after
 * assertWithinLimit has passed.
 */
async function incrementUsage(userId, key) {
  await User.updateOne({ _id: userId }, { $inc: { [`usage.${key}`]: 1 } });
}

/** Convenience: check + increment in one call, loading the user first. */
async function consume(userId, key) {
  const user = await loadUser(userId);
  assertWithinLimit(user, key);
  await incrementUsage(userId, key);
}

function canUseReadingTools(user) {
  return getPlanConfig(getEffectivePlan(user)).readingTools === true;
}

function canUseReadingAI(user) {
  return getPlanConfig(getEffectivePlan(user)).readingAI === true;
}

/**
 * Free tier may open at most `readingBooks` distinct books. Allowed if the
 * book is already in the user's ReadingState set, or the set is under the cap.
 */
async function assertBookOpenable(user, bookId) {
  const cap = getPlanConfig(getEffectivePlan(user)).readingBooks;
  if (cap === Infinity) return;
  const openedBookIds = await ReadingState.distinct('bookId', { userId: user._id });
  const already = openedBookIds.some((id) => String(id) === String(bookId));
  if (already) return;
  if (openedBookIds.length >= cap) {
    throw new PlanError(
      `Free plan can open up to ${cap} books. Upgrade to read more.`,
      { statusCode: 402, code: 'LIMIT_REACHED', feature: 'readingBooks' }
    );
  }
}

/**
 * Route/controller guard: require the effective plan to be at least `required`.
 * Ordering: free < pro < pro_plus (and mentor_pro / mentor_yearly).
 */
const PLAN_RANK = { free: 0, pro: 1, pro_plus: 2, mentor_pro: 2, mentor_3months: 2, mentor_6months: 2, mentor_yearly: 2 };

function canUseMentorFeatures(user) {
  if (user?.role === 'teacher') return true; // Teachers are exempt
  const effective = getEffectivePlan(user);
  return ['mentor_pro', 'mentor_3months', 'mentor_6months', 'mentor_yearly'].includes(effective);
}

function assertPlanAtLeast(user, required) {
  if (['mentor_pro', 'mentor_3months', 'mentor_6months', 'mentor_yearly'].includes(required)) {
    if (!canUseMentorFeatures(user)) {
      throw new PlanError('Mentor Panel features require an active Mentor Pro subscription.', {
        statusCode: 403,
        code: 'UPGRADE_REQUIRED',
        requiredPlan: 'mentor_pro'
      });
    }
    return;
  }

  const effective = getEffectivePlan(user);
  if ((PLAN_RANK[effective] || 0) < (PLAN_RANK[required] || 0)) {
    throw new PlanError('This feature requires an upgraded plan.', {
      statusCode: 403,
      code: 'UPGRADE_REQUIRED',
      requiredPlan: required
    });
  }
}

module.exports = {
  PlanError,
  getEffectivePlan,
  loadUser,
  assertWithinLimit,
  incrementUsage,
  consume,
  canUseReadingTools,
  canUseReadingAI,
  canUseMentorFeatures,
  assertBookOpenable,
  assertPlanAtLeast
};
