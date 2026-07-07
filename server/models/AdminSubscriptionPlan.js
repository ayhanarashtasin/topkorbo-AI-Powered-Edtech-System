const mongoose = require('mongoose');

const adminSubscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      default: 'BDT',
      minlength: 3,
      maxlength: 3
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1,
      max: 3650
    },
    features: {
      type: [String],
      default: []
    },
    accessPlan: {
      type: String,
      enum: ['pro', 'pro_plus'],
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'disabled', 'archived'],
      default: 'active',
      index: true
    },
    archivedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

adminSubscriptionPlanSchema.index({ name: 1, status: 1 });

module.exports = mongoose.model('AdminSubscriptionPlan', adminSubscriptionPlanSchema);
