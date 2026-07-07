const mongoose = require('mongoose');
const Payment = require('../../models/Payment');
const User = require('../../models/User');
const AdminSubscriptionPlan = require('../../models/AdminSubscriptionPlan');
const { createAdminAuditLog } = require('./adminAuditService');
const { getEffectivePlan } = require('../planService');

const PLAN_ACCESS_OPTIONS = ['pro', 'pro_plus'];

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isPaymentGatewayConnected() {
  try {
    require.resolve('sslcommerz-lts');
    return Boolean(
      String(process.env.SSLCZ_STORE_ID || '').trim()
      && String(process.env.SSLCZ_STORE_PASSWORD || '').trim()
    );
  } catch (_) {
    return false;
  }
}

function formatPlanLabel(planId) {
  if (planId === 'pro_plus') return 'Pro+';
  if (planId === 'pro') return 'Pro';
  return String(planId || 'N/A').replace(/_/g, ' ');
}

function resolvePaymentMethod(payment) {
  return (
    payment.gatewayData?.card_type
    || payment.gatewayData?.card_brand
    || payment.gatewayData?.card_issuer
    || (payment.gatewayData && Object.keys(payment.gatewayData).length ? 'SSLCommerz' : '')
    || 'N/A'
  );
}

function resolvePaymentTransactionId(payment) {
  return (
    payment.gatewayData?.bank_tran_id
    || payment.valId
    || payment.tranId
    || ''
  );
}

function serializePayment(payment) {
  return {
    id: String(payment._id),
    user: payment.user
      ? {
          id: String(payment.user._id),
          name: payment.user.name || '',
          email: payment.user.email || ''
        }
      : null,
    amount: Number(payment.amount) || 0,
    currency: payment.currency || 'BDT',
    status: payment.status || 'pending',
    paymentMethod: resolvePaymentMethod(payment),
    transactionId: resolvePaymentTransactionId(payment),
    plan: payment.plan
      ? {
          id: payment.plan,
          name: formatPlanLabel(payment.plan)
        }
      : null,
    gatewayTransactionId: payment.tranId || '',
    date: payment.createdAt || null
  };
}

function serializePlan(plan) {
  return {
    id: String(plan._id),
    name: plan.name || '',
    price: Number(plan.price) || 0,
    currency: plan.currency || 'BDT',
    durationDays: Number(plan.durationDays) || 0,
    features: Array.isArray(plan.features) ? plan.features : [],
    accessPlan: plan.accessPlan || 'pro',
    active: plan.status === 'active',
    status: plan.status || 'active',
    createdAt: plan.createdAt || null,
    updatedAt: plan.updatedAt || null,
    archivedAt: plan.archivedAt || null
  };
}

function validatePlanPayload(payload = {}, { partial = false } = {}) {
  const next = {};

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'name')) {
    const name = String(payload.name || '').trim();
    if (!name) {
      const err = new Error('Plan name is required');
      err.statusCode = 400;
      throw err;
    }
    next.name = name.slice(0, 120);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'price')) {
    const price = Number(payload.price);
    if (!Number.isFinite(price) || price < 0) {
      const err = new Error('Plan price must be a valid non-negative number');
      err.statusCode = 400;
      throw err;
    }
    next.price = price;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'currency')) {
    const currency = String(payload.currency || 'BDT').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      const err = new Error('Currency must be a 3-letter code');
      err.statusCode = 400;
      throw err;
    }
    next.currency = currency;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'durationDays')) {
    const durationDays = Number(payload.durationDays);
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 3650) {
      const err = new Error('Plan duration must be between 1 and 3650 days');
      err.statusCode = 400;
      throw err;
    }
    next.durationDays = durationDays;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'features')) {
    const features = Array.isArray(payload.features)
      ? payload.features.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 30)
      : [];
    next.features = features;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(payload, 'accessPlan')) {
    const accessPlan = String(payload.accessPlan || '').trim();
    if (!PLAN_ACCESS_OPTIONS.includes(accessPlan)) {
      const err = new Error('Plan access tier must be pro or pro_plus');
      err.statusCode = 400;
      throw err;
    }
    next.accessPlan = accessPlan;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    const status = String(payload.status || '').trim();
    if (!['active', 'disabled'].includes(status)) {
      const err = new Error('Plan status must be active or disabled');
      err.statusCode = 400;
      throw err;
    }
    next.status = status;
  }

  return next;
}

