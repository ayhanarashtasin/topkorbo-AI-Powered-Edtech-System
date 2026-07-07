const mongoose = require('mongoose');

const loginHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    email: {
      type: String,
      default: '',
      trim: true,
      index: true
    },
    role: {
      type: String,
      default: '',
      trim: true
    },
    status: {
      type: String,
      enum: ['success', 'failure'],
      required: true,
      index: true
    },
    ipAddress: {
      type: String,
      default: '',
      trim: true
    },
    userAgent: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000
    },
    browser: {
      type: String,
      default: '',
      trim: true
    },
    device: {
      type: String,
      default: '',
      trim: true
    },
    loginMethod: {
      type: String,
      default: 'google_oauth',
      trim: true
    },
    failureReason: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

loginHistorySchema.index({ createdAt: -1, status: 1 });

module.exports = mongoose.model('LoginHistory', loginHistorySchema);
