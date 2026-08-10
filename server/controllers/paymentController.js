const crypto = require('crypto');
const User = require('../models/User');
const Payment = require('../models/Payment');
const ApiResponse = require('../utils/apiResponse');
const { getPlanConfig, PLAN_DURATION_DAYS } = require('../config/plans');

const PURCHASABLE_PLANS = ['pro', 'pro_plus', 'mentor_pro', 'mentor_3months', 'mentor_6months', 'mentor_yearly'];

// Lazy-loaded so a missing `sslcommerz-lts` dependency doesn't crash server
// boot — payment endpoints simply return 503 until it is installed.
function getSSLCommerz() {
  try {
    return require('sslcommerz-lts');
  } catch (_) {
    return null;
  }
}

function sslConfig() {
  return {
    store_id: (process.env.SSLCZ_STORE_ID || '').trim(),
    store_passwd: (process.env.SSLCZ_STORE_PASSWORD || '').trim(),
    is_live: String(process.env.SSLCZ_IS_LIVE || '').toLowerCase() === 'true'
  };
}

function gatewayInitFailureMessage(apiResponse) {
  const reason = apiResponse && (
    apiResponse.failedreason ||
    apiResponse.errorReason ||
    apiResponse.error ||
    apiResponse.message
  );

  return reason
    ? `Failed to initialise payment session: ${reason}`
    : 'Failed to initialise payment session.';
}

// Absolute base the gateway/browser will hit for our callbacks.
function apiBase(req) {
  return process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
}

function frontendBase() {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

function resolveProductName(plan) {
  if (plan === 'mentor_pro') return 'TopKorbo Mentor Pro (1 Month)';
  if (plan === 'mentor_3months') return 'TopKorbo Mentor Pro (3 Months)';
  if (plan === 'mentor_6months') return 'TopKorbo Mentor Pro (6 Months)';
  if (plan === 'mentor_yearly') return 'TopKorbo Mentor Pro (1 Year)';
  if (plan === 'pro_plus') return 'TopKorbo Pro+ (30 days)';
  return 'TopKorbo Pro (30 days)';
}


exports.initPayment = async (req, res, next) => {
  try {
    const { plan } = req.body || {};
    if (!PURCHASABLE_PLANS.includes(plan)) {
      return ApiResponse.error(res, 'Invalid plan choice.', 400);
    }

    const { store_id, store_passwd } = sslConfig();
    const SSLCommerzPayment = getSSLCommerz();
    if (!store_id || !store_passwd || !SSLCommerzPayment) {
      return ApiResponse.error(res, 'Payment gateway is not configured.', 503);
    }

    const user = await User.findById(req.user.id);
    if (!user) return ApiResponse.error(res, 'User not found', 401);

    const amount = getPlanConfig(plan).price;
    const tranId = `TK_${plan}_${req.user.id}_${crypto.randomBytes(6).toString('hex')}`;
    const base = apiBase(req);

    await Payment.create({ user: user._id, plan, amount, tranId, status: 'pending' });

    const data = {
      total_amount: amount,
      currency: 'BDT',
      tran_id: tranId,
      success_url: `${base}/api/payments/success`,
      fail_url: `${base}/api/payments/fail`,
      cancel_url: `${base}/api/payments/cancel`,
      ipn_url: `${base}/api/payments/ipn`,
      emi_option: 0,
      shipping_method: 'NO',
      num_of_item: 1,
      product_name: resolveProductName(plan),
      product_category: 'Subscription',
      product_profile: 'non-physical-goods',
      cus_name: user.name || 'TopKorbo User',
      cus_email: user.email || 'user@topkorbo.com',
      cus_add1: user.areaName || 'N/A',
      cus_add2: '',
      cus_city: user.district || 'Dhaka',
      cus_state: user.district || 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      cus_phone: user.phoneNumber || '01700000000'
    };

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, sslConfig().is_live);
    const apiResponse = await sslcz.init(data);

    const gatewayUrl = apiResponse && (apiResponse.GatewayPageURL || apiResponse.redirectGatewayURL);
    if (!gatewayUrl) {
      await Payment.updateOne(
        { tranId, status: 'pending' },
        { $set: { status: 'failed', gatewayData: apiResponse || {} } }
      );
      return ApiResponse.error(res, gatewayInitFailureMessage(apiResponse), 502);
    }

    return ApiResponse.success(res, { url: gatewayUrl, tranId }, 'Payment session created');
  } catch (err) {
    next(err);
  }
};

/**
 * Grant a validated payment: mark it valid and activate the plan.
 * Returns true if the plan was granted.
 */