async function listPaymentHistory({ search = '', status = '', plan = '', page = 1, limit = 10 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const query = {};

  if (status && ['pending', 'valid', 'failed', 'cancelled'].includes(status)) {
    query.status = status;
  }
  if (plan && ['pro', 'pro_plus'].includes(plan)) {
    query.plan = plan;
  }

  if (search.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    const users = await User.find({
      $or: [{ name: regex }, { email: regex }]
    }).select('_id').lean();
    const userIds = users.map((item) => item._id);
    query.$or = [
      { tranId: regex },
      { valId: regex },
      { 'gatewayData.bank_tran_id': regex },
      ...(userIds.length ? [{ user: { $in: userIds } }] : [])
    ];
  }

  const [items, total, grouped] = await Promise.all([
    Payment.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Payment.countDocuments(query),
    Payment.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          grossAmount: { $sum: '$amount' }
        }
      }
    ])
  ]);

  const stats = grouped.reduce((accumulator, item) => {
    accumulator.byStatus[item._id] = item.count;
    accumulator.grossAmount += Number(item.grossAmount) || 0;
    return accumulator;
  }, {
    grossAmount: 0,
    byStatus: { pending: 0, valid: 0, failed: 0, cancelled: 0 }
  });

  return {
    items: items.map(serializePayment),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    },
    stats,
    gatewayConnected: isPaymentGatewayConnected()
  };
}

async function listPlans({ search = '', status = '', page = 1, limit = 20 }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const query = {};

  if (search.trim()) {
    query.name = new RegExp(escapeRegex(search.trim()), 'i');
  }
  if (status && ['active', 'disabled', 'archived'].includes(status)) {
    query.status = status;
  }

  const [items, total, grouped] = await Promise.all([
    AdminSubscriptionPlan.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit),
    AdminSubscriptionPlan.countDocuments(query),
    AdminSubscriptionPlan.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
  ]);

  const stats = grouped.reduce((accumulator, item) => {
    accumulator[item._id] = item.count;
    return accumulator;
  }, { active: 0, disabled: 0, archived: 0 });

  return {
    items: items.map(serializePlan),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    },
    stats
  };
}

async function createPlan({ adminUser, payload = {} }) {
  const next = validatePlanPayload(payload);
  const plan = await AdminSubscriptionPlan.create(next);

  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'PLAN_CREATED',
    targetEntityId: String(plan._id),
    targetEntityType: 'subscription_plan',
    targetEntityName: plan.name,
    previousValue: null,
    newValue: serializePlan(plan),
    reason: String(payload.reason || '').trim()
  });

  return serializePlan(plan);
}

async function updatePlan({ adminUser, planId, payload = {} }) {
  if (!mongoose.Types.ObjectId.isValid(planId)) {
    const err = new Error('Plan not found');
    err.statusCode = 404;
    throw err;
  }

  const plan = await AdminSubscriptionPlan.findById(planId);
  if (!plan) {
    const err = new Error('Plan not found');
    err.statusCode = 404;
    throw err;
  }

  const previousValue = serializePlan(plan);
  const next = validatePlanPayload(payload, { partial: true });
  if (!Object.keys(next).length) {
    const err = new Error('No plan changes were provided');
    err.statusCode = 400;
    throw err;
  }

  Object.assign(plan, next);
  if (next.status && next.status !== 'archived') {
    plan.archivedAt = null;
  }
  await plan.save();

  const currentValue = serializePlan(plan);
  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'PLAN_UPDATED',
    targetEntityId: String(plan._id),
    targetEntityType: 'subscription_plan',
    targetEntityName: plan.name,
    previousValue,
    newValue: currentValue,
    reason: String(payload.reason || '').trim()
  });

  if (previousValue.status !== currentValue.status && currentValue.status === 'disabled') {
    await createAdminAuditLog({
      adminId: adminUser.id,
      actionType: 'PLAN_DISABLED',
      targetEntityId: String(plan._id),
      targetEntityType: 'subscription_plan',
      targetEntityName: plan.name,
      previousValue: { status: previousValue.status },
      newValue: { status: currentValue.status },
      reason: String(payload.reason || '').trim()
    });
  }

  return currentValue;
}

async function archivePlan({ adminUser, planId, reason = '' }) {
  if (!mongoose.Types.ObjectId.isValid(planId)) {
    const err = new Error('Plan not found');
    err.statusCode = 404;
    throw err;
  }

  const plan = await AdminSubscriptionPlan.findById(planId);
  if (!plan) {
    const err = new Error('Plan not found');
    err.statusCode = 404;
    throw err;
  }

  if (plan.status === 'archived') {
    return serializePlan(plan);
  }

  const previousValue = serializePlan(plan);
  plan.status = 'archived';
  plan.archivedAt = new Date();
  await plan.save();

  const currentValue = serializePlan(plan);
  await createAdminAuditLog({
    adminId: adminUser.id,
    actionType: 'PLAN_ARCHIVED',
    targetEntityId: String(plan._id),
    targetEntityType: 'subscription_plan',
    targetEntityName: plan.name,
    previousValue,
    newValue: currentValue,
    reason: String(reason || '').trim()
  });

  return currentValue;
}

