const mongoose = require('mongoose');

/**
 * Payment — one row per SSLCommerz checkout attempt. A payment is only granted
 * (user plan upgraded) after the transaction is validated server-side against
 * SSLCommerz, never on the browser redirect alone.
 */
const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  plan: {
    type: String,
    enum: ['pro', 'pro_plus'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'BDT'
  },
  tranId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'valid', 'failed', 'cancelled'],
    default: 'pending'
  },
  // SSLCommerz validation payload (val_id, bank_tran_id, card_type, etc.)
  gatewayData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Payment', paymentSchema);
