const mongoose = require('mongoose');

const adminBroadcastSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    audience: {
      type: String,
      enum: ['all', 'students', 'teachers', 'tutors', 'moderators'],
      required: true,
      index: true
    },
    priority: {
      type: String,
      enum: ['normal', 'important', 'urgent'],
      default: 'normal'
    },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: false }
    },
    status: {
      type: String,
      enum: ['sent', 'scheduled', 'failed'],
      default: 'sent',
      index: true
    },
    scheduledFor: {
      type: Date,
      default: null
    },
    sentCount: {
      type: Number,
      default: 0
    },
    failedCount: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

adminBroadcastSchema.index({ createdAt: -1, audience: 1 });

module.exports = mongoose.model('AdminBroadcast', adminBroadcastSchema);