function serializePremiumStatus(user, selectedPlan = null) {
  const effectivePlan = getEffectivePlan(user);
  const isPremium = effectivePlan !== 'free';
  return {
    user: {
      id: String(user._id),
      name: user.name || '',
      email: user.email || '',
      role: user.forumRole === 'admin' || user.forumRole === 'moderator'
        ? user.forumRole
        : (user.role || '')
    },
    premiumStatus: {
      isPremium,
      currentPlan: effectivePlan,
      rawPlan: user.plan || 'free',
      expiresAt: user.planExpiresAt || null,
      planIsTrial: Boolean(user.planIsTrial)
    },
    selectedPlan: selectedPlan ? serializePlan(selectedPlan) : null
  };
}

async function grantPremiumAccess({ adminUser, targetUserId, payload = {} }) {
  const reason = String(payload.reason || '').trim();
  if (!reason) {
    const err = new Error('Reason is required to grant premium access');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  let selectedPlan = null;
  let nextPlan = String(payload.accessPlan || '').trim();

  if (payload.planId) {
    if (!mongoose.Types.ObjectId.isValid(payload.planId)) {
      const err = new Error('Plan not found');
      err.statusCode = 404;
      throw err;
    }
    selectedPlan = await AdminSubscriptionPlan.findById(payload.planId);
    if (!selectedPlan || selectedPlan.status !== 'active') {
      const err = new Error('Plan not found');
      err.statusCode = 404;
      throw err;
    }
    nextPlan = selectedPlan.accessPlan;
  }

  if (!PLAN_ACCESS_OPTIONS.includes(nextPlan)) {
    const err = new Error('Premium access tier must be pro or pro_plus');
    err.statusCode = 400;
    throw err;
  }

  let expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
  if (!expiresAt && selectedPlan) {
    expiresAt = new Date(Date.now() + selectedPlan.durationDays * 24 * 60 * 60 * 1000);
  }

  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    const err = new Error('A future premium expiry date is required');
    err.statusCode = 400;
    throw err;
  }

  const previousValue = {
    plan: user.plan || 'free',
    effectivePlan: getEffectivePlan(user),
    planExpiresAt: user.planExpiresAt || null,
    planIsTrial: Boolean(user.planIsTrial)
  };

  user.plan = nextPlan;
  user.planExpiresAt = expiresAt;
  user.planIsTrial = false;
  await user.save();

  const currentValue = {
    plan: user.plan,
    effectivePlan: getEffectivePlan(user),
    planExpiresAt: user.planExpiresAt,
    planIsTrial: Boolean(user.planIsTrial),
    sourcePlanId: selectedPlan ? String(selectedPlan._id) : '',
    sourcePlanName: selectedPlan?.name || ''
  };

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: user._id,
    targetEntityId: String(user._id),
    targetEntityType: 'premium_access',
    targetEntityName: user.name || user.email,
    actionType: 'PREMIUM_GRANTED',
    previousValue,
    newValue: currentValue,
    reason
  });

  return serializePremiumStatus(user, selectedPlan);
}

async function revokePremiumAccess({ adminUser, targetUserId, reason = '' }) {
  const trimmedReason = String(reason || '').trim();
  if (!trimmedReason) {
    const err = new Error('Reason is required to revoke premium access');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const previousValue = {
    plan: user.plan || 'free',
    effectivePlan: getEffectivePlan(user),
    planExpiresAt: user.planExpiresAt || null,
    planIsTrial: Boolean(user.planIsTrial)
  };

  user.plan = 'free';
  user.planExpiresAt = null;
  user.planIsTrial = false;
  await user.save();

  const currentValue = {
    plan: user.plan,
    effectivePlan: getEffectivePlan(user),
    planExpiresAt: user.planExpiresAt,
    planIsTrial: Boolean(user.planIsTrial)
  };

  await createAdminAuditLog({
    adminId: adminUser.id,
    targetUserId: user._id,
    targetEntityId: String(user._id),
    targetEntityType: 'premium_access',
    targetEntityName: user.name || user.email,
    actionType: 'PREMIUM_REVOKED',
    previousValue,
    newValue: currentValue,
    reason: trimmedReason
  });

  return serializePremiumStatus(user);
}

module.exports = {
  listPaymentHistory,
  listPlans,
  createPlan,
  updatePlan,
  archivePlan,
  grantPremiumAccess,
  revokePremiumAccess
};
