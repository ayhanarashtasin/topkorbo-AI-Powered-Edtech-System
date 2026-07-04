const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

// Create a checkout session (authenticated user).
router.post('/init', auth, paymentController.initPayment);

// SSLCommerz callbacks — public (gateway/browser posts here, no bearer token).
// The success/IPN paths re-validate every transaction against SSLCommerz
// before granting a plan, so they are safe to leave unauthenticated.
router.post('/success', paymentController.paymentSuccess);
router.post('/fail', paymentController.paymentFail);
router.post('/cancel', paymentController.paymentCancel);
router.post('/ipn', paymentController.paymentIpn);

module.exports = router;