async function grantIfValid(tranId, gatewayData) {
  const payment = await Payment.findOne({ tranId });
  if (!payment) return false;
  if (payment.status === 'valid') return true; // already granted (idempotent)

  // SECURITY: the gateway validation payload must be bound to *this* local
  // transaction.
  if (String(gatewayData.tran_id || '') !== String(tranId)) {
    return false;
  }

  // Currency must match what we charged.
  const currency = String(gatewayData.currency || '').toUpperCase();
  if (currency && currency !== String(payment.currency || 'BDT').toUpperCase()) {
    await Payment.updateOne({ tranId, status: 'pending' }, { $set: { status: 'failed', gatewayData } });
    return false;
  }

  // Gateway must report a validated status.
  const status = String(gatewayData.status || '').toUpperCase();
  if (!['VALID', 'VALIDATED'].includes(status)) {
    return false;
  }

  // Verify the amount matches what we expect for this plan.
  const expected = getPlanConfig(payment.plan).price;
  const paid = Number(gatewayData.amount);
  if (!Number.isFinite(paid) || Math.round(paid) !== Math.round(expected)) {
    await Payment.updateOne({ tranId, status: 'pending' }, { $set: { status: 'failed', gatewayData } });
    return false;
  }

  // Atomically transition pending -> valid.
  const valId = gatewayData.val_id || null;
  const setValid = { status: 'valid', gatewayData };
  if (valId) setValid.valId = valId;
  let update;
  try {
    update = await Payment.updateOne(
      { tranId, status: 'pending' },
      { $set: setValid }
    );
  } catch (err) {
    if (err && err.code === 11000) return false;
    throw err;
  }

  if (!update.matchedCount) {
    const current = await Payment.findOne({ tranId }).lean();
    return !!(current && current.status === 'valid');
  }

  const durationDays = getPlanConfig(payment.plan).durationDays || PLAN_DURATION_DAYS;
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
  await User.updateOne(
    { _id: payment.user },
    { $set: { plan: payment.plan, planExpiresAt: expiresAt, planIsTrial: false } }
  );
  return true;
}

/**
 * POST /api/payments/success — browser is redirected here by SSLCommerz after
 * payment. We ALWAYS re-validate server-side against SSLCommerz before granting.
 */
exports.paymentSuccess = async (req, res) => {
  try {
    const body = req.body || {};
    const tranId = body.tran_id;
    const valId = body.val_id;
    const { store_id, store_passwd } = sslConfig();

    const SSLCommerzPayment = getSSLCommerz();
    let granted = false;
    if (tranId && valId && store_id && SSLCommerzPayment) {
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, sslConfig().is_live);
      const validation = await sslcz.validate({ val_id: valId });
      if (validation && ['VALID', 'VALIDATED'].includes(validation.status)) {
        granted = await grantIfValid(tranId, validation);
      }
    }

    let isMentor = false;
    if (tranId) {
      const p = await Payment.findOne({ tranId }).select('plan').lean();
      if (p && ['mentor_pro', 'mentor_3months', 'mentor_6months', 'mentor_yearly'].includes(p.plan)) {
        isMentor = true;
      }
    }

    let url;
    if (granted) {
      url = `${frontendBase()}/dashboard?upgraded=1`;
    } else {
      url = `${frontendBase()}/payment-status?status=failed&role=${isMentor ? 'tutor' : 'student'}`;
    }
    return res.redirect(url);
  } catch (err) {
    return res.redirect(`${frontendBase()}/payment-status?status=error`);
  }
};

/**
 * POST /api/payments/ipn — server-to-server notification (backup path). Requires
 * a publicly reachable ipn_url; validates and grants exactly like success.
 */
exports.paymentIpn = async (req, res) => {
  try {
    const body = req.body || {};
    const tranId = body.tran_id;
    const valId = body.val_id;
    const { store_id, store_passwd } = sslConfig();
    const SSLCommerzPayment = getSSLCommerz();
    if (tranId && valId && store_id && SSLCommerzPayment && ['VALID', 'VALIDATED'].includes(body.status)) {
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, sslConfig().is_live);
      const validation = await sslcz.validate({ val_id: valId });
      if (validation && ['VALID', 'VALIDATED'].includes(validation.status)) {
        await grantIfValid(tranId, validation);
      }
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    return res.status(200).json({ received: true });
  }
};

exports.paymentFail = async (req, res) => {
  try {
    const tranId = (req.body || {}).tran_id;
    if (tranId) await Payment.updateOne({ tranId, status: 'pending' }, { $set: { status: 'failed' } });
  } catch (_) { /* ignore */ }
  return res.redirect(`${frontendBase()}/pricing?payment=failed`);
};

exports.paymentCancel = async (req, res) => {
  try {
    const tranId = (req.body || {}).tran_id;
    if (tranId) await Payment.updateOne({ tranId, status: 'pending' }, { $set: { status: 'cancelled' } });
  } catch (_) { /* ignore */ }
  return res.redirect(`${frontendBase()}/pricing?payment=cancelled`);
};
