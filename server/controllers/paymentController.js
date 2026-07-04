const crypto = require('crypto');
const User = require('../models/User');
const Payment = require('../models/Payment');
const ApiResponse = require('../utils/apiResponse');
const { getPlanConfig, PLAN_DURATION_DAYS } = require('../config/plans');

const PURCHASABLE_PLANS = ['pro', 'pro_plus'];

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
    store_id: process.env.SSLCZ_STORE_ID,
    store_passwd: process.env.SSLCZ_STORE_PASSWORD,
    is_live: process.env.SSLCZ_IS_LIVE === 'true'
  };
}

// Absolute base the gateway/browser will hit for our callbacks.
function apiBase(req) {
  return process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
}

function frontendBase() {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

/**
 * POST /api/payments/init  (auth)
 * Create an SSLCommerz session for a plan and return the GatewayPageURL.
 */
exports.initPayment = async (req, res, next) => {
  try {
    const { plan } = req.body || {};
    if (!PURCHASABLE_PLANS.includes(plan)) {
      return ApiResponse.error(res, 'Invalid plan. Choose "pro" or "pro_plus".', 400);
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
      shipping_method: 'NO',
      product_name: `TopKorbo ${plan === 'pro_plus' ? 'Pro+' : 'Pro'} (30 days)`,
      product_category: 'Subscription',
      product_profile: 'non-physical-goods',
      cus_name: user.name || 'TopKorbo User',
      cus_email: user.email || 'user@topkorbo.com',
      cus_add1: user.areaName || 'N/A',
      cus_city: user.district || 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      cus_phone: user.phoneNumber || '01700000000'
    };

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, sslConfig().is_live);
    const apiResponse = await sslcz.init(data);

    if (!apiResponse || !apiResponse.GatewayPageURL) {
      return ApiResponse.error(res, 'Failed to initialise payment session.', 502);
    }

    return ApiResponse.success(res, { url: apiResponse.GatewayPageURL, tranId }, 'Payment session created');
  } catch (err) {
    next(err);
  }
};

/**
 * Grant a validated payment: mark it valid and activate the plan for 30 days.
 * Returns true if the plan was granted.
 */
async function grantIfValid(tranId, gatewayData) {
  const payment = await Payment.findOne({ tranId });
  if (!payment || payment.status === 'valid') return payment && payment.status === 'valid';

  // Verify the amount matches what we expect for this plan.
  const expected = getPlanConfig(payment.plan).price;
  const paid = Number(gatewayData.amount);
  if (Number.isFinite(paid) && Math.round(paid) !== Math.round(expected)) {
    payment.status = 'failed';
    payment.gatewayData = gatewayData;
    await payment.save();
    return false;
  }

  payment.status = 'valid';
  payment.gatewayData = gatewayData;
  await payment.save();

  const expiresAt = new Date(Date.now() + PLAN_DURATION_DAYS * 24 * 60 * 60 * 1000);
  await User.updateOne(
    { _id: payment.user },
    { $set: { plan: payment.plan, planExpiresAt: expiresAt } }
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

    const url = granted
      ? `${frontendBase()}/setting?upgraded=1`
      : `${frontendBase()}/pricing?payment=failed`;
    return res.redirect(url);
  } catch (err) {
    return res.redirect(`${frontendBase()}/pricing?payment=error`);
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
